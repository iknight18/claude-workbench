import { getDb } from '../../db/connection';
import { generateId } from '../../shared/utils/uuid';
import {
  Notification,
  NotificationRow,
  CreateNotificationInput,
} from './types';
import { NotificationBroadcaster } from './websocket';

function rowToNotification(row: NotificationRow): Notification {
  return {
    ...row,
    type: row.type as Notification['type'],
    urgency: (row.urgency || 'info') as Notification['urgency'],
    category: (row.category || 'session') as Notification['category'],
    task_subject: row.task_subject || '',
    task_status: row.task_status || '',
    preview: row.preview || '',
    read: Boolean(row.read),
  };
}

export function listNotifications(options?: {
  unread?: boolean;
  limit?: number;
}): Notification[] {
  const db = getDb();
  const limit = options?.limit ?? 50;
  let query = 'SELECT * FROM notifications';
  const params: any[] = [];

  if (options?.unread) {
    query += ' WHERE read = 0';
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const rows = db.prepare(query).all(...params) as NotificationRow[];
  return rows.map(rowToNotification);
}

export function getUnreadCount(): number {
  const db = getDb();
  const row = db
    .prepare('SELECT COUNT(*) as count FROM notifications WHERE read = 0')
    .get() as { count: number };
  return row.count;
}

export function createNotification(input: CreateNotificationInput): Notification {
  const db = getDb();
  const id = generateId();

  db.prepare(
    'INSERT INTO notifications (id, type, urgency, category, title, message, source, source_id, task_subject, task_status, preview) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    id,
    input.type,
    input.urgency ?? 'info',
    input.category ?? 'session',
    input.title,
    input.message ?? '',
    input.source ?? '',
    input.source_id ?? '',
    input.task_subject ?? '',
    input.task_status ?? '',
    input.preview ?? ''
  );

  const row = db
    .prepare('SELECT * FROM notifications WHERE id = ?')
    .get(id) as NotificationRow;
  const notification = rowToNotification(row);

  // Broadcast via WebSocket
  NotificationBroadcaster.getInstance().broadcast(notification);

  return notification;
}

export function markRead(id: string): boolean {
  const db = getDb();
  const result = db
    .prepare('UPDATE notifications SET read = 1 WHERE id = ?')
    .run(id);
  return result.changes > 0;
}

export function markAllRead(): number {
  const db = getDb();
  const result = db
    .prepare('UPDATE notifications SET read = 1 WHERE read = 0')
    .run();
  return result.changes;
}

export function deleteNotification(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM notifications WHERE id = ?').run(id);
  return result.changes > 0;
}

export function clearAll(): number {
  const db = getDb();
  const result = db.prepare('DELETE FROM notifications').run();
  return result.changes;
}
