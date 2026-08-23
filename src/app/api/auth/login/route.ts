import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword, signToken, sessionCookieOptions } from "@/lib/auth";
import { notifyLoginAttempt } from "@/lib/slack";

function getClientIp(req: NextRequest): string | undefined {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    undefined
  );
}

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();
  const ip = getClientIp(req);

  if (!username || !password) {
    return NextResponse.json({ error: "username と password は必須です" }, { status: 400 });
  }

  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.username, username));

  if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    const reason = !user ? "ユーザーが存在しない" : "パスワード不一致";
    notifyLoginAttempt({ username, success: false, ip, reason }).catch(() => {});
    return NextResponse.json({ error: "ユーザー名またはパスワードが正しくありません" }, { status: 401 });
  }

  const token = await signToken({
    userId: user.id,
    username: user.username,
    email: user.email,
    role: user.role as "admin" | "member",
  });

  notifyLoginAttempt({ username: user.username, success: true, ip }).catch(() => {});

  const res = NextResponse.json({
    user: { id: user.id, username: user.username, email: user.email, role: user.role },
  });
  res.cookies.set(sessionCookieOptions(token));
  return res;
}
