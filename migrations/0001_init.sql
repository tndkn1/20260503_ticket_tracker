CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  priority TEXT NOT NULL DEFAULT 'p3',
  assignee TEXT,
  reporter TEXT NOT NULL,
  responded_at INTEGER,
  resolved_at INTEGER,
  sla_response_deadline INTEGER NOT NULL,
  sla_resolve_deadline INTEGER NOT NULL,
  sla_response_breached INTEGER NOT NULL DEFAULT 0,
  sla_resolve_breached INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_id TEXT NOT NULL REFERENCES incidents(id),
  actor TEXT NOT NULL,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  comment TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sla_config (
  priority TEXT PRIMARY KEY,
  response_minutes INTEGER NOT NULL,
  resolve_minutes INTEGER NOT NULL
);

INSERT OR IGNORE INTO sla_config VALUES ('p1', 15,   240);
INSERT OR IGNORE INTO sla_config VALUES ('p2', 60,   480);
INSERT OR IGNORE INTO sla_config VALUES ('p3', 240,  1440);
INSERT OR IGNORE INTO sla_config VALUES ('p4', 1440, 4320);
