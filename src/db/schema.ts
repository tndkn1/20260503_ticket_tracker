import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const incidents = sqliteTable("incidents", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status", {
    enum: ["new", "assigned", "in_progress", "resolved", "closed"],
  })
    .notNull()
    .default("new"),
  priority: text("priority", { enum: ["p1", "p2", "p3", "p4"] })
    .notNull()
    .default("p3"),
  assignee: text("assignee"),
  reporter: text("reporter").notNull(),
  // SLA timestamps
  respondedAt: integer("responded_at"),   // unix ms — first non-new status
  resolvedAt: integer("resolved_at"),     // unix ms — resolved/closed
  slaResponseDeadline: integer("sla_response_deadline").notNull(), // unix ms
  slaResolveDeadline: integer("sla_resolve_deadline").notNull(),   // unix ms
  slaResponseBreached: integer("sla_response_breached", { mode: "boolean" })
    .notNull()
    .default(false),
  slaResolveBreached: integer("sla_resolve_breached", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
});

export const auditLog = sqliteTable("audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  incidentId: text("incident_id")
    .notNull()
    .references(() => incidents.id),
  actor: text("actor").notNull(),
  field: text("field").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  comment: text("comment"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
});

export const slaConfig = sqliteTable("sla_config", {
  priority: text("priority", { enum: ["p1", "p2", "p3", "p4"] }).primaryKey(),
  responseMinutes: integer("response_minutes").notNull(),
  resolveMinutes: integer("resolve_minutes").notNull(),
});

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  githubId: text("github_id").unique(),
  role: text("role", { enum: ["admin", "member"] }).notNull().default("member"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
});

export type Incident = typeof incidents.$inferSelect;
export type NewIncident = typeof incidents.$inferInsert;
export type AuditLogEntry = typeof auditLog.$inferSelect;
export type NewAuditLogEntry = typeof auditLog.$inferInsert;
export type SlaConfig = typeof slaConfig.$inferSelect;
export type User = typeof users.$inferSelect;
