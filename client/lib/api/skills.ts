import { apiFetch } from './client';

export interface SearchSkill {
  id: string;
  name: string;
  installs: number;
  source: string;
}

export interface SkillFile {
  path: string;
  size: number;
}

export interface ResolvedSkill {
  name: string;
  description: string;
  path: string;
  branch: string;
  files: SkillFile[];
}

export interface SearchResult {
  skills: SearchSkill[];
}

export interface ResolveResult {
  skills: ResolvedSkill[];
}

export function searchSkills(query: string, limit: number = 10): Promise<SearchResult> {
  return apiFetch<SearchResult>(`/skills/search?q=${encodeURIComponent(query)}&limit=${limit}`);
}

export function resolveSkills(source: string): Promise<ResolveResult> {
  return apiFetch<ResolveResult>(`/skills/resolve?source=${encodeURIComponent(source)}`);
}

export function installSkill(data: {
  profileId: string;
  source: string;
  skillName: string;
  skillPath: string;
  branch: string;
  files: string[];
  target?: 'profile' | 'project';
  directory?: string;
}): Promise<{ name: string; filesWritten: number }> {
  return apiFetch<{ name: string; filesWritten: number }>('/skills/install', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function uninstallSkill(
  profileId: string,
  skillName: string,
  target?: 'profile' | 'project',
  directory?: string
): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>('/skills/uninstall', {
    method: 'DELETE',
    body: JSON.stringify({ profileId, skillName, target, directory }),
  });
}

export interface ProjectSkill {
  name: string;
  description: string;
  command: string;
  filePath: string;
}

export function fetchProjectSkills(directory: string): Promise<ProjectSkill[]> {
  return apiFetch<ProjectSkill[]>(`/skills/project?directory=${encodeURIComponent(directory)}`);
}

export function readSkillContent(filePath: string): Promise<{ content: string }> {
  return apiFetch<{ content: string }>(`/skills/content?filePath=${encodeURIComponent(filePath)}`);
}

export function writeSkillContent(filePath: string, content: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>('/skills/content', {
    method: 'PUT',
    body: JSON.stringify({ filePath, content }),
  });
}

export function previewSkillContent(source: string, branch: string, skillPath: string): Promise<{ content: string }> {
  return apiFetch<{ content: string }>(`/skills/preview?source=${encodeURIComponent(source)}&branch=${encodeURIComponent(branch)}&skillPath=${encodeURIComponent(skillPath)}`);
}
