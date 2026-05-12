import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { incidents } from "@/db/schema";
import { eq, not, inArray } from "drizzle-orm";
import { notifySlaBreached } from "@/lib/slack";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  return req.headers.get("authorization") === `Bearer ${secret}`;
}

async function runSlaCheck() {
  const db = getDb();
  const now = Date.now();

  const active = await db
    .select()
    .from(incidents)
    .where(not(inArray(incidents.status, ["resolved", "closed"])));

  let responseBreached = 0;
  let resolveBreached = 0;

  for (const inc of active) {
    const updates: Record<string, unknown> = {};

    if (!inc.slaResponseBreached && !inc.respondedAt && now > inc.slaResponseDeadline) {
      updates.slaResponseBreached = true;
      responseBreached++;
      await notifySlaBreached(inc, "response");
    }

    if (!inc.slaResolveBreached && now > inc.slaResolveDeadline) {
      updates.slaResolveBreached = true;
      resolveBreached++;
      await notifySlaBreached(inc, "resolve");
    }

    if (Object.keys(updates).length > 0) {
      await db.update(incidents).set(updates).where(eq(incidents.id, inc.id));
    }
  }

  return NextResponse.json({ checked: active.length, responseBreached, resolveBreached });
}

async function handleSlaCheck(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runSlaCheck();
}

export async function GET(req: NextRequest) {
  return handleSlaCheck(req);
}

export async function POST(req: NextRequest) {
  return handleSlaCheck(req);
}
