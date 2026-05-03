import * as schema from "./schema";
import { drizzle as drizzleD1 } from "drizzle-orm/d1";

let _localDb: ReturnType<typeof createLocalDb> | null = null;

function createLocalDb() {
  // These requires are excluded from edge builds via webpack alias in next.config.ts.
  // On Cloudflare Workers this path is never reached because d1 is always provided.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle: drizzleSqlite } = require("drizzle-orm/better-sqlite3");
  const dbPath = process.env.DB_PATH ?? "data/itsm.db";
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  return drizzleSqlite(sqlite, { schema }) as import("drizzle-orm/better-sqlite3").BetterSQLite3Database<typeof schema>;
}

export function getDb(d1?: D1Database) {
  if (d1) {
    return drizzleD1(d1, { schema });
  }
  if (!_localDb) {
    _localDb = createLocalDb();
  }
  return _localDb;
}
