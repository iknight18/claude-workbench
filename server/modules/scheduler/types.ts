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

export interface ScheduledTaskRow {
  id: string;
  name: string;
  description: string;
  prompt: string;
  cron_expression: string;
  scheduled_at: string | null;
  directory: string;
  profile: string;
  session_id: string | null;
  enabled: number;
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

export interface TaskRunRow {
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
  status: string;
}

export interface CreateTaskInput {
  name: string;
  description?: string;
  prompt: string;
  cron_expression: string;
  scheduled_at?: string | null;
  directory: string;
  profile?: string;
  session_id?: string | null;
}

export interface UpdateTaskInput {
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

export interface TaskWithRuns extends ScheduledTask {
  recent_runs: TaskRun[];
}
