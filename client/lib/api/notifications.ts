import { apiFetch } from './client';

export type NotificationUrgency = 'info' | 'warning' | 'action';
export type NotificationCategory = 'task' | 'session' | 'session_task';

export interface Notification {
  id: string;
  type: 'task_completed' | 'task_failed' | 'session_permission' | 'session_stopped' | 'session_idle' | 'session_task_created' | 'session_task_completed';
  urgency: NotificationUrgency;
  category: NotificationCategory;
  title: string;
  message: string;
  source: string;
  source_id: string;
  task_subject: string;
  task_status: string;
  preview: string;
  read: boolean;
  created_at: string;
}

export interface HookStatus {
  profile_name: string;
  hooks_enabled: boolean;
}

export async function fetchNotifications(params?: {
  unread?: boolean;
  limit?: number;
}): Promise<Notification[]> {
  const query = new URLSearchParams();
  if (params?.unread) query.set('unread', 'true');
  if (params?.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return apiFetch<Notification[]>(`/notifications${qs ? `?${qs}` : ''}`);
}

export async function fetchUnreadCount(): Promise<number> {
  const result = await apiFetch<{ count: number }>('/notifications/unread-count');
  return result.count;
}

export async function createNotification(input: {
  type: string;
  urgency?: string;
  category?: string;
  title: string;
  message?: string;
  source?: string;
  source_id?: string;
}): Promise<Notification> {
  return apiFetch<Notification>('/notifications/create', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function markRead(id: string): Promise<void> {
  await apiFetch(`/notifications/${id}/read`, { method: 'PUT' });
}

export async function markAllRead(): Promise<void> {
  await apiFetch('/notifications/read-all', { method: 'PUT' });
}

export async function deleteNotification(id: string): Promise<void> {
  await apiFetch(`/notifications/${id}`, { method: 'DELETE' });
}

export async function clearAll(): Promise<void> {
  await apiFetch('/notifications/clear', { method: 'DELETE' });
}

export async function fetchHooksStatus(): Promise<HookStatus[]> {
  return apiFetch<HookStatus[]>('/notifications/hooks/status');
}

export async function enableHooks(profile: string): Promise<void> {
  await apiFetch(`/notifications/hooks/enable/${profile}`, { method: 'POST' });
}

export async function disableHooks(profile: string): Promise<void> {
  await apiFetch(`/notifications/hooks/disable/${profile}`, { method: 'POST' });
}

export async function sendTerminalInput(sessionId: string, data: string): Promise<void> {
  await apiFetch(`/sessions/${sessionId}/terminal/input`, {
    method: 'POST',
    body: JSON.stringify({ data }),
  });
}
