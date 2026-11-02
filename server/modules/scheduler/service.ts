import { spawn } from 'child_process';
import { getDb } from '../../db/connection';
import { generateId } from '../../shared/utils/uuid';
import { getProfilePath } from '../profiles/service';
import {
  ScheduledTask,
  ScheduledTaskRow,
  TaskRun,
  TaskRunRow,
  TaskWithRuns,
  CreateTaskInput,
  UpdateTaskInput,
} from './types';
import { createNotification } from '../notifications/service';
import { NotificationBroadcaster } from '../notifications/websocket';

function rowToTask(row: ScheduledTaskRow): ScheduledTask {
  return {
    ...row,
    enabled: Boolean(row.enabled),
  };
}

function rowToRun(row: TaskRunRow): TaskRun {
  return {
    ...row,
    status: row.status as TaskRun['status'],
  };
}

export function listTasks(): ScheduledTask[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM scheduled_tasks ORDER BY created_at DESC')
    .all() as ScheduledTaskRow[];
  return rows.map(rowToTask);
}

export function getTask(id: string): TaskWithRuns | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM scheduled_tasks WHERE id = ?')
    .get(id) as ScheduledTaskRow | undefined;
  if (!row) return null;

  const runs = db
    .prepare('SELECT * FROM scheduled_task_runs WHERE task_id = ? ORDER BY started_at DESC LIMIT 20')
    .all(id) as TaskRunRow[];

  return {
    ...rowToTask(row),
    recent_runs: runs.map(rowToRun),
  };
}

export function createTask(input: CreateTaskInput): ScheduledTask {
  const db = getDb();
  const id = generateId();
  const now = new Date().toISOString();

  db.prepare(
    'INSERT INTO scheduled_tasks (id, name, description, prompt, cron_expression, scheduled_at, directory, profile, session_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    id,
    input.name,
    input.description ?? '',
    input.prompt,
    input.cron_expression,
    input.scheduled_at ?? null,
    input.directory,
    input.profile ?? '',
    input.session_id ?? null,
    now,
    now
  );

  return rowToTask(
    db.prepare('SELECT * FROM scheduled_tasks WHERE id = ?').get(id) as ScheduledTaskRow
  );
}

export function updateTask(id: string, input: UpdateTaskInput): ScheduledTask | null {
  const db = getDb();
  const existing = db
    .prepare('SELECT * FROM scheduled_tasks WHERE id = ?')
    .get(id) as ScheduledTaskRow | undefined;
  if (!existing) return null;

  const now = new Date().toISOString();
  const name = input.name ?? existing.name;
  const description = input.description ?? existing.description;
  const prompt = input.prompt ?? existing.prompt;
  const cron_expression = input.cron_expression ?? existing.cron_expression;
  const directory = input.directory ?? existing.directory;
  const profile = input.profile ?? existing.profile;
  const scheduled_at = input.scheduled_at !== undefined ? input.scheduled_at : existing.scheduled_at;
  const session_id = input.session_id !== undefined ? input.session_id : existing.session_id;
  const enabled = input.enabled !== undefined ? (input.enabled ? 1 : 0) : existing.enabled;

  db.prepare(
    'UPDATE scheduled_tasks SET name = ?, description = ?, prompt = ?, cron_expression = ?, scheduled_at = ?, directory = ?, profile = ?, session_id = ?, enabled = ?, updated_at = ? WHERE id = ?'
  ).run(name, description, prompt, cron_expression, scheduled_at, directory, profile, session_id, enabled, now, id);

  return rowToTask(
    db.prepare('SELECT * FROM scheduled_tasks WHERE id = ?').get(id) as ScheduledTaskRow
  );
}

export function deleteTask(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM scheduled_tasks WHERE id = ?').run(id);
  return result.changes > 0;
}

export function listRuns(taskId: string): TaskRun[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM scheduled_task_runs WHERE task_id = ? ORDER BY started_at DESC LIMIT 50')
    .all(taskId) as TaskRunRow[];
  return rows.map(rowToRun);
}

// Track Claude session IDs spawned by the scheduler so hook handler can ignore them
const activeSchedulerSessions = new Set<string>();

export function isSchedulerSession(claudeSessionId: string): boolean {
  return activeSchedulerSessions.has(claudeSessionId);
}

export function executeTask(task: ScheduledTask): string {
  const db = getDb();
  const runId = generateId();
  const now = new Date().toISOString();

  // Each run gets its own fresh session ID so hooks can identify scheduler processes
  const claudeSessionId = generateId();
  activeSchedulerSessions.add(claudeSessionId);

  const args = ['--session-id', claudeSessionId, '-p', task.prompt, '--dangerously-skip-permissions', '--output-format', 'json'];

  const env = { ...process.env };
  if (task.profile) {
    const profileDir = getProfilePath(task.profile);
    if (profileDir) env.CLAUDE_CONFIG_DIR = profileDir;
  }

  const fullCommand = `claude ${args.map(a => `'${a}'`).join(' ')}`;

  db.prepare(
    'INSERT INTO scheduled_task_runs (id, task_id, started_at, command, status) VALUES (?, ?, ?, ?, ?)'
  ).run(runId, task.id, now, fullCommand, 'running');

  NotificationBroadcaster.getInstance().broadcastEvent({
    type: 'scheduler',
    event: 'task_started',
    taskId: task.id,
    runId,
  });

  const child = spawn('claude', args, {
    cwd: task.directory,
    timeout: 600000,
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
  child.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

  child.on('error', (err) => {
    activeSchedulerSessions.delete(claudeSessionId);
    const finishedAt = new Date().toISOString();
    db.prepare(
      'UPDATE scheduled_task_runs SET finished_at = ?, exit_code = ?, output = ?, status = ? WHERE id = ?'
    ).run(finishedAt, 1, err.message, 'failed', runId);

    NotificationBroadcaster.getInstance().broadcastEvent({
      type: 'scheduler',
      event: 'task_failed',
      taskId: task.id,
      runId,
    });
  });

  child.on('close', (code) => {
    activeSchedulerSessions.delete(claudeSessionId);
    const finishedAt = new Date().toISOString();
    const exitCode = code ?? 1;
    const status = exitCode === 0 ? 'completed' : 'failed';

    let tokensIn = 0;
    let tokensOut = 0;
    let costUsd = 0;
    let output = stdout || stderr || '';

    try {
      const parsed = JSON.parse(stdout);
      if (parsed.result) output = parsed.result;
      if (parsed.usage) {
        tokensIn = parsed.usage.input_tokens ?? 0;
        tokensOut = parsed.usage.output_tokens ?? 0;
      }
      if (parsed.cost_usd !== undefined) costUsd = parsed.cost_usd;
    } catch {
      // stdout wasn't JSON, use raw output
    }

    db.prepare(
      'UPDATE scheduled_task_runs SET finished_at = ?, exit_code = ?, output = ?, tokens_in = ?, tokens_out = ?, cost_usd = ?, status = ? WHERE id = ?'
    ).run(finishedAt, exitCode, output, tokensIn, tokensOut, costUsd, status, runId);

    NotificationBroadcaster.getInstance().broadcastEvent({
      type: 'scheduler',
      event: status === 'completed' ? 'task_completed' : 'task_failed',
      taskId: task.id,
      runId,
    });

    // Emit notification with cost/token details
    try {
      let message: string;
      if (exitCode === 0) {
        const parts: string[] = [];
        if (costUsd > 0) parts.push(`$${costUsd.toFixed(3)}`);
        const totalTokens = tokensIn + tokensOut;
        if (totalTokens > 0) {
          const display = totalTokens >= 1000
            ? `${(totalTokens / 1000).toFixed(1)}k`
            : String(totalTokens);
          parts.push(`${display} tokens`);
        }
        message = parts.length > 0 ? parts.join(', ') : 'Completed successfully';
      } else {
        // First meaningful line of output for failed tasks
        const firstLine = output.split('\n').find(l => l.trim().length > 0) ?? '';
        const snippet = firstLine.length > 100 ? firstLine.slice(0, 100) + '...' : firstLine;
        message = snippet ? `Exit ${exitCode}: ${snippet}` : `Exit code: ${exitCode}`;
      }

      const preview = output.length > 500 ? output.slice(-500).trim() : output.trim();

      createNotification({
        type: exitCode === 0 ? 'task_completed' : 'task_failed',
        urgency: exitCode === 0 ? 'info' : 'warning',
        category: 'task',
        title: `${task.name} — ${exitCode === 0 ? 'completed' : 'failed'}`,
        message,
        source: task.name,
        source_id: task.id,
        preview,
      });
    } catch {
      // Don't let notification failure affect task execution
    }
  });

  return runId;
}
