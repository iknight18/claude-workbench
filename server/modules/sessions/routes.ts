import { Router, Request, Response } from 'express';
import * as sessionService from './service';
import { TerminalManager } from '../terminal/manager';
import { generateId } from '../../shared/utils/uuid';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const search = req.query.search as string | undefined;
  const tag = req.query.tag as string | undefined;
  const status = req.query.status as string | undefined;
  const sessions = sessionService.listSessions(search, tag, status);
  res.json({ data: sessions });
});

router.get('/directories', (_req: Request, res: Response) => {
  const directories = sessionService.listDirectories();
  res.json({ data: directories });
});

router.get('/groups', (_req: Request, res: Response) => {
  const groups = sessionService.listGroups();
  res.json({ data: groups });
});

router.get('/tags', (_req: Request, res: Response) => {
  const tags = sessionService.listSessionTags();
  res.json({ data: tags });
});

// Clear all debug logs
router.delete('/debug-logs/all', async (_req: Request, res: Response) => {
  const count = await sessionService.clearAllDebugLogs();
  res.json({ data: { cleared: count } });
});

// Session tasks — active across all running sessions (for activity center)
router.get('/tasks/active', (_req: Request, res: Response) => {
  const activeTasks = sessionService.getActiveSessionTasks();
  res.json({ data: activeTasks });
});

router.get('/:id', (req: Request, res: Response) => {
  const session = sessionService.getSession(req.params.id as string);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.json({ data: session });
});

router.get('/:id/debug-logs', async (req: Request, res: Response) => {
  const session = sessionService.getSession(req.params.id as string);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const search = req.query.search as string | undefined;
  const level = req.query.level as string | undefined;
  const category = req.query.category as string | undefined;

  const result = await sessionService.getDebugLogs(req.params.id as string, {
    search,
    level,
    category,
  });

  res.json({ data: result });
});

router.post('/', (req: Request, res: Response) => {
  const { name, directory, profile, skip_permissions, group, notes, tags } = req.body;
  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'Name is required' });
    return;
  }
  const session = sessionService.createSession({ name, directory, profile, skip_permissions, group, notes, tags });
  res.status(201).json({ data: session });
});

router.put('/:id', (req: Request, res: Response) => {
  const { name, directory, status, profile, skip_permissions, debug_enabled, group, notes, tags } = req.body;
  try {
    const session = sessionService.updateSession(req.params.id as string, {
      name,
      directory,
      status,
      profile,
      skip_permissions,
      debug_enabled,
      group,
      notes,
      tags,
    });
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json({ data: session });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.delete('/:id', (req: Request, res: Response) => {
  // Kill any running terminal for this session
  const manager = TerminalManager.getInstance();
  if (manager.get(req.params.id as string)) {
    manager.kill(req.params.id as string);
  }

  // If session had hooks enabled, check if we should clean up the project hooks file
  const session = sessionService.getSession(req.params.id as string);
  if (session?.hooks_enabled && session.directory) {
    const othersWithHooks = sessionService.countSessionsWithHooksInDirectory(session.directory, session.id);
    if (othersWithHooks === 0) {
      const { disableProjectHooks } = require('../notifications/hooks');
      disableProjectHooks(session.directory);
    }
  }

  const deleted = sessionService.deleteSession(req.params.id as string);
  if (!deleted) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.json({ data: { success: true } });
});

// Terminal lifecycle routes
router.post('/:id/terminal', (req: Request, res: Response) => {
  const session = sessionService.getSession(req.params.id as string);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  if (!session.directory) {
    res.status(400).json({ error: 'Session has no directory set' });
    return;
  }

  const manager = TerminalManager.getInstance();
  const existing = manager.get(req.params.id as string);
  if (existing?.alive) {
    res.status(409).json({ error: 'Terminal already running for this session' });
    return;
  }

  // Clean up dead terminal if exists
  if (existing && !existing.alive) {
    manager.kill(req.params.id as string);
  }

  try {
    const sid = req.params.id as string;
    const profile = session.profile || '';
    const existingClaudeSessionId = sessionService.getClaudeSessionId(sid, profile);
    const isFirstRun = !existingClaudeSessionId;

    // Generate a new Claude session UUID on first run for this profile, reuse on subsequent runs
    const claudeSessionId = existingClaudeSessionId || generateId();
    if (isFirstRun) {
      sessionService.setClaudeSessionId(sid, profile, claudeSessionId);
    }

    manager.create({
      sessionId: sid,
      sessionName: session.name,
      directory: session.directory,
      profile: session.profile,
      skipPermissions: session.skip_permissions,
      debugEnabled: session.debug_enabled,
      claudeSessionId,
      resume: !isFirstRun,
    });

    res.json({ data: { status: 'running' } });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.delete('/:id/terminal', (req: Request, res: Response) => {
  const manager = TerminalManager.getInstance();
  const instance = manager.get(req.params.id as string);
  if (!instance) {
    res.status(404).json({ error: 'No terminal running for this session' });
    return;
  }
  manager.kill(req.params.id as string);
  res.json({ data: { success: true } });
});

router.get('/:id/terminal/status', (req: Request, res: Response) => {
  const manager = TerminalManager.getInstance();
  const instance = manager.get(req.params.id as string);
  res.json({ data: { running: instance?.alive ?? false } });
});

router.post('/:id/terminal/input', (req: Request, res: Response) => {
  const { data } = req.body;
  if (typeof data !== 'string') {
    res.status(400).json({ error: 'data is required and must be a string' });
    return;
  }

  const manager = TerminalManager.getInstance();
  const instance = manager.get(req.params.id as string);
  if (!instance?.alive) {
    res.status(404).json({ error: 'No active terminal for this session' });
    return;
  }

  manager.write(req.params.id as string, data + '\r');
  res.json({ data: { success: true } });
});

// Toggle hooks for session
router.post('/:id/hooks', (req: Request, res: Response) => {
  const { enabled } = req.body;
  const session = sessionService.getSession(req.params.id as string);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  if (!session.directory) {
    res.status(400).json({ error: 'Session has no directory' });
    return;
  }

  const { enableProjectHooks, disableProjectHooks } = require('../notifications/hooks');

  // Update DB first so the count query below reflects current state
  sessionService.updateSession(session.id, { hooks_enabled: enabled });

  if (enabled) {
    enableProjectHooks(session.directory);
  } else {
    // Only remove hooks from disk if no other active session in this directory wants them
    const othersWithHooks = sessionService.countSessionsWithHooksInDirectory(session.directory, session.id);
    if (othersWithHooks === 0) {
      disableProjectHooks(session.directory);
    }
  }
  res.json({ data: { success: true, hooks_enabled: enabled } });
});

// Project config routes (CLAUDE.md / AGENTS.md in session directory)
router.get('/:id/project-config', async (req: Request, res: Response) => {
  try {
    const config = await sessionService.getProjectConfig(req.params.id as string);
    res.json({ data: config });
  } catch (err: any) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

router.put('/:id/project-config', async (req: Request, res: Response) => {
  const { claudeMd, agentsMd } = req.body;
  if (claudeMd === undefined && agentsMd === undefined) {
    res.status(400).json({ error: 'At least one of claudeMd or agentsMd is required' });
    return;
  }
  try {
    const config = await sessionService.writeProjectConfig(req.params.id as string, { claudeMd, agentsMd });
    res.json({ data: config });
  } catch (err: any) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

router.delete('/:id/project-config', async (req: Request, res: Response) => {
  const file = req.query.file as string;
  if (file !== 'claude' && file !== 'agents') {
    res.status(400).json({ error: 'Query param file must be "claude" or "agents"' });
    return;
  }
  try {
    const config = await sessionService.deleteProjectConfigFile(req.params.id as string, file);
    res.json({ data: config });
  } catch (err: any) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

// Session task routes
router.get('/:id/tasks', (req: Request, res: Response) => {
  const tasks = sessionService.listSessionTasks(req.params.id as string);
  res.json({ data: tasks });
});

router.delete('/:id/tasks', (req: Request, res: Response) => {
  const cleared = sessionService.clearSessionTasks(req.params.id as string);
  res.json({ data: { cleared } });
});

// Debug log routes
router.delete('/:id/debug-logs', async (req: Request, res: Response) => {
  const deleted = await sessionService.deleteDebugLog(req.params.id as string);
  res.json({ data: { success: deleted } });
});

export default router;

