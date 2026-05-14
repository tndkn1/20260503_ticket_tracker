import { NextRequest, NextResponse } from "next/server";
import { getSession, hashPassword } from "@/lib/auth";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendWelcomeEmail } from "@/lib/email";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = getDb();
  const all = await db.select().from(users).orderBy(users.createdAt);

  return NextResponse.json(
    all.map(({ id, username, email, role, createdAt }) => ({ id, username, email, role, createdAt }))
  );
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { username, email, password, role = "member" } = await req.json();
  if (!username || !email || !password) {
    return NextResponse.json({ error: "username, email, password は必須です" }, { status: 400 });
  }

  const db = getDb();

  const [existing] = await db.select().from(users).where(eq(users.username, username));
  if (existing) {
    return NextResponse.json({ error: "そのユーザー名は既に使用されています" }, { status: 409 });
  }

  const [existingEmail] = await db.select().from(users).where(eq(users.email, email));
  if (existingEmail) {
    return NextResponse.json({ error: "そのメールアドレスは既に使用されています" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const id = `USER-${Date.now()}`;

  await db.insert(users).values({ id, username, email, passwordHash, role });

  await sendWelcomeEmail({ to: email, username, password });

  return NextResponse.json({ id, username, email, role }, { status: 201 });
}
