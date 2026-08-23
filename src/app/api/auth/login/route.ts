import { NextRequest, NextResponse, after } from "next/server";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword, signToken, sessionCookieOptions } from "@/lib/auth";
import { notifyLoginAttempt } from "@/lib/slack";

// x-real-ip (Vercel が設定するクライアント IP) を優先し、
// x-forwarded-for は末尾値（プロキシが追加した値）を使用
function getClientIp(req: NextRequest): string | undefined {
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",");
    return parts[parts.length - 1].trim();
  }
  return undefined;
}

// 同一 IP からの失敗通知を 60 秒間に最大 3 件に制限（チャンネル flooding 防止）
const failureCache = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_NOTIFS = 3;

function canNotifyFailure(ip: string | undefined): boolean {
  const key = ip ?? "unknown";
  const now = Date.now();
  const recent = (failureCache.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_NOTIFS) return false;
  recent.push(now);
  failureCache.set(key, recent);
  return true;
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
    const reason = !user
      ? "ユーザーが存在しない"
      : !user.passwordHash
      ? "パスワード認証が利用できないアカウント（GitHub OAuth 専用）"
      : "パスワード不一致";
    if (canNotifyFailure(ip)) {
      after(() => notifyLoginAttempt({ username, success: false, ip, reason }).catch(() => {}));
    }
    return NextResponse.json({ error: "ユーザー名またはパスワードが正しくありません" }, { status: 401 });
  }

  after(() => notifyLoginAttempt({ username: user.username, success: true, ip }).catch(() => {}));

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
