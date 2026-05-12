"use client";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { PriorityBadge } from "@/components/priority-badge";
import { StatusBadge } from "@/components/status-badge";
import { SlaResolveBadge } from "@/components/sla-badge";
import { shortId } from "@/lib/id";
import type { Incident } from "@/db/schema";
import { format } from "date-fns";

interface Props {
  incidents: Incident[];
  now: number;
  role?: "admin" | "member";
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
}

export function IncidentTable({
  incidents,
  now,
  role,
  selectedIds = new Set(),
  onSelectionChange,
}: Props) {
  const router = useRouter();
  const isAdmin = role === "admin";

  function toggleOne(id: string) {
    if (!isAdmin || !onSelectionChange) return;
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectionChange(next);
  }

  function toggleAll() {
    if (!isAdmin || !onSelectionChange) return;
    if (selectedIds.size === incidents.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(incidents.map((i) => i.id)));
    }
  }

  if (incidents.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        インシデントはありません
      </div>
    );
  }

  const allChecked = incidents.length > 0 && selectedIds.size === incidents.length;
  const someChecked = selectedIds.size > 0 && selectedIds.size < incidents.length;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <Checkbox
              checked={allChecked}
              indeterminate={someChecked}
              onCheckedChange={toggleAll}
              disabled={!isAdmin}
              aria-label="全選択"
            />
          </TableHead>
          <TableHead className="w-28">ID</TableHead>
          <TableHead>タイトル</TableHead>
          <TableHead className="w-32">優先度</TableHead>
          <TableHead className="w-32">ステータス</TableHead>
          <TableHead className="w-40">SLA (解決)</TableHead>
          <TableHead className="w-28">起票者</TableHead>
          <TableHead className="w-32">担当者</TableHead>
          <TableHead className="w-36">起票日</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {incidents.map((inc) => {
          const isDeleted = inc.deletedAt != null;
          const isSelected = selectedIds.has(inc.id);
          return (
            <TableRow
              key={inc.id}
              className={`${isDeleted ? "opacity-40" : "cursor-pointer hover:bg-muted/50"} ${isSelected ? "bg-muted/30" : ""}`}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('[role="checkbox"]')) return;
                if (!isDeleted) router.push(`/incidents/${inc.id}`);
              }}
            >
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleOne(inc.id)}
                  disabled={!isAdmin}
                  aria-label={`${inc.id} を選択`}
                />
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {shortId(inc.id)}
                {isDeleted && (
                  <span className="ml-1 text-[10px] text-destructive font-medium">削除済</span>
                )}
              </TableCell>
              <TableCell className={`font-medium max-w-xs truncate ${isDeleted ? "line-through" : ""}`}>
                {inc.title}
              </TableCell>
              <TableCell>
                <PriorityBadge priority={inc.priority} />
              </TableCell>
              <TableCell>
                <StatusBadge status={inc.status} />
              </TableCell>
              <TableCell>
                {isDeleted ? "—" : <SlaResolveBadge incident={inc} now={now} />}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {inc.reporter}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {inc.assignee ?? "—"}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {format(new Date(inc.createdAt), "yyyy/MM/dd HH:mm")}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
