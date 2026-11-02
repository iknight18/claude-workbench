import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { config } from '../config';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const dir = path.dirname(config.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    db = new Database(config.dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    runMigrations(db);
  }
  return db;
}

function runMigrations(database: Database.Database): void {
  // Create migrations tracking table
  const trackingExists = database.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations'"
  ).get();

  database.exec(
    'CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at DATETIME DEFAULT CURRENT_TIMESTAMP)'
  );

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  // If tracking table was just created on an existing DB, seed it with migrations
  // that correspond to already-existing tables (they were applied before tracking).
  // On a fresh DB (no tables), run all migrations normally.
  if (!trackingExists) {
    const existingTables = new Set(
      (database.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[])
        .map(r => r.name)
    );
    // If there are user tables (not just _migrations), this is a pre-tracking DB
    const hasExistingData = existingTables.size > 1;

    if (hasExistingData) {
      const insertMigration = database.prepare('INSERT INTO _migrations (name) VALUES (?)');
      for (const file of files) {
        insertMigration.run(file);
      }
      return;
    }
  }

  const applied = new Set(
    (database.prepare('SELECT name FROM _migrations').all() as { name: string }[])
      .map(r => r.name)
  );

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    database.exec(sql);
    database.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
  }
}
