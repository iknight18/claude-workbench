import { Router, Request, Response } from 'express';
import { readdirSync, mkdirSync, existsSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { config } from '../../config';

const router = Router();

// Default browse: /workspace in Docker, WORKSPACE_HOST_PATH locally, fallback to homedir
const defaultBrowsePath = config.isDocker ? '/workspace' : (config.workspaceHostPath || homedir());

router.get('/browse', (req: Request, res: Response) => {
  const requestedPath = (req.query.path as string) || defaultBrowsePath;

  try {
    const resolved = path.resolve(requestedPath);
    const entries = readdirSync(resolved, { withFileTypes: true });
    const directories = entries
      .filter(e => {
        if (!e.isDirectory()) return false;
        // Skip hidden directories and common noise
        if (e.name.startsWith('.')) return false;
        if (e.name === 'node_modules') return false;
        if (e.name === '$RECYCLE.BIN') return false;
        if (e.name === 'System Volume Information') return false;
        return true;
      })
      .map(e => e.name)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    const parent = path.dirname(resolved);

    res.json({
      data: {
        current: resolved,
        parent: parent !== resolved ? parent : null,
        directories,
      },
    });
  } catch (err) {
    res.status(400).json({ error: `Cannot read directory: ${requestedPath}` });
  }
});

router.post('/mkdir', (req: Request, res: Response) => {
  const { path: dirPath } = req.body;
  if (!dirPath || typeof dirPath !== 'string') {
    res.status(400).json({ error: 'Path is required' });
    return;
  }

  try {
    const resolved = path.resolve(dirPath);
    if (existsSync(resolved)) {
      res.status(400).json({ error: 'Directory already exists' });
      return;
    }
    mkdirSync(resolved, { recursive: true });
    res.status(201).json({ data: { path: resolved } });
  } catch {
    res.status(400).json({ error: `Cannot create directory: ${dirPath}` });
  }
});

export default router;
