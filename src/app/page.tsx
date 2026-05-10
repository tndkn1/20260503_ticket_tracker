"use client";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { IncidentTable } from "@/components/incidents/incident-table";
import { CreateIncidentDialog } from "@/components/incidents/create-dialog";
import { Plus, RefreshCw, AlertTriangle, Trash2 } from "lucide-react";
import { UserMenu } from "@/components/user-menu";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { Incident } from "@/db/schema";

interface Stats {
  total: number;
  openCount: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  slaResponseBreached: number;
  slaResolveBreached: number;
  avgResolveMinutes: number | null;
}

function fmtMinutes(min: number | null) {
  if (min === null) return "—";
  if (min < 60) return `${min}分`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}時間${m}分` : `${h}時間`;
}

export default function HomePage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<"admin" | "member" | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleted, setShowDeleted] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setRole(data?.user?.role ?? null))
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setSelectedIds(new Set());
    try {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterPriority !== "all") params.set("priority", filterPriority);
      if (search) params.set("q", search);
      if (showDeleted) params.set("includeDeleted", "true");

      const [incRes, statsRes] = await Promise.all([
        fetch(`/api/incidents?${params}`),
        fetch("/api/stats"),
      ]);
      const [incData, statsData] = await Promise.all([
        incRes.json(),
        statsRes.json(),
      ]);
      setIncidents(incData);
      setStats(statsData);
      setNow(Date.now());
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterPriority, search, showDeleted]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  async function handleDelete() {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/incidents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error();
      const { deleted } = await res.json();
      toast.success(`${deleted} 件のインシデントを削除しました`);
      fetchData();
    } catch {
      toast.error("削除に失敗しました");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            <span className="font-semibold text-lg">ITSM Incident Tracker</span>
          </div>
          <div className="flex items-center gap-3">
            <UserMenu />
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-1" />
              インシデント起票
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard title="総インシデント" value={stats.total} accent="blue" />
            <StatCard title="未解決" value={stats.openCount} accent="orange" />
            <StatCard
              title="P1 Active"
              value={stats.byPriority.p1 ?? 0}
              accent={stats.byPriority.p1 > 0 ? "red" : "default"}
            />
            <StatCard
              title="SLA応答違反"
              value={stats.slaResponseBreached}
              accent={stats.slaResponseBreached > 0 ? "red" : "green"}
            />
            <StatCard
              title="SLA解決違反"
              value={stats.slaResolveBreached}
              accent={stats.slaResolveBreached > 0 ? "red" : "green"}
            />
            <StatCard
              title="平均解決時間"
              value={fmtMinutes(stats.avgResolveMinutes)}
              accent="default"
            />
          </div>
        )}

        {stats && (
          <div className="grid grid-cols-5 gap-2">
            {(["new", "assigned", "in_progress", "resolved", "closed"] as const).map(
              (s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(filterStatus === s ? "all" : s)}
                  className={`rounded-lg border px-3 py-2 text-center text-xs transition-colors ${
                    filterStatus === s
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card hover:bg-muted"
                  }`}
                >
                  <div className="font-bold text-lg tabular-nums">
                    {stats.byStatus[s] ?? 0}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide opacity-70">
                    {s.replace("_", " ")}
                  </div>
                </button>
              )
            )}
          </div>
        )}

        <Card>
          <CardHeader className="py-3 px-4">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="タイトル・説明・報告者で検索..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-64"
              />
              <Select value={filterPriority} onValueChange={(v) => setFilterPriority(v ?? "all")}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="優先度" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべての優先度</SelectItem>
                  <SelectItem value="p1">P1 Critical</SelectItem>
                  <SelectItem value="p2">P2 High</SelectItem>
                  <SelectItem value="p3">P3 Medium</SelectItem>
                  <SelectItem value="p4">P4 Low</SelectItem>
                </SelectContent>
              </Select>

              {role === "admin" && (
                <div className="flex items-center gap-1.5">
                  <Switch
                    id="show-deleted"
                    checked={showDeleted}
                    onCheckedChange={setShowDeleted}
                  />
                  <Label htmlFor="show-deleted" className="text-xs text-muted-foreground cursor-pointer">
                    削除済みを表示
                  </Label>
                </div>
              )}

              <Button
                variant="outline"
                size="icon"
                onClick={fetchData}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>

              {role === "admin" && selectedIds.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  {selectedIds.size} 件を削除
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <IncidentTable
              incidents={incidents}
              now={now}
              role={role ?? undefined}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
            />
          </CardContent>
        </Card>
      </main>

      <CreateIncidentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={fetchData}
      />
    </div>
  );
}
