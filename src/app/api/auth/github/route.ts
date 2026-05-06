import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET env var is not set");
  return new TextEncoder().encode(secret);
}

export async function GET(req: NextRequest) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "GitHub OAuth が設定されていません" }, { status: 503 });
  }

  const from = req.nextUrl.searchParams.get("from") ?? "/";

  // State は JWT として署名する — Cookie 不要でどの環境でも動作する
  const state = await new SignJWT({ from })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(getSecret());

  const params = new URLSearchParams({
    client_id: clientId,
    scope: "read:user user:email",
    state,
  });

  return NextResponse.redirect(
    `https://github.com/login/oauth/authorize?${params}`
  );
}
