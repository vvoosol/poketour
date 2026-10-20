import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { projectPath } from './paths.mjs';

export function openLocalDatabase(filename = projectPath('.local/game.sqlite')) {
  if (filename !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
  const database = new DatabaseSync(filename);
  database.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  try {
    database.exec('CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY, hash TEXT NOT NULL)');
    for (const name of fs.readdirSync(projectPath('drizzle')).filter(f => f.endsWith('.sql')).sort()) {
      const sql = fs.readFileSync(projectPath('drizzle', name), 'utf8');
      const hash = createHash('sha256').update(sql).digest('hex');
      const applied = database.prepare('SELECT hash FROM local_migrations WHERE name=?').get(name);
      if (applied) { if (applied.hash !== hash) throw Error(`Applied migration changed: ${name}`); continue; }
      database.exec('BEGIN IMMEDIATE');
      try {
        database.exec(sql);
        database.prepare('INSERT INTO local_migrations (name,hash) VALUES (?,?)').run(name, hash);
        database.exec('COMMIT');
      } catch (error) { database.exec('ROLLBACK'); throw error; }
    }
  } catch (error) { database.close(); throw error; }
  const wrap = (sql, args = []) => ({
    sql, args,
    bind: (...values) => wrap(sql, values),
    async first() { return database.prepare(sql).get(...args) || null; },
    async run() { return database.prepare(sql).run(...args); },
    async all() { return { results: database.prepare(sql).all(...args) }; },
  });
  return {
    database,
    DB: {
      prepare: sql => wrap(sql),
      async batch(statements) {
        database.exec('BEGIN IMMEDIATE');
        try {
          const results = statements.map(s => ({ results: database.prepare(s.sql).all(...s.args) }));
          database.exec('COMMIT');
          return results;
        } catch (error) { database.exec('ROLLBACK'); throw error; }
      },
    },
    close: () => database.close(),
  };
}
