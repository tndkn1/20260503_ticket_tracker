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
import { PriorityBadge } from "@/components/priority-badge";
import { StatusBadge } from "@/components/status-badge";
import { SlaResolveBadge } from "@/components/sla-badge";
import { shortId } from "@/lib/id";
import type { Incident } from "@/db/schema";
import { format } from "date-fns";

interface Props {
  incidents: Incident[];
  now: number;
}

export function IncidentTable({ incidents, now }: Props) {
  const router = useRouter();

  if (incidents.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        インシデントはありません
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-28">ID</TableHead>
          <TableHead>タイトル</TableHead>
          <TableHead className="w-32">優先度</TableHead>
          <TableHead className="w-32">ステータス</TableHead>
          <TableHead className="w-40">SLA (解決)</TableHead>
          <TableHead className="w-32">担当者</TableHead>
          <TableHead className="w-36">起票日</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {incidents.map((inc) => (
          <TableRow
            key={inc.id}
            className="cursor-pointer hover:bg-muted/50"
            onClick={() => router.push(`/incidents/${inc.id}`)}
          >
            <TableCell className="font-mono text-xs text-muted-foreground">
              {shortId(inc.id)}
            </TableCell>
            <TableCell className="font-medium max-w-xs truncate">
              {inc.title}
            </TableCell>
            <TableCell>
              <PriorityBadge priority={inc.priority} />
            </TableCell>
            <TableCell>
              <StatusBadge status={inc.status} />
            </TableCell>
            <TableCell>
              <SlaResolveBadge incident={inc} now={now} />
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {inc.assignee ?? "—"}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {format(new Date(inc.createdAt), "yyyy/MM/dd HH:mm")}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
