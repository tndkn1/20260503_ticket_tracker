import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { incidents, auditLog } from "@/db/schema";
import { desc } from "drizzle-orm";
import { generateId } from "@/lib/id";
import { computeSlaDeadlines } from "@/lib/sla";
import { notifyIncidentCreated } from "@/lib/slack";

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");
  const q = searchParams.get("q");

  const rows = await db.select().from(incidents).orderBy(desc(incidents.createdAt));

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

  const now = Date.now();
  const id = generateId();
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

  await notifyIncidentCreated(newIncident as any);

  return NextResponse.json(newIncident, { status: 201 });
}
