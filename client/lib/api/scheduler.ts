import { apiFetch } from './client';

export interface ScheduledTask {
  id: string;
  name: string;
  description: string;
  prompt: string;
  cron_expression: string;
  scheduled_at: string | null;
  directory: string;
  profile: string;
  session_id: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaskRun {
  id: string;
  task_id: string;
  started_at: string;
  finished_at: string | null;
  exit_code: number | null;
  output: string;
  command: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  status: 'running' | 'completed' | 'failed' | 'killed';
}

export interface TaskWithRuns extends ScheduledTask {
  recent_runs: TaskRun[];
}

export function fetchTasks(): Promise<ScheduledTask[]> {
  return apiFetch<ScheduledTask[]>('/scheduler/tasks');
}

export function fetchTask(id: string): Promise<TaskWithRuns> {
  return apiFetch<TaskWithRuns>(`/scheduler/tasks/${id}`);
}

export function createTask(input: {
  name: string;
  description?: string;
  prompt: string;
  cron_expression: string;
  scheduled_at?: string | null;
  directory: string;
  profile?: string;
  session_id?: string | null;
}): Promise<ScheduledTask> {
  return apiFetch<ScheduledTask>('/scheduler/tasks', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateTask(
  id: string,
  input: {
    name?: string;
    description?: string;
    prompt?: string;
    cron_expression?: string;
    scheduled_at?: string | null;
    directory?: string;
    profile?: string;
    session_id?: string | null;
    enabled?: boolean;
  }
): Promise<ScheduledTask> {
  return apiFetch<ScheduledTask>(`/scheduler/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function deleteTask(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/scheduler/tasks/${id}`, {
    method: 'DELETE',
  });
}

export function runTaskNow(id: string): Promise<{ runId: string; status: string }> {
  return apiFetch<{ runId: string; status: string }>(`/scheduler/tasks/${id}/run`, {
    method: 'POST',
  });
}

export function fetchRuns(taskId: string): Promise<TaskRun[]> {
  return apiFetch<TaskRun[]>(`/scheduler/tasks/${taskId}/runs`);
}

export interface RunningScheduledTask {
  id: string;
  name: string;
  started_at: string;
}

export function fetchRunningTasks(): Promise<RunningScheduledTask[]> {
  return apiFetch<RunningScheduledTask[]>('/scheduler/tasks/running');
}
