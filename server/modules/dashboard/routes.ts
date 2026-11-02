import { Router, Request, Response } from 'express';
import * as dashboardService from './service';

const router = Router();

router.get('/stats', (_req: Request, res: Response) => {
  const stats = dashboardService.getStats();
  res.json({ data: stats });
});

export default router;
