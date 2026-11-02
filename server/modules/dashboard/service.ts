import { getDb } from '../../db/connection';

export interface DashboardStats {
  activeSessions: number;
  totalPrompts: number;
  groups: number;
  scheduledTasks: number;
  failedTasks: number;
  profiles: number;
  unreadNotifications: number;
}

export function getStats(): DashboardStats {
  const db = getDb();

  const activeSessions = (db.prepare("SELECT COUNT(*) as count FROM sessions WHERE status = 'active'").get() as { count: number }).count;
  const totalPrompts = (db.prepare('SELECT COUNT(*) as count FROM prompts').get() as { count: number }).count;
  const groups = (db.prepare("SELECT COUNT(DISTINCT \"group\") as count FROM sessions WHERE \"group\" != ''").get() as { count: number }).count;
  const scheduledTasks = (db.prepare("SELECT COUNT(*) as count FROM scheduled_tasks WHERE enabled = 1").get() as { count: number }).count;

  // Count tasks whose most recent run has status = 'failed'
  const failedTasks = (db.prepare(`
    SELECT COUNT(*) as count FROM scheduled_tasks t
    WHERE EXISTS (
      SELECT 1 FROM scheduled_task_runs r
      WHERE r.task_id = t.id
        AND r.status = 'failed'
        AND r.id = (
          SELECT r2.id FROM scheduled_task_runs r2
          WHERE r2.task_id = t.id
          ORDER BY r2.started_at DESC
          LIMIT 1
        )
    )
  `).get() as { count: number }).count;

  const profiles = (db.prepare('SELECT COUNT(*) as count FROM profiles').get() as { count: number }).count;
  const unreadNotifications = (db.prepare("SELECT COUNT(*) as count FROM notifications WHERE read = 0").get() as { count: number }).count;

  return { activeSessions, totalPrompts, groups, scheduledTasks, failedTasks, profiles, unreadNotifications };
}
