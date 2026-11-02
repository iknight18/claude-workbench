import { Router, Request, Response } from 'express';
import { TerminalManager } from './manager';

const router = Router();

router.get('/active', (_req: Request, res: Response) => {
  const manager = TerminalManager.getInstance();
  const sessionIds = manager.getActiveSessionIds();
  res.json({ data: sessionIds });
});

router.get('/:sessionId/preview', (req: Request, res: Response) => {
  const manager = TerminalManager.getInstance();
  const sessionId = req.params.sessionId as string;
  const preview = manager.getRecentOutput(sessionId, 200);
  if (preview === null) {
    res.json({ data: { lines: [], running: false } });
    return;
  }
  const lines = preview.split('\n').filter(l => l.trim()).slice(-3);
  res.json({ data: { lines, running: true } });
});

export default router;
