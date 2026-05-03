import * as schema from "./schema";

let _localDb: ReturnType<typeof createLocalDb> | null = null;

function createLocalDb() {
  // These imports are excluded from edge builds via webpack alias in next.config.ts
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/better-sqlite3");
  const dbPath = process.env.DB_PATH ?? "data/itsm.db";
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  return drizzle(sqlite, { schema }) as import("drizzle-orm/better-sqlite3").BetterSQLite3Database<typeof schema>;
}

function createD1Db(d1: D1Database) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/d1");
  return drizzle(d1, { schema }) as import("drizzle-orm/d1").DrizzleD1Database<typeof schema>;
}

export type AppDb = ReturnType<typeof createLocalDb> | ReturnType<typeof createD1Db>;

export function getDb(d1?: D1Database): AppDb {
  if (d1) {
    return createD1Db(d1);
  }
  if (!_localDb) {
    _localDb = createLocalDb();
  }
  return _localDb;
}
