'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import * as api from '../api/prompts';
import type { Prompt, PromptVersion } from '../api/prompts';

export function usePrompts(filters?: { search?: string; tag?: string }) {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await api.fetchPrompts(filters);
      setPrompts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load prompts');
    } finally {
      setLoading(false);
    }
  }, [filters?.search, filters?.tag]);

  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(async (title: string) => {
    const prompt = await api.createPrompt({ title });
    setPrompts(prev => [prompt, ...prev]);
    return prompt;
  }, []);

  const update = useCallback(async (id: string, input: Parameters<typeof api.updatePrompt>[1]) => {
    const prompt = await api.updatePrompt(id, input);
    setPrompts(prev => prev.map(p => (p.id === id ? prompt : p)));
    return prompt;
  }, []);

  const remove = useCallback(async (id: string) => {
    await api.deletePrompt(id);
    setPrompts(prev => prev.filter(p => p.id !== id));
  }, []);

  return { prompts, loading, error, reload: load, create, update, remove };
}

export function useVersions(promptId: string | null) {
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!promptId) {
      setVersions([]);
      return;
    }
    setLoading(true);
    try {
      const data = await api.fetchVersions(promptId);
      setVersions(data);
    } catch {
      setVersions([]);
    } finally {
      setLoading(false);
    }
  }, [promptId]);

  useEffect(() => {
    load();
  }, [load]);

  const restore = useCallback(
    async (versionId: string) => {
      if (!promptId) return null;
      const prompt = await api.restoreVersion(promptId, versionId);
      await load();
      return prompt;
    },
    [promptId, load]
  );

  return { versions, loading, reload: load, restore };
}

export function useTags() {
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    api.fetchTags().then(setTags).catch(() => setTags([]));
  }, []);

  const reload = useCallback(() => {
    api.fetchTags().then(setTags).catch(() => setTags([]));
  }, []);

  return { tags, reload };
}

