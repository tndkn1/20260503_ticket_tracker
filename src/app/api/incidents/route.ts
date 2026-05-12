import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { incidents, auditLog, sequences } from "@/db/schema";
import { desc, eq, isNull, isNotNull } from "drizzle-orm";
import { generateId } from "@/lib/id";
import { computeSlaDeadlines } from "@/lib/sla";
import { notifyIncidentCreated } from "@/lib/slack";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");
  const q = searchParams.get("q");
  const includeDeleted = searchParams.get("includeDeleted") === "true";
  const role = req.headers.get("x-user-role");

  const rows = await db
    .select()
    .from(incidents)
    .where(
      includeDeleted && role === "admin"
        ? isNotNull(incidents.deletedAt)
        : isNull(incidents.deletedAt)
    )
    .orderBy(desc(incidents.createdAt));

  const filtered = rows.filter((r) => {
    if (status && r.status !== status) return false;
    if (priority && r.priority !== priority) return false;
    if (q) {
      const lower = q.toLowerCase();
      if (
        !r.title.toLowerCase().includes(lower) &&
        !r.description.toLowerCase().includes(lower) &&
        !r.reporter.toLowerCase().includes(lower)
      )
        return false;
    }
    return true;
  });

  return NextResponse.json(filtered);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const reporter = req.headers.get("x-username");
  if (!reporter) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { title, description, priority = "p3", assignee } = body;

  if (!title || !description) {
    return NextResponse.json(
      { error: "title and description are required" },
      { status: 400 }
    );
  }

  const [current] = await db.select().from(sequences).where(eq(sequences.name, "incident"));
  const nextVal = (current?.value ?? 0) + 1;
  if (current) {
    await db.update(sequences).set({ value: nextVal }).where(eq(sequences.name, "incident"));
  } else {
    await db.insert(sequences).values({ name: "incident", value: nextVal });
  }

  const now = Date.now();
  const id = generateId(nextVal);
  const { slaResponseDeadline, slaResolveDeadline } = computeSlaDeadlines(priority, now);

  const newIncident = {
    id,
    title,
    description,
    priority,
    assignee: assignee ?? null,
    reporter,
    status: "new" as const,
    slaResponseDeadline,
    slaResolveDeadline,
    slaResponseBreached: false,
    slaResolveBreached: false,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(incidents).values(newIncident);

  await db.insert(auditLog).values({
    incidentId: id,
    actor: reporter,
    field: "status",
    oldValue: null,
    newValue: "new",
    comment: `インシデント起票: ${title}`,
    createdAt: now,
  });

  await notifyIncidentCreated(newIncident);

  return NextResponse.json(newIncident, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const actor = session.username;

  const { ids } = await req.json() as { ids: string[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids is required" }, { status: 400 });
  }

  const db = getDb();
  const now = Date.now();

  for (const id of ids) {
    await db
      .update(incidents)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(incidents.id, id));

    await db.insert(auditLog).values({
      incidentId: id,
      actor,
      field: "deleted_at",
      oldValue: null,
      newValue: String(now),
      comment: "論理削除",
      createdAt: now,
    });
  }

  return NextResponse.json({ deleted: ids.length });
}
