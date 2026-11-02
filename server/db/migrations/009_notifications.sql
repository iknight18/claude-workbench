CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT DEFAULT '',
  source TEXT DEFAULT '',
  source_id TEXT DEFAULT '',
  read INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notification_settings (
  profile_name TEXT PRIMARY KEY,
  hooks_enabled INTEGER DEFAULT 0
);
