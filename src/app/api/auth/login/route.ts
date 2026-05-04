import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword, signToken, sessionCookieOptions } from "@/lib/auth";
import { getCloudflareContext } from "@opennextjs/cloudflare";

function getD1(): D1Database | undefined {
  try { return (getCloudflareContext() as any).env?.DB; } catch { return undefined; }
}

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  if (!username || !password) {
    return NextResponse.json({ error: "username と password は必須です" }, { status: 400 });
  }

  const db = getDb(getD1());
  const [user] = await db.select().from(users).where(eq(users.username, username));

  if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "ユーザー名またはパスワードが正しくありません" }, { status: 401 });
  }

  const token = await signToken({
    userId: user.id,
    username: user.username,
    email: user.email,
    role: user.role as "admin" | "member",
  });

  const res = NextResponse.json({
    user: { id: user.id, username: user.username, email: user.email, role: user.role },
  });
  res.cookies.set(sessionCookieOptions(token));
  return res;
}
