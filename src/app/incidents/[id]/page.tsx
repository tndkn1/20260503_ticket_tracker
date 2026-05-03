"use client";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { PriorityBadge } from "@/components/priority-badge";
import { StatusBadge } from "@/components/status-badge";
import { SlaResponseBadge, SlaResolveBadge } from "@/components/sla-badge";
import { shortId } from "@/lib/id";
import { toast } from "sonner";
import {
  ArrowLeft,
  Clock,
  User,
  MessageSquare,
  Edit2,
  Check,
  X,
} from "lucide-react";
import type { Incident, AuditLogEntry } from "@/db/schema";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

const STATUS_TRANSITIONS: Record<string, string[]> = {
  new:         ["assigned", "in_progress", "closed"],
  assigned:    ["in_progress", "resolved", "closed"],
  in_progress: ["resolved", "closed"],
  resolved:    ["closed", "in_progress"],
  closed:      [],
};

const FIELD_LABELS: Record<string, string> = {
  status:      "ステータス",
  priority:    "優先度",
  assignee:    "担当者",
  title:       "タイトル",
  description: "説明",
  comment:     "コメント",
};

const STATUS_LABELS: Record<string, string> = {
  new:         "New",
  assigned:    "Assigned",
  in_progress: "In Progress",
  resolved:    "Resolved",
  closed:      "Closed",
};

export default function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [log, setLog] = useState<AuditLogEntry[]>([]);
  const [now, setNow] = useState(Date.now());
  const [actor, setActor] = useState("");
  const [comment, setComment] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [editAssignee, setEditAssignee] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  async function fetchIncident() {
    const res = await fetch(`/api/incidents/${id}`);
    if (!res.ok) { router.push("/"); return; }
    const data = await res.json();
    setIncident(data.incident);
    setLog(data.log);
    setNow(Date.now());
    setEditStatus(data.incident.status);
    setEditPriority(data.incident.priority);
    setEditAssignee(data.incident.assignee ?? "");
  }

  useEffect(() => {
    fetchIncident();
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleUpdate(extra?: Record<string, string>) {
    if (!actor) { toast.error("更新者名を入力してください"); return; }
    if (!incident) return;
    setSaving(true);
    try {
      const body: Record<string, string | null> = {
        actor,
        comment: comment || null,
        status: editStatus,
        priority: editPriority,
        assignee: editAssignee || null,
        ...extra,
      };
      const res = await fetch(`/api/incidents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("更新しました");
      setComment("");
      await fetchIncident();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleTitleSave() {
    if (!actor) { toast.error("更新者名を入力してください"); return; }
    await handleUpdate({ title: titleDraft });
    setEditingTitle(false);
  }

  if (!incident) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    );
  }

  const isActive = incident.status !== "resolved" && incident.status !== "closed";
  const nextStatuses = STATUS_TRANSITIONS[incident.status] ?? [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <span className="font-mono text-sm text-muted-foreground">
            {shortId(incident.id)}
          </span>
          <Separator orientation="vertical" className="h-5" />
          <div className="flex items-center gap-2 flex-wrap">
            <PriorityBadge priority={incident.priority} />
            <StatusBadge status={incident.status} />
            <SlaResponseBadge incident={incident} now={now} />
            {isActive && <SlaResolveBadge incident={incident} now={now} />}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: main content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Title */}
          <div>
            {editingTitle ? (
              <div className="flex gap-2 items-start">
                <Input
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  className="text-xl font-semibold"
                  autoFocus
                />
                <Button size="icon" variant="ghost" onClick={handleTitleSave}>
                  <Check className="w-4 h-4 text-green-600" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setEditingTitle(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-start gap-2 group">
                <h1 className="text-xl font-semibold leading-tight flex-1">
                  {incident.title}
                </h1>
                <Button
                  size="icon"
                  variant="ghost"
                  className="opacity-0 group-hover:opacity-100 transition-opacity mt-0.5"
                  onClick={() => {
                    setTitleDraft(incident.title);
                    setEditingTitle(true);
                  }}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {incident.reporter}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {format(new Date(incident.createdAt), "yyyy/MM/dd HH:mm", { locale: ja })}
              </span>
            </div>
          </div>

          {/* Description */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">説明</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                {incident.description}
              </p>
            </CardContent>
          </Card>

          {/* SLA Details */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">SLA</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-1">応答期限</p>
                <p className="font-mono text-xs">
                  {format(new Date(incident.slaResponseDeadline), "MM/dd HH:mm")}
                </p>
                {incident.respondedAt && (
                  <p className="text-xs text-green-600 mt-0.5">
                    応答: {format(new Date(incident.respondedAt), "MM/dd HH:mm")}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">解決期限</p>
                <p className="font-mono text-xs">
                  {format(new Date(incident.slaResolveDeadline), "MM/dd HH:mm")}
                </p>
                {incident.resolvedAt && (
                  <p className="text-xs text-green-600 mt-0.5">
                    解決: {format(new Date(incident.resolvedAt), "MM/dd HH:mm")}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                タイムライン
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {log.length === 0 ? (
                <p className="text-xs text-muted-foreground">変更履歴なし</p>
              ) : (
                <ol className="relative border-l border-border ml-2 space-y-4">
                  {[...log].reverse().map((entry) => (
                    <li key={entry.id} className="ml-4">
                      <span className="absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full bg-muted border border-border" />
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-xs font-medium">{entry.actor}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(entry.createdAt), "MM/dd HH:mm")}
                        </span>
                      </div>
                      {entry.field === "comment" ? (
                        <p className="text-sm mt-0.5 text-muted-foreground">
                          {entry.comment}
                        </p>
                      ) : (
                        <p className="text-xs mt-0.5 text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {FIELD_LABELS[entry.field] ?? entry.field}
                          </span>{" "}
                          を変更:{" "}
                          <span className="line-through opacity-60">
                            {entry.field === "status"
                              ? STATUS_LABELS[entry.oldValue ?? ""] ?? entry.oldValue
                              : entry.oldValue ?? "—"}
                          </span>{" "}
                          →{" "}
                          <span className="font-medium text-foreground">
                            {entry.field === "status"
                              ? STATUS_LABELS[entry.newValue ?? ""] ?? entry.newValue
                              : entry.newValue ?? "—"}
                          </span>
                          {entry.comment && (
                            <span className="block text-muted-foreground mt-0.5">
                              {entry.comment}
                            </span>
                          )}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: actions */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">更新</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">更新者 *</Label>
                <Input
                  value={actor}
                  onChange={(e) => setActor(e.target.value)}
                  placeholder="あなたの名前"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">ステータス</Label>
                <Select value={editStatus} onValueChange={(v) => setEditStatus(v ?? editStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="assigned">Assigned</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">優先度</Label>
                <Select value={editPriority} onValueChange={(v) => setEditPriority(v ?? editPriority)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="p1">P1 – Critical</SelectItem>
                    <SelectItem value="p2">P2 – High</SelectItem>
                    <SelectItem value="p3">P3 – Medium</SelectItem>
                    <SelectItem value="p4">P4 – Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">担当者</Label>
                <Input
                  value={editAssignee}
                  onChange={(e) => setEditAssignee(e.target.value)}
                  placeholder="未割り当て"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">コメント</Label>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  placeholder="変更理由・作業メモなど"
                />
              </div>
              <Button
                className="w-full"
                onClick={() => handleUpdate()}
                disabled={saving || !actor}
              >
                {saving ? "保存中..." : "更新する"}
              </Button>
            </CardContent>
          </Card>

          {/* Quick status transitions */}
          {nextStatuses.length > 0 && (
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">クイック遷移</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 flex flex-col gap-2">
                {nextStatuses.map((s) => (
                  <Button
                    key={s}
                    variant="outline"
                    size="sm"
                    disabled={saving || !actor}
                    onClick={() => {
                      setEditStatus(s);
                      handleUpdate({ status: s });
                    }}
                  >
                    → {STATUS_LABELS[s]}
                  </Button>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
