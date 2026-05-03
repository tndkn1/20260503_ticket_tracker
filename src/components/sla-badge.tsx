"use client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getSlaStatus, formatRemaining } from "@/lib/sla";
import type { Incident } from "@/db/schema";

export function SlaResponseBadge({
  incident,
  now,
}: {
  incident: Incident;
  now: number;
}) {
  const achieved = !!incident.respondedAt;
  const status = getSlaStatus(incident.slaResponseDeadline, now, achieved);

  if (achieved) {
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 text-xs">
        応答済
      </Badge>
    );
  }

  const remaining = formatRemaining(incident.slaResponseDeadline, now);
  const cls =
    status === "breached"
      ? "bg-red-100 text-red-800 border-red-300"
      : status === "warning"
      ? "bg-orange-100 text-orange-800 border-orange-300"
      : "bg-sky-50 text-sky-700 border-sky-300";

  return (
    <Badge variant="outline" className={cn("text-xs font-mono", cls)}>
      応答 {remaining}
    </Badge>
  );
}

export function SlaResolveBadge({
  incident,
  now,
}: {
  incident: Incident;
  now: number;
}) {
  const isResolved =
    incident.status === "resolved" || incident.status === "closed";
  const status = getSlaStatus(incident.slaResolveDeadline, now, isResolved);

  if (isResolved) {
    const ok = !incident.slaResolveBreached;
    return (
      <Badge
        variant="outline"
        className={cn(
          "text-xs",
          ok
            ? "bg-green-50 text-green-700 border-green-300"
            : "bg-red-50 text-red-700 border-red-300"
        )}
      >
        {ok ? "SLA達成" : "SLA違反"}
      </Badge>
    );
  }

  const remaining = formatRemaining(incident.slaResolveDeadline, now);
  const cls =
    status === "breached"
      ? "bg-red-100 text-red-800 border-red-300"
      : status === "warning"
      ? "bg-orange-100 text-orange-800 border-orange-300"
      : "bg-emerald-50 text-emerald-700 border-emerald-300";

  return (
    <Badge variant="outline" className={cn("text-xs font-mono", cls)}>
      解決 {remaining}
    </Badge>
  );
}
