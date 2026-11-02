import { Router, Request, Response } from 'express';
import * as service from './service';
import { registerJob, registerOnceJob, cancelJob } from './engine';
import { getDb } from '../../db/connection';

const router = Router();

router.get('/tasks', (_req: Request, res: Response) => {
  const tasks = service.listTasks();
  res.json({ data: tasks });
});

router.get('/tasks/running', (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT t.id, t.name, r.started_at
    FROM scheduled_tasks t
    JOIN scheduled_task_runs r ON r.task_id = t.id
    WHERE r.status = 'running'
    ORDER BY r.started_at DESC
  `).all() as { id: string; name: string; started_at: string }[];
  res.json({ data: rows });
});

router.get('/tasks/:id', (req: Request, res: Response) => {
  const task = service.getTask(req.params.id as string);
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }
  res.json({ data: task });
});

router.post('/tasks', (req: Request, res: Response) => {
  const { name, description, prompt, cron_expression, scheduled_at, directory, profile, session_id } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }

  const task = service.createTask({
    name,
    description,
    prompt: prompt ?? '',
    cron_expression: cron_expression || '',
    scheduled_at: scheduled_at || null,
    directory: directory ?? '',
    profile,
    session_id,
  });

  if (task.enabled && task.scheduled_at) {
    registerOnceJob(task);
  } else if (task.enabled && task.cron_expression) {
    registerJob(task);
  }

  res.status(201).json({ data: task });
});

router.put('/tasks/:id', (req: Request, res: Response) => {
  const { name, description, prompt, cron_expression, scheduled_at, directory, profile, session_id, enabled } = req.body;

  const task = service.updateTask(req.params.id as string, {
    name,
    description,
    prompt,
    cron_expression,
    scheduled_at,
    directory,
    profile,
    session_id,
    enabled,
  });

  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  cancelJob(task.id);
  if (task.enabled && task.scheduled_at) {
    registerOnceJob(task);
  } else if (task.enabled && task.cron_expression) {
    registerJob(task);
  }

  res.json({ data: task });
});

router.delete('/tasks/:id', (req: Request, res: Response) => {
  cancelJob(req.params.id as string);
  const deleted = service.deleteTask(req.params.id as string);
  if (!deleted) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }
  res.json({ data: { success: true } });
});

router.post('/tasks/:id/run', (req: Request, res: Response) => {
  const task = service.getTask(req.params.id as string);
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  const runId = service.executeTask(task);
  res.json({ data: { runId, status: 'started' } });
});

router.get('/tasks/:id/runs', (req: Request, res: Response) => {
  const runs = service.listRuns(req.params.id as string);
  res.json({ data: runs });
});

export default router;
