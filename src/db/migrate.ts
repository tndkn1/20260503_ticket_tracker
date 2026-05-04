import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH =
  process.env.DB_PATH ?? path.join(process.cwd(), "data", "itsm.db");

function migrate() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  db.exec(`
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

  // Migration: make password_hash nullable and add github_id if not present
  const cols = db.pragma("table_info(users)") as { name: string }[];
  const hasGithubId = cols.some((c) => c.name === "github_id");
  if (!hasGithubId) {
    db.exec(`
      CREATE TABLE users_new (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT,
        github_id TEXT UNIQUE,
        role TEXT NOT NULL DEFAULT 'member',
        created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
      );
      INSERT INTO users_new (id, username, email, password_hash, role, created_at)
        SELECT id, username, email, password_hash, role, created_at FROM users;
      DROP TABLE users;
      ALTER TABLE users_new RENAME TO users;
    `);
  }

  console.log("Migration complete:", DB_PATH);
  db.close();
}

migrate();
