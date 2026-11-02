import { Router, Request, Response } from 'express';
import * as processService from './service';

const router = Router();

router.get('/claude', (_req: Request, res: Response) => {
  const processes = processService.scanClaudeProcesses();
  res.json({ data: processes });
});

router.post('/claude/kill', (req: Request, res: Response) => {
  const { pids } = req.body ?? {};
  const result = processService.killClaudeProcesses(
    Array.isArray(pids) ? pids : undefined
  );
  res.json({ data: result });
});

export default router;
