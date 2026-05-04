import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

export async function GET(req: NextRequest) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "GitHub OAuth が設定されていません" }, { status: 503 });
  }

  const from = req.nextUrl.searchParams.get("from") ?? "/";
  const csrf = randomBytes(16).toString("hex");
  // state = "<csrf>:<from>" — verified in callback to prevent CSRF
  const state = `${csrf}:${encodeURIComponent(from)}`;

  const params = new URLSearchParams({
    client_id: clientId,
    scope: "read:user user:email",
    state,
  });

  const res = NextResponse.redirect(
    `https://github.com/login/oauth/authorize?${params}`
  );
  res.cookies.set("github_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 300, // 5 minutes
  });
  return res;
}
