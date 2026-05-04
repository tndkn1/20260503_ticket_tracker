/**
 * 初期管理者アカウントを作成するスクリプト。
 * 使用例: npx tsx src/db/seed-user.ts admin admin@example.com password123
 */
import Database from "better-sqlite3";
import path from "path";
import crypto from "crypto";

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), "data", "itsm.db");

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, 100_000, 32, "sha256", (err, derived) => {
      if (err) return reject(err);
      resolve(`${salt.toString("hex")}:${derived.toString("hex")}`);
    });
  });
}

async function seed() {
  const [, , username, email, password, role = "admin"] = process.argv;
  if (!username || !email || !password) {
    console.error("Usage: npx tsx src/db/seed-user.ts <username> <email> <password> [role]");
    process.exit(1);
  }

  const db = new Database(DB_PATH);
  const hash = await hashPassword(password);
  const id = `USER-${Date.now()}`;

  db.prepare(
    "INSERT INTO users (id, username, email, password_hash, role) VALUES (?, ?, ?, ?, ?)"
  ).run(id, username, email, hash, role);

  console.log(`ユーザーを作成しました: ${username} (${role})`);
  db.close();
}

seed().catch(console.error);
