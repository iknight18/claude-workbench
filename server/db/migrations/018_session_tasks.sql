CREATE TABLE IF NOT EXISTS session_tasks (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at DATETIME DEFAULT (datetime('now')),
  completed_at DATETIME,
  UNIQUE(session_id, subject)
);
