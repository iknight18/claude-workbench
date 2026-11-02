import { apiFetch } from './client';

export interface Session {
  id: string;
  name: string;
  directory: string;
  status: 'active' | 'completed' | 'archived';
  profile: string;
  skip_permissions: boolean;
  hooks_enabled: boolean;
  debug_enabled: boolean;
  group: string;
  notes: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface SessionWithGit extends Session {
  git_branch: string | null;
}

export function fetchSessions(params?: {
  search?: string;
  tag?: string;
  status?: string;
}): Promise<Session[]> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.tag) query.set('tag', params.tag);
  if (params?.status) query.set('status', params.status);
  const qs = query.toString();
  return apiFetch<Session[]>(`/sessions${qs ? `?${qs}` : ''}`);
}

export function fetchSession(id: string): Promise<SessionWithGit> {
  return apiFetch<SessionWithGit>(`/sessions/${id}`);
}

export function createSession(input: {
  name: string;
  directory?: string;
  profile?: string;
  skip_permissions?: boolean;
  group?: string;
  notes?: string;
  tags?: string[];
}): Promise<Session> {
  return apiFetch<Session>('/sessions', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateSession(
  id: string,
  input: {
    name?: string;
    directory?: string;
    status?: string;
    profile?: string;
    skip_permissions?: boolean;
    hooks_enabled?: boolean;
    debug_enabled?: boolean;
    group?: string;
    notes?: string;
    tags?: string[];
  }
): Promise<Session> {
  return apiFetch<Session>(`/sessions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function deleteSession(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/sessions/${id}`, {
    method: 'DELETE',
  });
}

export function fetchDirectories(): Promise<string[]> {
  return apiFetch<string[]>('/sessions/directories');
}

export interface BrowseResult {
  current: string;
  parent: string | null;
  directories: string[];
}

export function browseDirectory(path?: string): Promise<BrowseResult> {
  const query = path ? `?path=${encodeURIComponent(path)}` : '';
  return apiFetch<BrowseResult>(`/filesystem/browse${query}`);
}

export function createDirectory(dirPath: string): Promise<{ path: string }> {
  return apiFetch<{ path: string }>('/filesystem/mkdir', {
    method: 'POST',
    body: JSON.stringify({ path: dirPath }),
  });
}

export function startTerminal(sessionId: string): Promise<{ status: string }> {
  return apiFetch<{ status: string }>(`/sessions/${sessionId}/terminal`, {
    method: 'POST',
  });
}

export function killTerminal(sessionId: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/sessions/${sessionId}/terminal`, {
    method: 'DELETE',
  });
}

export function getTerminalStatus(sessionId: string): Promise<{ running: boolean }> {
  return apiFetch<{ running: boolean }>(`/sessions/${sessionId}/terminal/status`);
}

export function fetchActiveTerminals(): Promise<string[]> {
  return apiFetch<string[]>('/terminals/active');
}

export function fetchGroups(): Promise<string[]> {
  return apiFetch<string[]>('/sessions/groups');
}

export function fetchSessionTags(): Promise<string[]> {
  return apiFetch<string[]>('/sessions/tags');
}

export interface TerminalPreview {
  lines: string[];
  running: boolean;
}

export function fetchTerminalPreview(sessionId: string): Promise<TerminalPreview> {
  return apiFetch<TerminalPreview>(`/terminals/${sessionId}/preview`);
}

export interface ProjectConfig {
  directory: string;
  claudeMd: string | null;
  agentsMd: string | null;
}

export function fetchProjectConfig(sessionId: string): Promise<ProjectConfig> {
  return apiFetch<ProjectConfig>(`/sessions/${sessionId}/project-config`);
}

export function writeProjectConfig(
  sessionId: string,
  data: { claudeMd?: string; agentsMd?: string }
): Promise<ProjectConfig> {
  return apiFetch<ProjectConfig>(`/sessions/${sessionId}/project-config`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteProjectConfig(
  sessionId: string,
  file: 'claude' | 'agents'
): Promise<ProjectConfig> {
  return apiFetch<ProjectConfig>(`/sessions/${sessionId}/project-config?file=${file}`, {
    method: 'DELETE',
  });
}

// --- Debug Logs ---

export interface DebugLogResult {
  lines: string[];
  categories: string[];
  levels: string[];
}

export function fetchDebugLogs(
  sessionId: string,
  params?: { search?: string; level?: string; category?: string }
): Promise<DebugLogResult> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.level) query.set('level', params.level);
  if (params?.category) query.set('category', params.category);
  const qs = query.toString();
  return apiFetch<DebugLogResult>(`/sessions/${sessionId}/debug-logs${qs ? `?${qs}` : ''}`);
}

export function deleteDebugLogs(sessionId: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/sessions/${sessionId}/debug-logs`, {
    method: 'DELETE',
  });
}

export function clearAllDebugLogs(): Promise<{ cleared: number }> {
  return apiFetch<{ cleared: number }>('/sessions/debug-logs/all', {
    method: 'DELETE',
  });
}
