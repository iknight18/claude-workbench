import { Router, Request, Response } from 'express';
import * as skillService from './service';

const router = Router();

// Search skills.sh
router.get('/search', async (req: Request, res: Response) => {
  const query = req.query.q as string;
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

  if (!query) {
    res.json({ data: { skills: [] } });
    return;
  }

  try {
    const result = await skillService.searchSkills(query, limit);
    res.json({ data: result });
  } catch (err) {
    res.status(502).json({ error: `Search failed: ${(err as Error).message}` });
  }
});

// Resolve skills from GitHub repo
router.get('/resolve', async (req: Request, res: Response) => {
  const source = req.query.source as string;

  if (!source) {
    res.status(400).json({ error: 'source parameter is required' });
    return;
  }

  try {
    const skills = await skillService.resolveSkills(source);
    res.json({ data: { skills } });
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes('404')) {
      res.status(404).json({ error: 'Repository not found' });
    } else if (message.includes('403')) {
      res.status(429).json({ error: 'GitHub rate limit reached, try again later' });
    } else {
      res.status(502).json({ error: `Resolve failed: ${message}` });
    }
  }
});

// Install skill to profile or project
router.post('/install', async (req: Request, res: Response) => {
  const { profileId, source, skillName, skillPath, branch, files, target, directory } = req.body;

  if (!source || !skillName || !branch || !files?.length) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  if (target === 'project' && !directory) {
    res.status(400).json({ error: 'directory is required for project installation' });
    return;
  }

  if (target !== 'project' && !profileId) {
    res.status(400).json({ error: 'profileId is required for profile installation' });
    return;
  }

  try {
    const result = await skillService.installSkill({
      profileId,
      source,
      skillName,
      skillPath: skillPath || '',
      branch,
      files,
      target,
      directory,
    });
    res.json({ data: result });
  } catch (err) {
    const message = (err as Error).message;
    if (message === 'Profile not found') {
      res.status(404).json({ error: message });
    } else {
      res.status(500).json({ error: `Install failed: ${message}` });
    }
  }
});

// Uninstall skill from profile or project
router.delete('/uninstall', async (req: Request, res: Response) => {
  const { profileId, skillName, target, directory } = req.body;

  if (!skillName) {
    res.status(400).json({ error: 'skillName is required' });
    return;
  }

  try {
    skillService.uninstallSkill({ profileId, skillName, target, directory });
    res.json({ data: { success: true } });
  } catch (err) {
    const message = (err as Error).message;
    if (message === 'Profile not found' || message === 'Skill not found') {
      res.status(404).json({ error: message });
    } else {
      res.status(500).json({ error: `Uninstall failed: ${message}` });
    }
  }
});

// Get project-level skills
router.get('/project', (req: Request, res: Response) => {
  const directory = req.query.directory as string;
  if (!directory) {
    res.status(400).json({ error: 'directory is required' });
    return;
  }
  const skills = skillService.getProjectSkills(directory);
  res.json({ data: skills });
});

// Read installed skill content
router.get('/content', (req: Request, res: Response) => {
  const filePath = req.query.filePath as string;

  if (!filePath) {
    res.status(400).json({ error: 'filePath is required' });
    return;
  }

  try {
    const content = skillService.readSkillContent(filePath);
    res.json({ data: { content } });
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes('not found')) {
      res.status(404).json({ error: message });
    } else {
      res.status(500).json({ error: message });
    }
  }
});

// Write installed skill content
router.put('/content', (req: Request, res: Response) => {
  const { filePath, content } = req.body;

  if (!filePath || content === undefined) {
    res.status(400).json({ error: 'filePath and content are required' });
    return;
  }

  try {
    skillService.writeSkillContent(filePath, content);
    res.json({ data: { success: true } });
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes('not found')) {
      res.status(404).json({ error: message });
    } else {
      res.status(500).json({ error: message });
    }
  }
});

// Preview skill content from GitHub (browse mode)
router.get('/preview', async (req: Request, res: Response) => {
  const source = req.query.source as string;
  const branch = req.query.branch as string;
  const skillPath = (req.query.skillPath as string) || '';

  if (!source || !branch) {
    res.status(400).json({ error: 'source and branch are required' });
    return;
  }

  try {
    const content = await skillService.previewSkillContent(source, branch, skillPath);
    res.json({ data: { content } });
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes('404')) {
      res.status(404).json({ error: 'Skill file not found' });
    } else {
      res.status(502).json({ error: `Preview failed: ${message}` });
    }
  }
});

export default router;
