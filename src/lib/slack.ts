import type { Incident } from "@/db/schema";
import { SLA_DEFAULTS } from "./sla";
import { shortId } from "./id";

type CreatedIncident = Pick<
  Incident,
  "id" | "priority" | "title" | "status" | "reporter"
>;
type StatusIncident = Pick<Incident, "id" | "status" | "title">;
type SlaIncident = Pick<Incident, "id" | "title" | "priority" | "assignee">;

const WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL ?? "";

const PRIORITY_EMOJI: Record<string, string> = {
  p1: ":red_circle:",
  p2: ":orange_circle:",
  p3: ":yellow_circle:",
  p4: ":white_circle:",
};

async function send(payload: object) {
  if (!WEBHOOK_URL) return;
  await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

export async function notifyIncidentCreated(incident: CreatedIncident) {
  const label = SLA_DEFAULTS[incident.priority]?.label ?? incident.priority;
  await send({
    text: `${PRIORITY_EMOJI[incident.priority] ?? ""} *新規インシデント* ${shortId(incident.id)}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${PRIORITY_EMOJI[incident.priority]} *[${label}] ${shortId(incident.id)}* — ${incident.title}`,
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*ステータス:*\n${incident.status}` },
          { type: "mrkdwn", text: `*報告者:*\n${incident.reporter}` },
        ],
      },
    ],
  });
}

export async function notifyStatusChanged(
  incident: StatusIncident,
  oldStatus: string,
  actor: string
) {
  await send({
    text: `ステータス変更 ${shortId(incident.id)}: ${oldStatus} → ${incident.status}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${shortId(incident.id)}* ステータス変更: *${oldStatus}* → *${incident.status}*\n> ${incident.title}\n更新者: ${actor}`,
        },
      },
    ],
  });
}

export async function notifySlaBreached(
  incident: SlaIncident,
  type: "response" | "resolve"
) {
  const label = type === "response" ? "応答時間" : "解決時間";
  await send({
    text: `:alarm_clock: SLA違反 (${label}) ${shortId(incident.id)}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:alarm_clock: *SLA違反 — ${label}* ${shortId(incident.id)}\n> ${incident.title}\n優先度: ${incident.priority.toUpperCase()} | 担当: ${incident.assignee ?? "未割り当て"}`,
        },
      },
    ],
  });
}
