import { apiFetch } from './client';

export interface DashboardStats {
  activeSessions: number;
  totalPrompts: number;
  groups: number;
  scheduledTasks: number;
  failedTasks: number;
  profiles: number;
  unreadNotifications: number;
}

export function fetchDashboardStats(): Promise<DashboardStats> {
  return apiFetch<DashboardStats>('/dashboard/stats');
}
