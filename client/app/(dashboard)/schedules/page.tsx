'use client';

import { useState, useCallback, useEffect } from 'react';
import TaskList from '@/components/schedules/TaskList';
import TaskEditor from '@/components/schedules/TaskEditor';
import { useScheduledTasks, useTaskDetail } from '@/lib/hooks/useScheduler';
import { useSchedulerEvents } from '@/lib/hooks/useSchedulerEvents';
import { useProfiles } from '@/lib/hooks/useProfiles';
import { useKeyboardShortcuts } from '@/lib/hooks/useKeyboardShortcuts';
import { fetchRunningTasks } from '@/lib/api/scheduler';
import type { ScheduledTask } from '@/lib/api/scheduler';

export default function SchedulesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const [runningTaskIds, setRunningTaskIds] = useState<Set<string>>(new Set());

  const { tasks, loading, create, update, remove, reload } = useScheduledTasks();
  const { task: activeTask, reload: reloadTask } = useTaskDetail(activeTaskId);
  const { profiles } = useProfiles();

  // Load initial running tasks
  useEffect(() => {
    fetchRunningTasks()
      .then(running => setRunningTaskIds(new Set(running.map(r => r.id))))
      .catch(() => {});
  }, []);

  const handleCreate = useCallback(async () => {
    // Generate unique name
    let baseName = 'Untitled task';
    let candidateName = baseName;
    let counter = 1;
    const existingNames = new Set(tasks.map(t => t.name));
    while (existingNames.has(candidateName)) {
      counter++;
      candidateName = `${baseName} ${counter}`;
    }

    const task = await create({
      name: candidateName,
      prompt: '',
      cron_expression: '',
      directory: '',
      profile: profiles.length > 0 ? profiles[0].name : '',
    });
    setActiveTaskId(task.id);
  }, [tasks, create, profiles]);

  const handleSelect = useCallback((task: ScheduledTask) => {
    setActiveTaskId(task.id);
  }, []);

  const handleUpdate = useCallback(async (id: string, input: any) => {
    const result = await update(id, input);
    reloadTask();
    return result;
  }, [update, reloadTask]);

  const handleDelete = useCallback(async (id: string) => {
    await remove(id);
    if (activeTaskId === id) {
      setActiveTaskId(null);
    }
  }, [remove, activeTaskId]);

  // Real-time scheduler updates via WebSocket
  useSchedulerEvents(useCallback((event) => {
    // Track running state for dot indicator
    if (event.event === 'task_started') {
      setRunningTaskIds(prev => new Set(prev).add(event.taskId));
    } else {
      setRunningTaskIds(prev => {
        const next = new Set(prev);
        next.delete(event.taskId);
        return next;
      });
    }
    // Reload the task list
    reload();
    // Reload detail if the event is for the currently viewed task
    if (event.taskId === activeTaskId) {
      reloadTask();
    }
  }, [reload, reloadTask, activeTaskId]));

  const handleRunNow = useCallback(() => {
    reloadTask();
  }, [reloadTask]);

  useKeyboardShortcuts([
    { key: 'n', alt: true, handler: handleCreate },
  ]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-zinc-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="w-72 flex-shrink-0">
        <TaskList
          tasks={tasks}
          activeTaskId={activeTaskId}
          runningTaskIds={runningTaskIds}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSelect={handleSelect}
          onDelete={handleDelete}
          onCreate={handleCreate}
        />
      </div>

      <div className="flex-1 min-w-0">
        <TaskEditor
          task={activeTask}
          profiles={profiles}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onRunNow={handleRunNow}
          onCreate={handleCreate}
        />
      </div>
    </div>
  );
}
