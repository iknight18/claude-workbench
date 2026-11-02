import path from 'path';
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'fs';
import { getDb } from '../../db/connection';
import type { ProfileRow } from '../profiles/types';
import type { SearchResponse, ResolvedSkill, InstallRequest, UninstallRequest } from './types';

const SKILLS_API = 'https://skills.sh/api';
const GITHUB_API = 'https://api.github.com';
const GITHUB_RAW = 'https://raw.githubusercontent.com';

const EXCLUDED_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '__pycache__']);

export async function searchSkills(query: string, limit: number = 10): Promise<SearchResponse> {
  const url = `${SKILLS_API}/search?q=${encodeURIComponent(query)}&limit=${limit}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`skills.sh returned ${res.status}`);
  }

  return res.json() as Promise<SearchResponse>;
}

// --- GitHub Helpers ---

interface GitHubTreeEntry {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
}

interface GitHubTreeResponse {
  sha: string;
  tree: GitHubTreeEntry[];
  truncated: boolean;
}

async function fetchGitHubTree(owner: string, repo: string, branch: string): Promise<GitHubTreeResponse> {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'agent-dashboard',
    },
  });

  if (!res.ok) {
    throw new Error(`GitHub API returned ${res.status}`);
  }

  return res.json() as Promise<GitHubTreeResponse>;
}

async function fetchRawFile(owner: string, repo: string, branch: string, filePath: string): Promise<string> {
  const url = `${GITHUB_RAW}/${owner}/${repo}/${branch}/${filePath}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Failed to fetch ${filePath}: ${res.status}`);
  }

  return res.text();
}

function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};

  const result: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (key && value) result[key] = value;
  }
  return result;
}

function parseSource(source: string): { owner: string; repo: string } {
  const match = source.match(/^([^/]+)\/([^/@]+)/);
  if (!match) throw new Error(`Invalid source: ${source}`);
  return { owner: match[1], repo: match[2] };
}

// --- Resolve ---

export async function resolveSkills(source: string): Promise<ResolvedSkill[]> {
  const { owner, repo } = parseSource(source);

  // Try main, fallback to master
  let tree: GitHubTreeResponse;
  let branch = 'main';
  try {
    tree = await fetchGitHubTree(owner, repo, 'main');
  } catch (err) {
    if (!(err as Error).message.includes('404')) throw err;
    branch = 'master';
    tree = await fetchGitHubTree(owner, repo, 'master');
  }

  const blobs = tree.tree.filter(e => e.type === 'blob');
  const skillMdPaths = blobs
    .filter(e => e.path.endsWith('/SKILL.md') || e.path === 'SKILL.md')
    .map(e => e.path);

  if (skillMdPaths.length === 0) {
    return [];
  }

  // Discover skills using priority order
  const skills: ResolvedSkill[] = [];

  // Case 1: SKILL.md at repo root → single skill, all non-excluded files
  if (skillMdPaths.includes('SKILL.md')) {
    const content = await fetchRawFile(owner, repo, branch, 'SKILL.md');
    const fm = parseFrontmatter(content);
    const rootFiles = blobs.filter(e => {
      const topDir = e.path.split('/')[0];
      return !EXCLUDED_DIRS.has(topDir);
    });
    skills.push({
      name: fm.name || repo,
      description: fm.description || '',
      path: '',
      branch,
      files: rootFiles.map(f => ({ path: f.path, size: f.size || 0 })),
    });
    return skills;
  }

  // Case 2: Find skills in priority directories
  const priorityPrefixes = ['skills/', '.agents/skills/'];

  for (const prefix of priorityPrefixes) {
    const matching = skillMdPaths.filter(p => p.startsWith(prefix));
    for (const mdPath of matching) {
      const skillDir = mdPath.replace(/\/SKILL\.md$/, '');
      const content = await fetchRawFile(owner, repo, branch, mdPath);
      const fm = parseFrontmatter(content);
      const skillName = fm.name || skillDir.split('/').pop() || 'unknown';

      const dirFiles = blobs.filter(e => e.path.startsWith(skillDir + '/'));

      skills.push({
        name: skillName,
        description: fm.description || '',
        path: skillDir,
        branch,
        files: dirFiles.map(f => ({ path: f.path, size: f.size || 0 })),
      });
    }
    if (skills.length > 0) return skills;
  }

  // Case 3: Fallback — any SKILL.md anywhere
  for (const mdPath of skillMdPaths) {
    const skillDir = mdPath.replace(/\/SKILL\.md$/, '');
    const content = await fetchRawFile(owner, repo, branch, mdPath);
    const fm = parseFrontmatter(content);
    const skillName = fm.name || skillDir.split('/').pop() || 'unknown';
    const dirFiles = blobs.filter(e => e.path.startsWith(skillDir + '/'));

    skills.push({
      name: skillName,
      description: fm.description || '',
      path: skillDir,
      branch,
      files: dirFiles.map(f => ({ path: f.path, size: f.size || 0 })),
    });
  }

  return skills;
}

// --- Install ---

export async function installSkill(req: InstallRequest): Promise<{ name: string; filesWritten: number }> {
  const { owner, repo } = parseSource(req.source);

  // Sanitize skill name to prevent path traversal
  const sanitizedName = req.skillName.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!sanitizedName) throw new Error('Invalid skill name');

  let baseDir: string;
  if (req.target === 'project' && req.directory) {
    baseDir = path.join(req.directory, '.claude');
  } else {
    const db = getDb();
    const row = db.prepare('SELECT * FROM profiles WHERE id = ?').get(req.profileId) as ProfileRow | undefined;
    if (!row) throw new Error('Profile not found');
    baseDir = row.directory_path;
  }

  const skillDir = path.join(baseDir, 'skills', sanitizedName);

  // Clean existing skill folder if present (reinstall = update)
  if (existsSync(skillDir)) {
    rmSync(skillDir, { recursive: true, force: true });
  }

  mkdirSync(skillDir, { recursive: true });

  let filesWritten = 0;

  for (const filePath of req.files) {
    const content = await fetchRawFile(owner, repo, req.branch, filePath);

    // Strip the skill path prefix to get relative path inside skill folder
    const relativePath = req.skillPath
      ? filePath.slice(req.skillPath.length + 1)
      : filePath;

    const destPath = path.join(skillDir, relativePath);
    const destDir = path.dirname(destPath);

    // Path traversal check
    if (!destPath.startsWith(skillDir)) {
      throw new Error(`Invalid file path: ${filePath}`);
    }

    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true });
    }

    writeFileSync(destPath, content, 'utf-8');
    filesWritten++;
  }

  return { name: req.skillName, filesWritten };
}

// --- Read Skill Content ---

export function readSkillContent(filePath: string): string {
  // Validate the path exists and is a .md file
  if (!filePath || !filePath.endsWith('.md')) throw new Error('Invalid skill file path');
  if (!existsSync(filePath)) throw new Error('Skill file not found');

  return readFileSync(filePath, 'utf-8');
}

// --- Write Skill Content ---

export function writeSkillContent(filePath: string, content: string): void {
  if (!filePath || !filePath.endsWith('.md')) throw new Error('Invalid skill file path');
  if (!existsSync(filePath)) throw new Error('Skill file not found');

  writeFileSync(filePath, content, 'utf-8');
}

// --- Preview Skill Content (GitHub browse mode) ---

export async function previewSkillContent(source: string, branch: string, skillPath: string): Promise<string> {
  const { owner, repo } = parseSource(source);
  const filePath = skillPath ? `${skillPath}/SKILL.md` : 'SKILL.md';
  return fetchRawFile(owner, repo, branch, filePath);
}

// --- Uninstall ---

export function uninstallSkill(req: UninstallRequest & { target?: 'profile' | 'project'; directory?: string }): void {
  // Sanitize skill name to prevent traversal
  const sanitized = req.skillName.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!sanitized) throw new Error('Invalid skill name');

  let baseDir: string;
  if (req.target === 'project' && req.directory) {
    baseDir = path.join(req.directory, '.claude');
  } else {
    const db = getDb();
    const row = db.prepare('SELECT * FROM profiles WHERE id = ?').get(req.profileId) as ProfileRow | undefined;
    if (!row) throw new Error('Profile not found');
    baseDir = row.directory_path;
  }

  const skillDir = path.join(baseDir, 'skills', sanitized);

  // Verify path is inside base directory
  if (!skillDir.startsWith(baseDir)) {
    throw new Error('Invalid skill path');
  }

  if (!existsSync(skillDir)) {
    throw new Error('Skill not found');
  }

  rmSync(skillDir, { recursive: true, force: true });
}

// --- Project Skills ---

interface ProjectSkill {
  name: string;
  description: string;
  command: string;
  filePath: string;
}

export function getProjectSkills(directory: string): ProjectSkill[] {
  const skills: ProjectSkill[] = [];
  const skillDirs = [
    path.join(directory, '.claude', 'skills'),
    path.join(directory, '.claude', 'commands'),
  ];

  for (const dir of skillDirs) {
    if (!existsSync(dir)) continue;
    try {
      scanProjectSkills(dir, skills, 0);
    } catch {}
  }

  return skills;
}

function scanProjectSkills(dir: string, skills: ProjectSkill[], depth: number): void {
  if (depth > 5) return;
  const { readdirSync } = require('fs');
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      scanProjectSkills(fullPath, skills, depth + 1);
      continue;
    }
    if (!entry.name.endsWith('.md')) continue;

    try {
      const content = readFileSync(fullPath, 'utf-8');
      const frontmatter = parseFrontmatter(content);
      if (frontmatter.name) {
        if (skills.some(s => s.name === frontmatter.name)) continue;
        skills.push({
          name: frontmatter.name,
          description: frontmatter.description || '',
          command: `/${frontmatter.name}`,
          filePath: fullPath,
        });
      }
    } catch {}
  }
}
