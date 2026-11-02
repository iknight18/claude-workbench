export type NotificationType =
  | 'task_completed'
  | 'task_failed'
  | 'session_permission'
  | 'session_stopped'
  | 'session_idle'
  | 'session_task_created'
  | 'session_task_completed';

export type NotificationUrgency = 'info' | 'warning' | 'action';

export type NotificationCategory = 'task' | 'session' | 'session_task';

export interface Notification {
  id: string;
  type: NotificationType;
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

export interface NotificationRow {
  id: string;
  type: string;
  urgency: string;
  category: string;
  title: string;
  message: string;
  source: string;
  source_id: string;
  task_subject: string;
  task_status: string;
  preview: string;
  read: number;
  created_at: string;
}

export interface CreateNotificationInput {
  type: NotificationType;
  urgency?: NotificationUrgency;
  category?: NotificationCategory;
  title: string;
  message?: string;
  source?: string;
  source_id?: string;
  task_subject?: string;
  task_status?: string;
  preview?: string;
}

export interface HookPayload {
  session_id?: string;
  hook_event_name?: string;
  notification_type?: string;
  tool_name?: string;
  tool_input?: {
    command?: string;
    file_path?: string;
    description?: string;
  };
  cwd?: string;
  task_id?: string;
  task_subject?: string;
  task_status?: string;
  last_assistant_message?: string;
}
