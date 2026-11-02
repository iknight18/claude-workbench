ALTER TABLE scheduled_tasks ADD COLUMN scheduled_at DATETIME DEFAULT NULL;
ALTER TABLE scheduled_task_runs ADD COLUMN command TEXT DEFAULT '';
