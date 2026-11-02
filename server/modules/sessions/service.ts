import { execSync } from 'child_process';
import { readFile, writeFile, unlink, access } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { getDb } from '../../db/connection';
import { generateId } from '../../shared/utils/uuid';
import { config } from '../../config';
import {
  Session,
  SessionRow,
  SessionWithGit,
  CreateSessionInput,
  UpdateSessionInput,
  SessionTask,
  SessionTaskRow,
} from './types';

// Git branch cache: directory -> { branch, timestamp }
const gitCache = new Map<string, { branch: string | null; timestamp: number }>();
const GIT_CACHE_TTL = 5000; // 5 seconds

function getGitBranch(directory: string): string | null {
  const now = Date.now();
  const cached = gitCache.get(directory);
  if (cached && now - cached.timestamp < GIT_CACHE_TTL) {
    return cached.branch;
  }

  let branch: string | null = null;
  try {
    branch = execSync('git branch --show-current', {
      cwd: directory,
      encoding: 'utf-8',
      timeout: 3000,
    }).trim() || null;
  } catch {
    branch = null;
  }

  gitCache.set(directory, { branch, timestamp: now });
  return branch;
}

function attachTags(row: SessionRow): Session {
  const db = getDb();
  const tags = db
    .prepare('SELECT tag FROM session_tags WHERE session_id = ? ORDER BY tag')
    .all(row.id) as { tag: string }[];
  return {
    ...row,
    status: row.status as Session['status'],
    skip_permissions: Boolean(row.skip_permissions),
    hooks_enabled: Boolean(row.hooks_enabled),
    debug_enabled: Boolean(row.debug_enabled),
    tags: tags.map(t => t.tag),
  };
}

export function listSessions(
  search?: string,
  tag?: string,
  status?: string
): Session[] {
  const db = getDb();
  let query = 'SELECT * FROM sessions';
  const conditions: string[] = [];
  const params: string[] = [];

  if (search) {
    conditions.push('name LIKE ?');
    params.push(`%${search}%`);
  }

  if (tag) {
    conditions.push(
      'id IN (SELECT session_id FROM session_tags WHERE tag = ?)'
    );
    params.push(tag);
  }

  if (status && status !== 'all') {
    conditions.push('status = ?');
    params.push(status);
  } else if (!status) {
    // Default to active
    conditions.push("status = 'active'");
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY updated_at DESC';

  const rows = db.prepare(query).all(...params) as SessionRow[];
  return rows.map(attachTags);
}

export function getSession(id: string): SessionWithGit | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as
    | SessionRow
    | undefined;
  if (!row) return null;

  const session = attachTags(row);
  const git_branch = row.directory ? getGitBranch(row.directory) : null;
  return { ...session, git_branch };
}

export function createSession(input: CreateSessionInput): Session {
  const db = getDb();
  const id = generateId();
  const now = new Date().toISOString();

  const txn = db.transaction(() => {
    db.prepare(
      'INSERT INTO sessions (id, name, directory, profile, skip_permissions, hooks_enabled, debug_enabled, "group", notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, input.name, input.directory ?? '', input.profile ?? '', input.skip_permissions ? 1 : 0, input.hooks_enabled ? 1 : 0, input.debug_enabled ? 1 : 0, input.group ?? '', input.notes ?? '', now, now);

    if (input.tags && input.tags.length > 0) {
      const insertTag = db.prepare(
        'INSERT INTO session_tags (id, session_id, tag) VALUES (?, ?, ?)'
      );
      for (const tag of input.tags) {
        insertTag.run(generateId(), id, tag);
      }
    }
  });

  txn();
  return attachTags(
    db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as SessionRow
  );
}

const VALID_STATUSES = ['active', 'completed', 'archived'];

export function updateSession(
  id: string,
  input: UpdateSessionInput
): Session | null {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as
    | SessionRow
    | undefined;
  if (!existing) return null;

  if (input.status && !VALID_STATUSES.includes(input.status)) {
    throw new Error(`Invalid status: ${input.status}`);
  }

  const txn = db.transaction(() => {
    const now = new Date().toISOString();
    const name = input.name ?? existing.name;
    const directory = input.directory ?? existing.directory;
    const status = input.status ?? existing.status;
    const notes = input.notes ?? existing.notes;
    const profile = input.profile ?? existing.profile;
    const skip_permissions = input.skip_permissions ?? Boolean(existing.skip_permissions);
    const hooks_enabled = input.hooks_enabled ?? Boolean(existing.hooks_enabled);
    const debug_enabled = input.debug_enabled ?? Boolean(existing.debug_enabled);
    const group = input.group ?? existing.group;

    db.prepare(
      'UPDATE sessions SET name = ?, directory = ?, status = ?, profile = ?, skip_permissions = ?, hooks_enabled = ?, debug_enabled = ?, "group" = ?, notes = ?, updated_at = ? WHERE id = ?'
    ).run(name, directory, status, profile, skip_permissions ? 1 : 0, hooks_enabled ? 1 : 0, debug_enabled ? 1 : 0, group, notes, now, id);

    if (input.tags !== undefined) {
      db.prepare('DELETE FROM session_tags WHERE session_id = ?').run(id);
      const insertTag = db.prepare(
        'INSERT INTO session_tags (id, session_id, tag) VALUES (?, ?, ?)'
      );
      for (const tag of input.tags) {
        insertTag.run(generateId(), id, tag);
      }
    }
  });

  txn();
  return attachTags(
    db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as SessionRow
  );
}

export function getClaudeSessionId(sessionId: string, profile: string): string | null {
  const db = getDb();
  const row = db.prepare(
    'SELECT claude_session_id FROM session_profile_claude_ids WHERE session_id = ? AND profile = ?'
  ).get(sessionId, profile) as { claude_session_id: string } | undefined;
  return row?.claude_session_id ?? null;
}

export function setClaudeSessionId(sessionId: string, profile: string, claudeSessionId: string): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO session_profile_claude_ids (id, session_id, profile, claude_session_id)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(session_id, profile) DO UPDATE SET claude_session_id = excluded.claude_session_id`
  ).run(generateId(), sessionId, profile, claudeSessionId);
}

export function deleteSession(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM sessions WHERE id = ?').run(id);

  // Clean up debug log file
  if (result.changes > 0) {
    const debugLogPath = join(config.debugDir, `${id}.log`);
    unlink(debugLogPath).catch(() => {}); // ignore if not found
  }

  return result.changes > 0;
}

export function listDirectories(): string[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT directory, MAX(updated_at) as last_updated FROM sessions WHERE directory != '' GROUP BY directory ORDER BY last_updated DESC"
    )
    .all() as { directory: string; last_updated: string }[];
  return rows.map(r => r.directory);
}

export function listGroups(): string[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT DISTINCT \"group\" FROM sessions WHERE \"group\" != '' ORDER BY \"group\"")
    .all() as { group: string }[];
  return rows.map(r => r.group);
}

export function countSessionsWithHooksInDirectory(directory: string, excludeSessionId: string): number {
  const db = getDb();
  const row = db.prepare(
    "SELECT COUNT(*) as count FROM sessions WHERE directory = ? AND id != ? AND hooks_enabled = 1 AND status = 'active'"
  ).get(directory, excludeSessionId) as { count: number };
  return row.count;
}

export function listSessionTags(): string[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT DISTINCT tag FROM session_tags ORDER BY tag')
    .all() as { tag: string }[];
  return rows.map(r => r.tag);
}

function rowToSessionTask(row: SessionTaskRow): SessionTask {
  return {
    ...row,
    status: row.status as SessionTask['status'],
  };
}

export function listSessionTasks(sessionId: string): SessionTask[] {
  const db = getDb();
  const rows = db.prepare(
    `SELECT * FROM session_tasks WHERE session_id = ?
     ORDER BY
       CASE WHEN status = 'completed' THEN 1 ELSE 0 END,
       created_at ASC`
  ).all(sessionId) as SessionTaskRow[];
  return rows.map(rowToSessionTask);
}

export function upsertSessionTask(sessionId: string, subject: string, status: 'pending' | 'in_progress' | 'completed'): SessionTask {
  const db = getDb();
  const id = generateId();
  const completedAt = status === 'completed' ? new Date().toISOString() : null;

  db.prepare(
    `INSERT INTO session_tasks (id, session_id, subject, status, completed_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(session_id, subject) DO UPDATE SET
       status = excluded.status,
       completed_at = CASE WHEN excluded.status = 'completed' THEN COALESCE(session_tasks.completed_at, excluded.completed_at) ELSE session_tasks.completed_at END`
  ).run(id, sessionId, subject, status, completedAt);

  const row = db.prepare(
    'SELECT * FROM session_tasks WHERE session_id = ? AND subject = ?'
  ).get(sessionId, subject) as SessionTaskRow;
  return rowToSessionTask(row);
}

export function clearSessionTasks(sessionId: string): number {
  const db = getDb();
  const result = db.prepare('DELETE FROM session_tasks WHERE session_id = ?').run(sessionId);
  return result.changes;
}

export function getSessionTaskSummary(sessionId: string): { total: number; completed: number } {
  const db = getDb();
  const row = db.prepare(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
     FROM session_tasks WHERE session_id = ?`
  ).get(sessionId) as { total: number; completed: number };
  return { total: row.total, completed: row.completed ?? 0 };
}

export function getActiveSessionTasks(): { sessionId: string; sessionName: string; tasks: SessionTask[] }[] {
  const { TerminalManager } = require('../terminal/manager');
  const manager = TerminalManager.getInstance();
  const activeIds = manager.getActiveSessionIds();

  if (activeIds.length === 0) return [];

  const db = getDb();
  const result: { sessionId: string; sessionName: string; tasks: SessionTask[] }[] = [];

  for (const sessionId of activeIds) {
    const session = db.prepare('SELECT name FROM sessions WHERE id = ?').get(sessionId) as { name: string } | undefined;
    if (!session) continue;

    const rows = db.prepare(
      `SELECT * FROM session_tasks WHERE session_id = ?
       ORDER BY CASE WHEN status = 'completed' THEN 1 ELSE 0 END, created_at ASC`
    ).all(sessionId) as SessionTaskRow[];

    result.push({
      sessionId,
      sessionName: session.name,
      tasks: rows.map(rowToSessionTask),
    });
  }

  return result;
}

export interface ProjectConfig {
  directory: string;
  claudeMd: string | null;
  agentsMd: string | null;
}

async function readFileOrNull(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

async function resolveSessionDirectory(sessionId: string): Promise<string> {
  const db = getDb();
  const row = db.prepare('SELECT directory FROM sessions WHERE id = ?').get(sessionId) as { directory: string } | undefined;
  if (!row) throw Object.assign(new Error('Session not found'), { status: 404 });
  if (!row.directory) throw Object.assign(new Error('Session has no directory set'), { status: 400 });
  try {
    await access(row.directory);
  } catch {
    throw Object.assign(new Error('Directory does not exist'), { status: 404 });
  }
  return row.directory;
}

export async function getProjectConfig(sessionId: string): Promise<ProjectConfig> {
  const directory = await resolveSessionDirectory(sessionId);

  const claudeMd = await readFileOrNull(join(directory, 'CLAUDE.md'));
  const agentsMd = await readFileOrNull(join(directory, 'AGENTS.md'));

  return { directory, claudeMd, agentsMd };
}

export async function writeProjectConfig(
  sessionId: string,
  data: { claudeMd?: string; agentsMd?: string }
): Promise<ProjectConfig> {
  const directory = await resolveSessionDirectory(sessionId);

  if (data.claudeMd !== undefined) {
    await writeFile(join(directory, 'CLAUDE.md'), data.claudeMd, 'utf-8');
  }
  if (data.agentsMd !== undefined) {
    await writeFile(join(directory, 'AGENTS.md'), data.agentsMd, 'utf-8');
  }

  const claudeMd = await readFileOrNull(join(directory, 'CLAUDE.md'));
  const agentsMd = await readFileOrNull(join(directory, 'AGENTS.md'));

  return { directory, claudeMd, agentsMd };
}

export async function deleteProjectConfigFile(
  sessionId: string,
  file: 'claude' | 'agents'
): Promise<ProjectConfig> {
  const directory = await resolveSessionDirectory(sessionId);

  const fileName = file === 'claude' ? 'CLAUDE.md' : 'AGENTS.md';
  try {
    await unlink(join(directory, fileName));
  } catch (err: any) {
    if (err.code !== 'ENOENT') throw err;
  }

  const claudeMd = await readFileOrNull(join(directory, 'CLAUDE.md'));
  const agentsMd = await readFileOrNull(join(directory, 'AGENTS.md'));

  return { directory, claudeMd, agentsMd };
}

// --- Debug Logs ---

export interface DebugLogResult {
  lines: string[];
  categories: string[];
  levels: string[];
}

export async function getDebugLogs(
  sessionId: string,
  filters?: { search?: string; level?: string; category?: string }
): Promise<DebugLogResult> {
  const logPath = join(config.debugDir, `${sessionId}.log`);

  if (!existsSync(logPath)) {
    return { lines: [], categories: [], levels: [] };
  }

  const content = await readFile(logPath, 'utf-8');
  const allLines = content.split('\n').filter(l => l.trim());

  // Extract all unique levels and categories from the full file
  const allLevels = new Set<string>();
  const allCategories = new Set<string>();

  for (const line of allLines) {
    const levelMatch = line.match(/\[(DEBUG|WARN|ERROR)\]/);
    if (levelMatch) allLevels.add(levelMatch[1]);

    // Category is the second bracket tag after the level
    const categoryMatch = line.match(/\[(?:DEBUG|WARN|ERROR)\]\s*\[([^\]]+)\]/);
    if (categoryMatch) allCategories.add(categoryMatch[1]);
  }

  // Apply filters
  let filtered = allLines;

  if (filters?.level) {
    const levels = filters.level.split(',').map(l => l.trim().toUpperCase());
    filtered = filtered.filter(line => {
      const m = line.match(/\[(DEBUG|WARN|ERROR)\]/);
      return m && levels.includes(m[1]);
    });
  }

  if (filters?.category) {
    const categories = filters.category.split(',').map(c => c.trim());
    filtered = filtered.filter(line => {
      const m = line.match(/\[(?:DEBUG|WARN|ERROR)\]\s*\[([^\]]+)\]/);
      return m && categories.includes(m[1]);
    });
  }

  if (filters?.search) {
    const term = filters.search.toLowerCase();
    filtered = filtered.filter(line => line.toLowerCase().includes(term));
  }

  return {
    lines: filtered,
    categories: Array.from(allCategories).sort(),
    levels: Array.from(allLevels).sort(),
  };
}

export async function deleteDebugLog(sessionId: string): Promise<boolean> {
  const logPath = join(config.debugDir, `${sessionId}.log`);
  try {
    await unlink(logPath);
    return true;
  } catch {
    return false;
  }
}

export async function clearAllDebugLogs(): Promise<number> {
  const { readdirSync, unlinkSync } = await import('fs');
  const dir = config.debugDir;
  if (!existsSync(dir)) return 0;

  let count = 0;
  try {
    const files = readdirSync(dir).filter(f => f.endsWith('.log'));
    for (const file of files) {
      try {
        unlinkSync(join(dir, file));
        count++;
      } catch {}
    }
  } catch {}
  return count;
}
