import { Router, Request, Response } from 'express';
import * as promptService from './service';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const search = req.query.search as string | undefined;
  const tag = req.query.tag as string | undefined;
  const prompts = promptService.listPrompts(search, tag);
  res.json({ data: prompts });
});

router.get('/:id', (req: Request, res: Response) => {
  const prompt = promptService.getPrompt(req.params.id as string);
  if (!prompt) {
    res.status(404).json({ error: 'Prompt not found' });
    return;
  }
  res.json({ data: prompt });
});

router.post('/', (req: Request, res: Response) => {
  const { title, content, notes, tags } = req.body;
  if (!title || typeof title !== 'string') {
    res.status(400).json({ error: 'Title is required' });
    return;
  }
  const prompt = promptService.createPrompt({ title, content, notes, tags });
  res.status(201).json({ data: prompt });
});

router.put('/:id', (req: Request, res: Response) => {
  const { title, content, notes, tags } = req.body;
  const prompt = promptService.updatePrompt(req.params.id as string, {
    title,
    content,
    notes,
    tags,
  });
  if (!prompt) {
    res.status(404).json({ error: 'Prompt not found' });
    return;
  }
  res.json({ data: prompt });
});

router.delete('/:id', (req: Request, res: Response) => {
  const deleted = promptService.deletePrompt(req.params.id as string);
  if (!deleted) {
    res.status(404).json({ error: 'Prompt not found' });
    return;
  }
  res.json({ data: { success: true } });
});

router.get('/:id/versions', (req: Request, res: Response) => {
  const versions = promptService.listVersions(req.params.id as string);
  res.json({ data: versions });
});

router.post('/:id/versions/:versionId/restore', (req: Request, res: Response) => {
  const prompt = promptService.restoreVersion(
    req.params.id as string,
    req.params.versionId as string
  );
  if (!prompt) {
    res.status(404).json({ error: 'Prompt or version not found' });
    return;
  }
  res.json({ data: prompt });
});

router.post('/:id/enhance', async (req: Request, res: Response) => {
  const { profile } = req.body;
  try {
    const result = await promptService.enhancePrompt(req.params.id as string, profile);
    res.json({ data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Enhancement failed';
    if (message === 'Prompt not found') {
      res.status(404).json({ error: message });
    } else {
      res.status(500).json({ error: message });
    }
  }
});

export default router;
