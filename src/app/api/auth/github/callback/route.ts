import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { signToken, sessionCookieOptions } from "@/lib/auth";
import { jwtVerify } from "jose";

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET env var is not set");
  return new TextEncoder().encode(secret);
}

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

async function getGitHubUser(accessToken: string): Promise<GitHubUser> {
  const res = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error("GitHub user API failed");
  return res.json();
}

async function getGitHubPrimaryEmail(accessToken: string): Promise<string> {
  const res = await fetch("https://api.github.com/user/emails", {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error("GitHub email API failed");
  const emails: GitHubEmail[] = await res.json();
  const primary = emails.find((e) => e.primary && e.verified);
  if (!primary) throw new Error("認証済みのメールアドレスが見つかりません");
  return primary.email;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  // CSRF check: state は JWT 署名で検証する (Cookie 不要)
  let from = "/";
  if (!state) {
    return NextResponse.redirect(new URL("/login?error=invalid_state", req.url));
  }
  try {
    const { payload } = await jwtVerify(state, getSecret());
    from = (payload.from as string) ?? "/";
  } catch {
    return NextResponse.redirect(new URL("/login?error=invalid_state", req.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL(`/login?error=no_code&from=${encodeURIComponent(from)}`, req.url));
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/login?error=misconfigured", req.url));
  }

  try {
    // Exchange code for access token
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    });
    const tokenData: { access_token?: string; error?: string } = await tokenRes.json();
    if (!tokenData.access_token) {
      return NextResponse.redirect(new URL("/login?error=token_exchange", req.url));
    }

    const accessToken = tokenData.access_token;
    const ghUser = await getGitHubUser(accessToken);
    const email = ghUser.email ?? await getGitHubPrimaryEmail(accessToken);
    const githubId = String(ghUser.id);
    const username = ghUser.login;

    const db = getDb();

    // Find existing user by github_id or email
    let [user] = await db.select().from(users).where(eq(users.githubId, githubId));
    if (!user) {
      [user] = await db.select().from(users).where(eq(users.email, email));
    }

    if (user) {
      // Link github_id if not yet linked
      if (!user.githubId) {
        await db.update(users).set({ githubId }).where(eq(users.id, user.id));
        user = { ...user, githubId };
      }
    } else {
      // Create new user
      const id = `USER-${Date.now()}`;
      // Ensure username uniqueness by appending suffix if needed
      let finalUsername = username;
      const [existing] = await db.select().from(users).where(eq(users.username, username));
      if (existing) finalUsername = `${username}-gh`;

      await db.insert(users).values({
        id,
        username: finalUsername,
        email,
        passwordHash: null,
        githubId,
        role: "member",
      });
      [user] = await db.select().from(users).where(eq(users.id, id));
    }

    const token = await signToken({
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role as "admin" | "member",
    });

    const res = NextResponse.redirect(new URL(from, req.url));
    res.cookies.set(sessionCookieOptions(token));
    return res;
  } catch (err) {
    console.error("GitHub OAuth error:", err);
    return NextResponse.redirect(new URL("/login?error=oauth_failed", req.url));
  }
}
