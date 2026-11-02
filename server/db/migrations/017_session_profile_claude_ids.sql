CREATE TABLE IF NOT EXISTS session_profile_claude_ids (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  profile TEXT NOT NULL DEFAULT '',
  claude_session_id TEXT NOT NULL,
  UNIQUE(session_id, profile)
);

-- Migrate existing data from sessions table
INSERT OR IGNORE INTO session_profile_claude_ids (id, session_id, profile, claude_session_id)
SELECT
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))) AS id,
  id AS session_id,
  COALESCE(profile, '') AS profile,
  claude_session_id
FROM sessions
WHERE claude_session_id IS NOT NULL AND claude_session_id != '';
