import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { incidents } from "@/db/schema";
import { eq, not, inArray } from "drizzle-orm";
import { notifySlaBreached } from "@/lib/slack";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const runtime = "edge";

function getD1(): D1Database | undefined {
  try {
    return (getCloudflareContext() as any).env?.DB as D1Database | undefined;
  } catch {
    return undefined;
  }
}

export async function POST() {
  const db = getDb(getD1());
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
