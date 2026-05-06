/**
 * Turso (libSQL) へのマイグレーションスクリプト
 * 使用例: TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... npx tsx src/db/migrate-turso.ts
 */
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error("TURSO_DATABASE_URL が設定されていません");
  process.exit(1);
}

const client = createClient({ url, authToken });

async function migrate() {
  await client.executeMultiple(`
  CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    priority TEXT NOT NULL DEFAULT 'p3',
    assignee TEXT,
    reporter TEXT NOT NULL,
    responded_at INTEGER,
    resolved_at INTEGER,
    sla_response_deadline INTEGER NOT NULL,
    sla_resolve_deadline INTEGER NOT NULL,
    sla_response_breached INTEGER NOT NULL DEFAULT 0,
    sla_resolve_breached INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    incident_id TEXT NOT NULL REFERENCES incidents(id),
    actor TEXT NOT NULL,
    field TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    comment TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
  );

  CREATE TABLE IF NOT EXISTS sla_config (
    priority TEXT PRIMARY KEY,
    response_minutes INTEGER NOT NULL,
    resolve_minutes INTEGER NOT NULL
  );

  INSERT OR IGNORE INTO sla_config VALUES ('p1', 15,  240);
  INSERT OR IGNORE INTO sla_config VALUES ('p2', 60,  480);
  INSERT OR IGNORE INTO sla_config VALUES ('p3', 240, 1440);
  INSERT OR IGNORE INTO sla_config VALUES ('p4', 1440, 4320);

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    github_id TEXT UNIQUE,
    role TEXT NOT NULL DEFAULT 'member',
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
  );
`);
  console.log("Turso migration complete:", url);
  client.close();
}

migrate().catch((err) => { console.error(err); process.exit(1); });
