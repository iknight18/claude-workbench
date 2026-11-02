'use client';

import { useState, useEffect, useCallback } from 'react';
import * as api from '../api/sessions';
import type { Session } from '../api/sessions';

export function useSessions(filters?: {
  search?: string;
  tag?: string;
  status?: string;
}) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await api.fetchSessions(filters);
      setSessions(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load sessions'
      );
    } finally {
      setLoading(false);
    }
  }, [filters?.search, filters?.tag, filters?.status]);

  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(async (name: string, directory?: string, profile?: string) => {
    const session = await api.createSession({ name, directory, profile });
    setSessions(prev => [session, ...prev]);
    return session;
  }, []);

  const update = useCallback(
    async (id: string, input: Parameters<typeof api.updateSession>[1]) => {
      const session = await api.updateSession(id, input);
      setSessions(prev => prev.map(s => (s.id === id ? session : s)));
      return session;
    },
    []
  );

  const remove = useCallback(async (id: string) => {
    await api.deleteSession(id);
    setSessions(prev => prev.filter(s => s.id !== id));
  }, []);

  return { sessions, loading, error, reload: load, create, update, remove };
}

export function useDirectories() {
  const [directories, setDirectories] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const data = await api.fetchDirectories();
      setDirectories(data);
    } catch {
      setDirectories([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { directories, reload: load };
}

export function useGroups() {
  const [groups, setGroups] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const data = await api.fetchGroups();
      setGroups(data);
    } catch {
      setGroups([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { groups, reload: load };
}

export function useSessionTags() {
  const [tags, setTags] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const data = await api.fetchSessionTags();
      setTags(data);
    } catch {
      setTags([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { tags, reload: load };
}
