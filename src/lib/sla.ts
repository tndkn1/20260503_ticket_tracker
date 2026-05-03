import type { Incident } from "@/db/schema";

export const SLA_DEFAULTS: Record<
  string,
  { responseMinutes: number; resolveMinutes: number; label: string }
> = {
  p1: { responseMinutes: 15,   resolveMinutes: 240,  label: "Critical" },
  p2: { responseMinutes: 60,   resolveMinutes: 480,  label: "High" },
  p3: { responseMinutes: 240,  resolveMinutes: 1440, label: "Medium" },
  p4: { responseMinutes: 1440, resolveMinutes: 4320, label: "Low" },
};

export function computeSlaDeadlines(
  priority: string,
  createdAt: number
): { slaResponseDeadline: number; slaResolveDeadline: number } {
  const cfg = SLA_DEFAULTS[priority] ?? SLA_DEFAULTS.p3;
  return {
    slaResponseDeadline: createdAt + cfg.responseMinutes * 60 * 1000,
    slaResolveDeadline:  createdAt + cfg.resolveMinutes  * 60 * 1000,
  };
}

export type SlaStatus = "ok" | "warning" | "breached";

export function getSlaStatus(
  deadline: number,
  now: number,
  achieved: boolean
): SlaStatus {
  if (achieved) return "ok";
  if (now > deadline) return "breached";
  if (now > deadline - 30 * 60 * 1000) return "warning"; // 30 min buffer
  return "ok";
}

export function formatRemaining(deadline: number, now: number): string {
  const diff = deadline - now;
  if (diff <= 0) {
    const over = Math.abs(diff);
    const h = Math.floor(over / 3600000);
    const m = Math.floor((over % 3600000) / 60000);
    return h > 0 ? `-${h}h ${m}m` : `-${m}m`;
  }
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function isActive(incident: Incident): boolean {
  return incident.status !== "resolved" && incident.status !== "closed";
}
