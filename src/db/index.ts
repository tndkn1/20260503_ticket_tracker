import * as schema from "./schema";
import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";

let _localDb: ReturnType<typeof createLocalDb> | null = null;
let _tursoDb: ReturnType<typeof drizzleLibsql<typeof schema>> | null = null;

function createLocalDb() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle: drizzleSqlite } = require("drizzle-orm/better-sqlite3");
  const dbPath = process.env.DB_PATH ?? "data/itsm.db";
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  return drizzleSqlite(sqlite, { schema }) as import("drizzle-orm/better-sqlite3").BetterSQLite3Database<typeof schema>;
}

function createTursoDb() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  return drizzleLibsql(client, { schema });
}

export function getDb() {
  // Turso (Vercel / TURSO_DATABASE_URL) > SQLite (local dev)
  if (process.env.TURSO_DATABASE_URL) {
    if (!_tursoDb) _tursoDb = createTursoDb();
    return _tursoDb;
  }
  if (!_localDb) _localDb = createLocalDb();
  return _localDb;
}
