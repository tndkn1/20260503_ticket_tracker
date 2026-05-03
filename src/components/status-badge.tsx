"use client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  new:         { label: "New",         className: "bg-blue-100 text-blue-800 border-blue-300" },
  assigned:    { label: "Assigned",    className: "bg-purple-100 text-purple-800 border-purple-300" },
  in_progress: { label: "In Progress", className: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  resolved:    { label: "Resolved",    className: "bg-green-100 text-green-800 border-green-300" },
  closed:      { label: "Closed",      className: "bg-gray-100 text-gray-600 border-gray-300" },
};

export function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, className: "" };
  return (
    <Badge variant="outline" className={cn("text-xs", cfg.className)}>
      {cfg.label}
    </Badge>
  );
}
