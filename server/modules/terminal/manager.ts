import * as pty from 'node-pty';
import { WebSocket } from 'ws';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { config } from '../../config';
import { NotificationBroadcaster } from '../notifications/websocket';
import { createNotification } from '../notifications/service';


const PID_FILE = path.join(__dirname, '../../data/tracked-pids.json');

const MAX_BUFFER_SIZE = 4096; // 4KB rolling buffer

function stripAnsi(str: string): string {
  return str
    // CSI sequences: \x1B[ (params) (intermediate) (final) — includes ?/> private params, ~ terminator
    .replace(/\x1B\[[0-9;?]*[a-zA-Z~@]/g, '')
    // OSC sequences: \x1B] ... (BEL or ST)
    .replace(/\x1B\][^\x07\x1B]*(?:\x07|\x1B\\)/g, '')
    // Charset designation: \x1B( or \x1B)
    .replace(/\x1B[()][AB012]/g, '')
    // Two-byte escape sequences: \x1B + intermediate + final
    .replace(/\x1B[\x20-\x2F][\x30-\x7E]/g, '')
    // Simple escape sequences: \x1B followed by single char (=, >, etc.)
    .replace(/\x1B[=>78HMNOcDEZ]/g, '')
    // Any remaining lone ESC sequences
    .replace(/\x1B\[[\x20-\x7E]*/g, '')
    // Carriage return (TUI uses \r to overwrite lines)
    .replace(/\r/g, '')
    // Other control chars except \n and \t
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

// Claude's TUI renders the screen with cursor positioning, status bars, and separators.
// Extract only the meaningful message content.
function stripTuiNoise(str: string): string {
  const lines = str.split('\n');

  // Find the first separator in the trailing cluster of separators/status lines.
  // Walk backwards to find the earliest consecutive separator line near the end.
  const isSeparator = (line: string) => {
    const trimmed = line.trim();
    return trimmed.length >= 5 && /^[-─━═┄┅┈┉╌╍]+[❯>]?$/.test(trimmed);
  };

  let cutAt = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (isSeparator(lines[i])) {
      cutAt = i;
      // Keep walking back to catch the full cluster of adjacent separators
      while (i > 0 && isSeparator(lines[i - 1])) {
        i--;
        cutAt = i;
      }
      break;
    }
  }

  // Cut everything from the first separator in the cluster onward
  const content = cutAt >= 0 ? lines.slice(0, cutAt) : lines;

  // Filter out remaining TUI artifacts:
  // - Lines that are just TUI chrome (spinner icons, status indicators, mode labels)
  // - Lines with excessive whitespace padding (TUI uses fixed-width rendering)
  return content
    .filter(line => {
      const trimmed = line.trim();
      if (!trimmed) return true; // keep blank lines for structure
      // Skip TUI status lines (but NOT ● which is Claude's response marker)
      if (/^(Model:|Ctx[:(]|⏵|✶\s)/.test(trimmed)) return false;
      // Skip lines that are just whitespace padding (20+ spaces with tiny content)
      if (line.length > 50 && trimmed.length < 5) return false;
      return true;
    })
    .join('\n')
    // Collapse runs of 3+ blank lines into 2
    .replace(/\n{3,}/g, '\n\n');
}

function readTrackedPids(): number[] {
  try {
    if (!existsSync(PID_FILE)) return [];
    const data = readFileSync(PID_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeTrackedPids(pids: number[]): void {
  try {
    writeFileSync(PID_FILE, JSON.stringify(pids), 'utf-8');
  } catch {
    // ignore write errors
  }
}

function addTrackedPid(pid: number): void {
  const pids = readTrackedPids();
  if (!pids.includes(pid)) {
    pids.push(pid);
    writeTrackedPids(pids);
  }
}

function removeTrackedPid(pid: number): void {
  const pids = readTrackedPids().filter(p => p !== pid);
  writeTrackedPids(pids);
}

export function cleanupOrphanedProcesses(): void {
  const pids = readTrackedPids();
  if (pids.length === 0) return;

  for (const pid of pids) {
    try {
      // Check if process is still alive and is a Claude process
      const output = execSync(
        `ps -p ${pid} -o args= 2>/dev/null || true`,
        { encoding: 'utf-8', timeout: 5000 }
      ).trim();

      if (output && output.includes('claude-code/cli.js')) {
        execSync(`kill -9 ${pid}`, { encoding: 'utf-8', timeout: 5000 });
      }
    } catch {
      // Process not found or kill failed — skip
    }
  }

  // Clear the file
  writeTrackedPids([]);
}

interface TerminalInstance {
  pty: pty.IPty;
  clients: Set<WebSocket>;
  sessionId: string;
  alive: boolean;
}

interface ClaudeSpawnOptions {
  sessionId: string;
  sessionName: string;
  directory: string;
  profile: string;
  skipPermissions: boolean;
  debugEnabled: boolean;
  claudeSessionId: string; // UUID for Claude's --session-id / --resume
  resume: boolean; // true = --resume (returning), false = --session-id (first run)
}

class TerminalManager {
  private static instance: TerminalManager;
  private terminals = new Map<string, TerminalInstance>();
  private outputBuffers = new Map<string, string>();

  static getInstance(): TerminalManager {
    if (!TerminalManager.instance) {
      TerminalManager.instance = new TerminalManager();
    }
    return TerminalManager.instance;
  }

  create(options: ClaudeSpawnOptions): TerminalInstance {
    const { sessionId, sessionName, directory, profile, skipPermissions, debugEnabled, claudeSessionId, resume } = options;

    if (this.terminals.has(sessionId)) {
      throw new Error(`Terminal already exists for session ${sessionId}`);
    }

    // Ensure cwd exists
    if (directory && !existsSync(directory)) {
      const { mkdirSync } = require('fs');
      mkdirSync(directory, { recursive: true });
      console.log(`[Terminal] Created missing directory: ${directory}`);
    }

    const executable = profile ? `claude-${profile}` : 'claude';

    const args: string[] = [];
    if (resume) {
      args.push('--resume', claudeSessionId);
    } else {
      args.push('--session-id', claudeSessionId);
    }
    if (skipPermissions) {
      args.push('--dangerously-skip-permissions');
    }

    // Capture debug logs when enabled
    if (debugEnabled) {
      const debugDir = config.debugDir;
      if (!existsSync(debugDir)) {
        mkdirSync(debugDir, { recursive: true });
      }
      args.push('--debug-file', path.join(debugDir, `${sessionId}.log`));
    }

    console.log(`[Terminal] Spawning for session ${sessionId}: ${executable} ${args.join(' ')}`);
    console.log(`[Terminal] cwd: ${directory}, profile: ${profile || '(default)'}`);

    const ptyProcess = pty.spawn(executable, args, {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: directory,
      env: { ...process.env } as Record<string, string>,
    });

    console.log(`[Terminal] Spawned PID ${ptyProcess.pid}`);

    const instance: TerminalInstance = {
      pty: ptyProcess,
      clients: new Set(),
      sessionId,
      alive: true,
    };

    ptyProcess.onData((data: string) => {
      // Log last output before exit for debugging
      const stripped = data.replace(/\x1B\[[0-9;?]*[a-zA-Z~@]/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
      if (stripped) {
        console.log(`[Terminal][${sessionId.slice(0,6)}] ${stripped.slice(0, 200)}`);
      }

      // Accumulate output buffer
      let buffer = this.outputBuffers.get(sessionId) ?? '';
      buffer += data;
      if (buffer.length > MAX_BUFFER_SIZE) {
        buffer = buffer.slice(-MAX_BUFFER_SIZE);
      }
      this.outputBuffers.set(sessionId, buffer);

      const message = JSON.stringify({ type: 'output', data });
      for (const client of instance.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      }
    });

    const spawnTime = Date.now();

    ptyProcess.onExit(({ exitCode, signal }) => {
      console.log(`[Terminal] Session ${sessionId} exited: code=${exitCode} signal=${signal}`);
      const elapsed = Date.now() - spawnTime;

      // If --resume was used and process died quickly, retry as fresh session
      if (resume && exitCode !== 0 && elapsed < 5000) {
        console.log(`[Terminal] Quick exit with --resume, retrying with --session-id...`);
        this.terminals.delete(sessionId);
        this.outputBuffers.delete(sessionId);
        try {
          this.create({ ...options, resume: false });
          // Reattach existing WebSocket clients to the new terminal
          const newInstance = this.terminals.get(sessionId);
          if (newInstance) {
            for (const client of instance.clients) {
              newInstance.clients.add(client);
            }
          }
        } catch (err) {
          console.error(`[Terminal] Retry failed:`, err);
          instance.alive = false;
          const message = JSON.stringify({ type: 'exit', code: exitCode });
          for (const client of instance.clients) {
            if (client.readyState === WebSocket.OPEN) {
              client.send(message);
            }
          }
        }
        return;
      }

      instance.alive = false;

      // If this instance was already replaced (e.g. kill + restart), skip cleanup
      // to avoid clobbering the new terminal's state
      const current = this.terminals.get(sessionId);
      if (current && current !== instance) return;

      NotificationBroadcaster.getInstance().broadcastEvent({
        type: 'terminal_stopped',
        sessionId,
      });
      const message = JSON.stringify({ type: 'exit', code: exitCode });
      for (const client of instance.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      }
    });

    this.terminals.set(sessionId, instance);
    NotificationBroadcaster.getInstance().broadcastEvent({
      type: 'terminal_started',
      sessionId,
      sessionName,
    });
    addTrackedPid(ptyProcess.pid);
    return instance;
  }

  get(sessionId: string): TerminalInstance | null {
    return this.terminals.get(sessionId) ?? null;
  }

  write(sessionId: string, data: string): void {
    const instance = this.terminals.get(sessionId);
    if (instance?.alive) {
      instance.pty.write(data);
    }
  }

  getOutputBuffer(sessionId: string): string | null {
    return this.outputBuffers.get(sessionId) ?? null;
  }

  getRecentOutput(sessionId: string, maxChars: number = 500): string | null {
    const buffer = this.outputBuffers.get(sessionId);
    if (!buffer) return null;
    const cleaned = stripTuiNoise(stripAnsi(buffer));
    if (cleaned.length <= maxChars) return cleaned.trim();
    // Take last maxChars, trim to last complete line
    const tail = cleaned.slice(-maxChars);
    const firstNewline = tail.indexOf('\n');
    return (firstNewline >= 0 ? tail.slice(firstNewline + 1) : tail).trim();
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const instance = this.terminals.get(sessionId);
    if (instance?.alive) {
      instance.pty.resize(cols, rows);
    }
  }

  kill(sessionId: string): void {
    const instance = this.terminals.get(sessionId);
    if (!instance) return;

    removeTrackedPid(instance.pty.pid);

    // Summary notification is created by the onExit handler to avoid duplicates

    NotificationBroadcaster.getInstance().broadcastEvent({
      type: 'terminal_stopped',
      sessionId,
    });

    if (instance.alive) {
      instance.pty.kill();
    }

    const message = JSON.stringify({ type: 'exit', code: -1 });
    for (const client of instance.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
        client.close();
      }
    }

    this.terminals.delete(sessionId);
    this.outputBuffers.delete(sessionId);
  }

  getActiveSessionIds(): string[] {
    const ids: string[] = [];
    for (const [sessionId, instance] of this.terminals) {
      if (instance.alive) {
        ids.push(sessionId);
      }
    }
    return ids;
  }

  killAll(): void {
    for (const sessionId of [...this.terminals.keys()]) {
      this.kill(sessionId);
    }
    this.outputBuffers.clear();
    writeTrackedPids([]);
  }
}

export { TerminalManager, TerminalInstance, ClaudeSpawnOptions };
