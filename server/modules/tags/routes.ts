import { Router, Request, Response } from 'express';
import * as tagService from './service';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const tags = tagService.listTags();
  res.json({ data: tags });
});

export default router;
