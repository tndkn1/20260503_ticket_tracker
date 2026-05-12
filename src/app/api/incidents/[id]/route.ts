import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { incidents, auditLog } from "@/db/schema";
import type { Incident } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { notifyStatusChanged } from "@/lib/slack";

type TrackableField = "status" | "priority" | "assignee" | "title" | "description";
type IncidentPatchBody = Partial<Pick<Incident, TrackableField>> & {
  actor?: string;
  comment?: string | null;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
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
  const db = getDb();
  const body = (await req.json()) as IncidentPatchBody;
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
  const updates: Partial<Incident> = { updatedAt: now };
  const logEntries: {
    incidentId: string;
    actor: string;
    field: string;
    oldValue: string | null;
    newValue: string | null;
    comment: string | null;
    createdAt: number;
  }[] = [];

  const trackable: TrackableField[] = [
    "status",
    "priority",
    "assignee",
    "title",
    "description",
  ];

  for (const key of trackable) {
    if (key in fields) {
      const newValue = fields[key];
      const oldVal = String(existing[key] ?? "");
      const newVal = String(newValue ?? "");
      if (oldVal !== newVal) {
        Object.assign(updates, { [key]: newValue });
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
    await notifyStatusChanged(updated, existing.status, actor);
  }

  const [updated] = await db
    .select()
    .from(incidents)
    .where(eq(incidents.id, id));

  return NextResponse.json(updated);
}
