import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { incidents } from "@/db/schema";
import { isNull } from "drizzle-orm";

export async function GET() {
  const db = getDb();
  const all = await db.select().from(incidents).where(isNull(incidents.deletedAt));

  const total = all.length;
  const byStatus = {
    new: 0, assigned: 0, in_progress: 0, resolved: 0, closed: 0,
  } as Record<string, number>;
  const byPriority = { p1: 0, p2: 0, p3: 0, p4: 0 } as Record<string, number>;

  let slaResponseBreached = 0;
  let slaResolveBreached = 0;
  let totalResolveMs = 0;
  let resolvedCount = 0;

  for (const inc of all) {
    byStatus[inc.status] = (byStatus[inc.status] ?? 0) + 1;
    byPriority[inc.priority] = (byPriority[inc.priority] ?? 0) + 1;
    if (inc.slaResponseBreached) slaResponseBreached++;
    if (inc.slaResolveBreached) slaResolveBreached++;
    if (inc.resolvedAt) {
      totalResolveMs += inc.resolvedAt - inc.createdAt;
      resolvedCount++;
    }
  }

  const avgResolveMs = resolvedCount > 0 ? totalResolveMs / resolvedCount : null;

  return NextResponse.json({
    total,
    byStatus,
    byPriority,
    slaResponseBreached,
    slaResolveBreached,
    avgResolveMinutes: avgResolveMs ? Math.round(avgResolveMs / 60000) : null,
    openCount: byStatus.new + byStatus.assigned + byStatus.in_progress,
  });
}
