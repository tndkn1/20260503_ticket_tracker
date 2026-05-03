"use client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const PRIORITY_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  p1: { label: "P1 Critical", className: "bg-red-100 text-red-800 border-red-300" },
  p2: { label: "P2 High",     className: "bg-orange-100 text-orange-800 border-orange-300" },
  p3: { label: "P3 Medium",   className: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  p4: { label: "P4 Low",      className: "bg-gray-100 text-gray-700 border-gray-300" },
};

export function PriorityBadge({ priority }: { priority: string }) {
  const cfg = PRIORITY_CONFIG[priority] ?? { label: priority, className: "" };
  return (
    <Badge variant="outline" className={cn("font-mono text-xs", cfg.className)}>
      {cfg.label}
    </Badge>
  );
}
