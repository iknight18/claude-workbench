import { execSync } from 'child_process';

export interface ClaudeProcess {
  pid: number;
  args: string;
}

export function scanClaudeProcesses(): ClaudeProcess[] {
  try {
    const output = execSync('ps aux', { encoding: 'utf-8', timeout: 10000 });
    const lines = output.split('\n').filter(line => {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 11) return false;
      const cmd = parts[10];
      // Match: "claude", "claude-work", "claude-perso", etc. as the executable (not substring)
      // Also match node running claude-code/cli.js
      if (cmd === 'claude' || /^claude-\w+$/.test(cmd)) return true;
      if (parts.slice(10).join(' ').includes('claude-code/cli.js')) return true;
      return false;
    });

    return lines.map(line => {
      const parts = line.trim().split(/\s+/);
      const pid = parseInt(parts[1], 10);
      const cmd = parts.slice(10).join(' ');
      return { pid, args: cmd || '(no args)' };
    }).filter(p => !isNaN(p.pid));
  } catch {
    return [];
  }
}

export function killClaudeProcesses(pids?: number[]): { killed: number[]; failed: number[] } {
  const targetPids = pids ?? scanClaudeProcesses().map(p => p.pid);
  if (targetPids.length === 0) return { killed: [], failed: [] };
  const killed: number[] = [];
  const failed: number[] = [];
  for (const pid of targetPids) {
    try {
      execSync(`kill -9 ${pid}`, { encoding: 'utf-8', timeout: 5000 });
      killed.push(pid);
    } catch {
      failed.push(pid);
    }
  }
  return { killed, failed };
}
