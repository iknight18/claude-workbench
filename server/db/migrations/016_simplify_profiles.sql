CREATE TABLE profiles_new (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  directory_path TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO profiles_new (id, name, display_name, directory_path, is_active, created_at, updated_at)
  SELECT id, name, display_name, directory_path, is_active, created_at, updated_at FROM profiles;

DROP TABLE profiles;
ALTER TABLE profiles_new RENAME TO profiles;
