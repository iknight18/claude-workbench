import { getDb } from '../../db/connection';

export function listTags(): string[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT DISTINCT tag FROM prompt_tags ORDER BY tag')
    .all() as { tag: string }[];
  return rows.map(r => r.tag);
}
