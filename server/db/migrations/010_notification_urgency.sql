ALTER TABLE notifications ADD COLUMN urgency TEXT DEFAULT 'info';
ALTER TABLE notifications ADD COLUMN category TEXT DEFAULT 'session';
