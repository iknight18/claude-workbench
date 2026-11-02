CREATE TABLE scheduled_tasks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  prompt TEXT NOT NULL,
  cron_expression TEXT NOT NULL,
  directory TEXT NOT NULL,
  profile TEXT DEFAULT '',
  session_id TEXT DEFAULT NULL REFERENCES sessions(id) ON DELETE SET NULL,
  enabled INTEGER DEFAULT 1,
  created_at DATETIME,
  updated_at DATETIME
);

CREATE TABLE scheduled_task_runs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
  started_at DATETIME NOT NULL,
  finished_at DATETIME,
  exit_code INTEGER,
  output TEXT DEFAULT '',
  tokens_in INTEGER DEFAULT 0,
  tokens_out INTEGER DEFAULT 0,
  cost_usd REAL DEFAULT 0,
  status TEXT DEFAULT 'running'
);
