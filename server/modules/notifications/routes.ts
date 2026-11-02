import { Router, Request, Response } from 'express';
import * as service from './service';
import * as hooks from './hooks';
import { HookPayload } from './types';
import { TerminalManager } from '../terminal/manager';
import { getDb } from '../../db/connection';
import { upsertSessionTask } from '../sessions/service';
import { isSchedulerSession } from '../scheduler/service';

function resolveSessionId(payload: HookPayload): string | null {
  // Ignore hooks from scheduler-spawned Claude processes
  if (payload.session_id && isSchedulerSession(payload.session_id)) return null;

  const manager = TerminalManager.getInstance();
  const db = getDb();

  // Look up Claude's session UUID in session_profile_claude_ids to find dashboard session ID
  if (payload.session_id) {
    const row = db.prepare(
      'SELECT session_id FROM session_profile_claude_ids WHERE claude_session_id = ?'
    ).get(payload.session_id) as { session_id: string } | undefined;
    if (row && manager.get(row.session_id)) return row.session_id;
  }

  // Fall back to directory lookup — pick the session that has a running terminal
  if (payload.cwd) {
    const rows = db.prepare('SELECT id FROM sessions WHERE directory = ?').all(payload.cwd) as { id: string }[];
    for (const row of rows) {
      if (manager.get(row.id)) return row.id;
    }
  }
  return null;
}

function getPreview(payload: HookPayload): string {
  // Only use last_assistant_message from hook payload — no buffer fallback
  if (payload.last_assistant_message) {
    const msg = payload.last_assistant_message;
    return msg.length > 500 ? msg.slice(-500).trim() : msg.trim();
  }
  return '';
}

const router = Router();

// List notifications
router.get('/', (req: Request, res: Response) => {
  const unread = req.query.unread === 'true';
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const notifications = service.listNotifications({ unread, limit });
  res.json({ data: notifications });
});

// Unread count
router.get('/unread-count', (_req: Request, res: Response) => {
  const count = service.getUnreadCount();
  res.json({ data: { count } });
});

// Create notification directly (for client-generated summaries)
router.post('/create', (req: Request, res: Response) => {
  const { type, urgency, category, title, message, source, source_id, task_subject, task_status } = req.body;
  if (!type || !title) {
    res.status(400).json({ error: 'type and title are required' });
    return;
  }
  const notification = service.createNotification({
    type, urgency, category, title, message, source, source_id, task_subject, task_status,
  });
  res.json({ data: notification });
});

// Receive Claude hook POST
router.post('/hook', (req: Request, res: Response) => {
  const payload = req.body as HookPayload;
  const eventName = payload.hook_event_name;

  if (!eventName) {
    res.status(400).json({ error: 'Missing hook_event_name' });
    return;
  }

  // Resolve dashboard session ID from Claude's session UUID
  const dashboardSessionId = resolveSessionId(payload);

  // Ignore hooks from processes not managed by the dashboard (e.g. scheduled tasks in hooked dirs)
  if (!dashboardSessionId) {
    res.json({ data: { received: true, ignored: true } });
    return;
  }

  // Use session name if resolved, fall back to directory basename
  let source = payload.cwd ? require('path').basename(payload.cwd) : 'Unknown session';
  const sessionRow = getDb().prepare('SELECT name FROM sessions WHERE id = ?').get(dashboardSessionId) as { name: string } | undefined;
  if (sessionRow?.name) source = sessionRow.name;
  const sourceId = dashboardSessionId;

  const preview = getPreview(payload);

  if (eventName === 'Stop') {
    service.createNotification({
      type: 'session_stopped',
      urgency: 'info',
      category: 'session',
      title: `${source} — finished`,
      message: payload.tool_name
        ? `Last action: ${payload.tool_name}`
        : 'Response complete',
      source,
      source_id: sourceId,
      preview,
    });
  } else if (eventName === 'Notification') {
    if (payload.notification_type === 'permission_prompt') {
      const toolName = payload.tool_name ?? 'unknown tool';
      let detail = `Wants to use: ${toolName}`;
      if (payload.tool_input) {
        if (payload.tool_input.command) {
          const cmd = payload.tool_input.command.length > 80
            ? payload.tool_input.command.slice(0, 80) + '...'
            : payload.tool_input.command;
          detail = `${toolName}: ${cmd}`;
        } else if (payload.tool_input.file_path) {
          detail = `${toolName}: ${payload.tool_input.file_path}`;
        }
      }
      service.createNotification({
        type: 'session_permission',
        urgency: 'action',
        category: 'session',
        title: `${source} — needs approval`,
        message: detail,
        source,
        source_id: sourceId,
        preview,
      });
    } else if (payload.notification_type === 'idle_prompt') {
      service.createNotification({
        type: 'session_idle',
        urgency: 'action',
        category: 'session',
        title: `${source} — waiting for input`,
        message: 'Session is idle and ready for your next prompt',
        source,
        source_id: sourceId,
        preview,
      });
    }
  } else if (eventName === 'TaskCreated') {
    const subject = payload.task_subject ?? 'Untitled task';
    const status = payload.task_status ?? 'pending';
    upsertSessionTask(dashboardSessionId, subject, status as 'pending' | 'in_progress' | 'completed');
  } else if (eventName === 'TaskCompleted') {
    const subject = payload.task_subject ?? 'Untitled task';
    upsertSessionTask(dashboardSessionId, subject, 'completed');
  }

  res.json({ data: { received: true } });
});

// Mark all as read (must be before /:id/read to avoid conflict)
router.put('/read-all', (_req: Request, res: Response) => {
  const count = service.markAllRead();
  res.json({ data: { updated: count } });
});

// Mark one as read
router.put('/:id/read', (req: Request, res: Response) => {
  const success = service.markRead(req.params.id as string);
  if (!success) {
    res.status(404).json({ error: 'Notification not found' });
    return;
  }
  res.json({ data: { success: true } });
});

// Clear all (must be before /:id to avoid conflict)
router.delete('/clear', (_req: Request, res: Response) => {
  const count = service.clearAll();
  res.json({ data: { cleared: count } });
});

// Delete one
router.delete('/:id', (req: Request, res: Response) => {
  const success = service.deleteNotification(req.params.id as string);
  if (!success) {
    res.status(404).json({ error: 'Notification not found' });
    return;
  }
  res.json({ data: { success: true } });
});

// Hook management
router.get('/hooks/status', (_req: Request, res: Response) => {
  const status = hooks.getHooksStatus();
  res.json({ data: status });
});

router.post('/hooks/enable/:profile', (req: Request, res: Response) => {
  const success = hooks.enableHooks(req.params.profile as string);
  if (!success) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }
  res.json({ data: { success: true } });
});

router.post('/hooks/disable/:profile', (req: Request, res: Response) => {
  const success = hooks.disableHooks(req.params.profile as string);
  if (!success) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }
  res.json({ data: { success: true } });
});

export default router;
