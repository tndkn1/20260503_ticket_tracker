import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { incidents, auditLog } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { notifyStatusChanged } from "@/lib/slack";
import { getCloudflareContext } from "@opennextjs/cloudflare";


function getD1(): D1Database | undefined {
  try {
    return (getCloudflareContext() as any).env?.DB as D1Database | undefined;
  } catch {
    return undefined;
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb(getD1());
  const [incident] = await db
    .select()
    .from(incidents)
    .where(eq(incidents.id, id));

  if (!incident) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const log = await db
    .select()
    .from(auditLog)
    .where(eq(auditLog.incidentId, id))
    .orderBy(asc(auditLog.createdAt));

  return NextResponse.json({ incident, log });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb(getD1());
  const body = await req.json();
  const { actor, comment, ...fields } = body;

  if (!actor) {
    return NextResponse.json({ error: "actor is required" }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(incidents)
    .where(eq(incidents.id, id));

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const now = Date.now();
  const updates: Record<string, unknown> = { updatedAt: now };
  const logEntries: {
    incidentId: string;
    actor: string;
    field: string;
    oldValue: string | null;
    newValue: string | null;
    comment: string | null;
    createdAt: number;
  }[] = [];

  const trackable = ["status", "priority", "assignee", "title", "description"];

  for (const key of trackable) {
    if (key in fields) {
      const oldVal = String((existing as any)[key] ?? "");
      const newVal = String(fields[key] ?? "");
      if (oldVal !== newVal) {
        updates[key] = fields[key];
        logEntries.push({
          incidentId: id,
          actor,
          field: key,
          oldValue: oldVal || null,
          newValue: newVal || null,
          comment: comment ?? null,
          createdAt: now,
        });
      }
    }
  }

  if (
    fields.status &&
    fields.status !== "new" &&
    existing.status === "new" &&
    !existing.respondedAt
  ) {
    updates.respondedAt = now;
    if (now > existing.slaResponseDeadline) {
      updates.slaResponseBreached = true;
    }
  }

  if (
    fields.status &&
    (fields.status === "resolved" || fields.status === "closed") &&
    !existing.resolvedAt
  ) {
    updates.resolvedAt = now;
    if (now > existing.slaResolveDeadline) {
      updates.slaResolveBreached = true;
    }
  }

  if (Object.keys(updates).length > 1) {
    await db.update(incidents).set(updates).where(eq(incidents.id, id));
  }

  if (logEntries.length > 0) {
    await db.insert(auditLog).values(logEntries);
  }

  if (comment && logEntries.length === 0) {
    await db.insert(auditLog).values({
      incidentId: id,
      actor,
      field: "comment",
      oldValue: null,
      newValue: null,
      comment,
      createdAt: now,
    });
  }

  if (fields.status && fields.status !== existing.status) {
    const updated = { ...existing, ...updates };
    await notifyStatusChanged(updated as any, existing.status, actor);
  }

  const [updated] = await db
    .select()
    .from(incidents)
    .where(eq(incidents.id, id));

  return NextResponse.json(updated);
}
