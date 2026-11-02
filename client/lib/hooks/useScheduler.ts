'use client';

import { useState, useEffect, useCallback } from 'react';
import * as api from '../api/scheduler';
import type { ScheduledTask, TaskWithRuns } from '../api/scheduler';

export function useScheduledTasks() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api.fetchTasks();
      setTasks(data);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(async (input: Parameters<typeof api.createTask>[0]) => {
    const task = await api.createTask(input);
    setTasks(prev => [task, ...prev]);
    return task;
  }, []);

  const update = useCallback(async (id: string, input: Parameters<typeof api.updateTask>[1]) => {
    const task = await api.updateTask(id, input);
    setTasks(prev => prev.map(t => (t.id === id ? task : t)));
    return task;
  }, []);

  const remove = useCallback(async (id: string) => {
    await api.deleteTask(id);
    setTasks(prev => prev.filter(t => t.id !== id));
  }, []);

  return { tasks, loading, reload: load, create, update, remove };
}

export function useTaskDetail(taskId: string | null) {
  const [task, setTask] = useState<TaskWithRuns | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!taskId) {
      setTask(null);
      return;
    }
    setLoading(true);
    try {
      const data = await api.fetchTask(taskId);
      setTask(data);
    } catch {
      setTask(null);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    load();
  }, [load]);

  return { task, loading, reload: load };
}
