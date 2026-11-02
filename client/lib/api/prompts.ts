import { apiFetch } from './client';

export interface Prompt {
  id: string;
  title: string;
  content: string;
  notes: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface PromptVersion {
  id: string;
  prompt_id: string;
  title: string;
  content: string;
  notes: string;
  created_at: string;
}

export function fetchPrompts(params?: {
  search?: string;
  tag?: string;
}): Promise<Prompt[]> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.tag) query.set('tag', params.tag);
  const qs = query.toString();
  return apiFetch<Prompt[]>(`/prompts${qs ? `?${qs}` : ''}`);
}

export function fetchPrompt(id: string): Promise<Prompt> {
  return apiFetch<Prompt>(`/prompts/${id}`);
}

export function createPrompt(input: {
  title: string;
  content?: string;
  notes?: string;
  tags?: string[];
}): Promise<Prompt> {
  return apiFetch<Prompt>('/prompts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updatePrompt(
  id: string,
  input: {
    title?: string;
    content?: string;
    notes?: string;
    tags?: string[];
  }
): Promise<Prompt> {
  return apiFetch<Prompt>(`/prompts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function deletePrompt(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/prompts/${id}`, {
    method: 'DELETE',
  });
}

export function fetchVersions(promptId: string): Promise<PromptVersion[]> {
  return apiFetch<PromptVersion[]>(`/prompts/${promptId}/versions`);
}

export function restoreVersion(
  promptId: string,
  versionId: string
): Promise<Prompt> {
  return apiFetch<Prompt>(`/prompts/${promptId}/versions/${versionId}/restore`, {
    method: 'POST',
  });
}

export function fetchTags(): Promise<string[]> {
  return apiFetch<string[]>('/tags');
}

export function enhancePrompt(
  id: string,
  profile?: string
): Promise<{ content: string }> {
  return apiFetch<{ content: string }>(`/prompts/${id}/enhance`, {
    method: 'POST',
    body: JSON.stringify({ profile }),
  });
}
