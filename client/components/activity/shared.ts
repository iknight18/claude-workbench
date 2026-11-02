import {
  CheckCircle,
  XCircle,
  ShieldWarning,
  Clock,
  Stop,
  Square,
  CheckSquare,
} from '@phosphor-icons/react';

// --- Types ---

export interface ActiveSession {
  sessionId: string;
  name: string;
}

export interface SessionTask {
  id: string;
  subject: string;
  status: 'pending' | 'in_progress' | 'completed';
  created_at: string;
  completed_at: string | null;
}

export interface RunningTask {
  id: string;
  name: string;
  started_at: string;
}

// --- Icon/color maps ---

export const typeIcons: Record<string, typeof CheckCircle> = {
  task_completed: CheckCircle,
  task_failed: XCircle,
  session_permission: ShieldWarning,
  session_stopped: Stop,
  session_idle: Clock,
  session_task_created: Square,
  session_task_completed: CheckSquare,
};

export const typeColors: Record<string, string> = {
  task_completed: 'text-emerald-500',
  task_failed: 'text-red-500',
  session_permission: 'text-amber-500',
  session_stopped: 'text-blue-500',
  session_idle: 'text-zinc-400',
  session_task_created: 'text-zinc-400',
  session_task_completed: 'text-emerald-500',
};

export const urgencyBorder: Record<string, string> = {
  info: 'border-l-zinc-700',
  warning: 'border-l-amber-500/60',
  action: 'border-l-emerald-500/60',
};

// --- Filter types ---

export type NotificationFilter = 'all' | 'permission' | 'idle' | 'stopped' | 'task';

export const FILTER_OPTIONS: { value: NotificationFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'permission', label: 'Permission' },
  { value: 'idle', label: 'Idle' },
  { value: 'stopped', label: 'Stopped' },
  { value: 'task', label: 'Tasks' },
];

export const FILTER_TYPE_MAP: Record<NotificationFilter, string[]> = {
  all: [],
  permission: ['session_permission'],
  idle: ['session_idle'],
  stopped: ['session_stopped'],
  task: ['task_completed', 'task_failed'],
};

// --- Helpers ---

export interface TaskEntry {
  subject: string;
  completed: boolean;
  created_at: string;
}

export function timeAgo(dateStr: string): string {
  const now = Date.now();
  const utcStr = dateStr.includes('Z') || dateStr.includes('+') ? dateStr : dateStr + 'Z';
  const then = new Date(utcStr).getTime();
  const diff = Math.max(0, now - then);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
