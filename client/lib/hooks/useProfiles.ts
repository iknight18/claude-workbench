'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchProfiles } from '../api/profiles';
import type { Profile } from '../api/profiles';

export function useProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchProfiles();
      setProfiles(data);
    } catch {
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { profiles, loading, reload: load };
}
