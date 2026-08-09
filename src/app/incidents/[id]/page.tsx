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

const EMPTY = "_none";

const STATUS_TRANSITIONS: Record<string, string[]> = {
  new:         ["assigned", "in_progress", "on_hold", "closed"],
  assigned:    ["in_progress", "on_hold", "resolved", "closed"],
  in_progress: ["on_hold", "resolved", "closed"],
  on_hold:     ["assigned", "in_progress", "resolved", "closed"],
  resolved:    ["closed", "in_progress"],
  closed:      [],
};

const FIELD_LABELS: Record<string, string> = {
  status:            "ステータス",
  priority:          "優先度",
  assignee:          "担当者",
  title:             "タイトル",
  description:       "説明",
  comment:           "コメント",
  category:          "カテゴリ",
  subcategory:       "サブカテゴリ",
  impact:            "影響度",
  urgency:           "緊急度",
  assignmentGroup:   "担当グループ",
  configurationItem: "構成アイテム (CI)",
  contactType:       "連絡手段",
  resolutionNotes:   "解決メモ",
  closeCode:         "クローズコード",
  onHoldReason:      "保留理由",
};

const STATUS_LABELS: Record<string, string> = {
  new:         "New",
  assigned:    "Assigned",
  in_progress: "In Progress",
  on_hold:     "On Hold",
  resolved:    "Resolved",
  closed:      "Closed",
};

const CATEGORY_LABELS: Record<string, string> = {
  software: "ソフトウェア",
  hardware: "ハードウェア",
  network:  "ネットワーク",
  security: "セキュリティ",
  other:    "その他",
};

const IMPACT_LABELS: Record<string, string> = {
  high:   "High",
  medium: "Medium",
  low:    "Low",
};

const CONTACT_TYPE_LABELS: Record<string, string> = {
  phone:        "電話",
  email:        "メール",
  self_service: "セルフサービス",
  chat:         "チャット",
  other:        "その他",
};

const CLOSE_CODE_LABELS: Record<string, string> = {
  solved:         "解決済み",
  duplicate:      "重複",
  no_fault_found: "問題なし",
  cancelled:      "キャンセル",
  other:          "その他",
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
  const [now, setNow] = useState(() => Date.now());
  const [loggedInUser, setLoggedInUser] = useState("");
  const [comment, setComment] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [editAssignee, setEditAssignee] = useState("");
  // ServiceNow fields
  const [editCategory, setEditCategory] = useState(EMPTY);
  const [editSubcategory, setEditSubcategory] = useState("");
  const [editImpact, setEditImpact] = useState(EMPTY);
  const [editUrgency, setEditUrgency] = useState(EMPTY);
  const [editAssignmentGroup, setEditAssignmentGroup] = useState("");
  const [editConfigurationItem, setEditConfigurationItem] = useState("");
  const [editContactType, setEditContactType] = useState(EMPTY);
  const [editOnHoldReason, setEditOnHoldReason] = useState("");
  const [editResolutionNotes, setEditResolutionNotes] = useState("");
  const [editCloseCode, setEditCloseCode] = useState(EMPTY);

  const [saving, setSaving] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.user?.username) setLoggedInUser(data.user.username); })
      .catch(() => {});
  }, []);

  async function fetchIncident() {
    const res = await fetch(`/api/incidents/${id}`);
    if (!res.ok) { router.push("/"); return; }
    const data = await res.json();
    const inc: Incident = data.incident;
    setIncident(inc);
    setLog(data.log);
    setNow(Date.now());
    setEditStatus(inc.status);
    setEditPriority(inc.priority);
    setEditAssignee(inc.assignee ?? "");
    setEditCategory(inc.category ?? EMPTY);
    setEditSubcategory(inc.subcategory ?? "");
    setEditImpact(inc.impact ?? EMPTY);
    setEditUrgency(inc.urgency ?? EMPTY);
    setEditAssignmentGroup(inc.assignmentGroup ?? "");
    setEditConfigurationItem(inc.configurationItem ?? "");
    setEditContactType(inc.contactType ?? EMPTY);
    setEditOnHoldReason(inc.onHoldReason ?? "");
    setEditResolutionNotes(inc.resolutionNotes ?? "");
    setEditCloseCode(inc.closeCode ?? EMPTY);
  }

  useEffect(() => {
    const timeout = setTimeout(() => { void fetchIncident(); }, 0);
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => { clearTimeout(timeout); clearInterval(t); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleUpdate(extra?: Record<string, string | null>) {
    if (!incident) return;
    setSaving(true);
    try {
      const body: Record<string, string | null> = {
        comment: comment || null,
        status: editStatus,
        priority: editPriority,
        assignee: editAssignee || null,
        category: editCategory !== EMPTY ? editCategory : null,
        subcategory: editSubcategory || null,
        impact: editImpact !== EMPTY ? editImpact : null,
        urgency: editUrgency !== EMPTY ? editUrgency : null,
        assignmentGroup: editAssignmentGroup || null,
        configurationItem: editConfigurationItem || null,
        contactType: editContactType !== EMPTY ? editContactType : null,
        onHoldReason: editOnHoldReason || null,
        resolutionNotes: editResolutionNotes || null,
        closeCode: editCloseCode !== EMPTY ? editCloseCode : null,
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
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "更新に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function handleTitleSave() {
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

  function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
    return (
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm">{value || "—"}</p>
      </div>
    );
  }

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
                <Button size="icon" variant="ghost" onClick={() => setEditingTitle(false)}>
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
                  onClick={() => { setTitleDraft(incident.title); setEditingTitle(true); }}
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

          {/* ServiceNow 詳細情報 */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">詳細情報</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 grid grid-cols-2 gap-x-6 gap-y-3">
              <DetailRow label="カテゴリ" value={CATEGORY_LABELS[incident.category ?? ""] ?? incident.category} />
              <DetailRow label="サブカテゴリ" value={incident.subcategory} />
              <DetailRow label="影響度" value={IMPACT_LABELS[incident.impact ?? ""] ?? incident.impact} />
              <DetailRow label="緊急度" value={IMPACT_LABELS[incident.urgency ?? ""] ?? incident.urgency} />
              <DetailRow label="担当グループ" value={incident.assignmentGroup} />
              <DetailRow label="構成アイテム (CI)" value={incident.configurationItem} />
              <DetailRow label="連絡手段" value={CONTACT_TYPE_LABELS[incident.contactType ?? ""] ?? incident.contactType} />
              <DetailRow label="保留理由" value={incident.onHoldReason} />
              <DetailRow label="クローズコード" value={CLOSE_CODE_LABELS[incident.closeCode ?? ""] ?? incident.closeCode} />
              {incident.resolutionNotes && (
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">解決メモ</p>
                  <p className="text-sm whitespace-pre-wrap">{incident.resolutionNotes}</p>
                </div>
              )}
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
                <Label className="text-xs">更新者</Label>
                <p className="text-sm font-medium">{loggedInUser || "..."}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">ステータス</Label>
                <Select value={editStatus} onValueChange={(v) => setEditStatus(v ?? editStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="assigned">Assigned</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">優先度</Label>
                <Select value={editPriority} onValueChange={(v) => setEditPriority(v ?? editPriority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                <Input value={editAssignee} onChange={(e) => setEditAssignee(e.target.value)} placeholder="未割り当て" />
              </div>

              <Separator />
              <p className="text-xs text-muted-foreground font-medium">追加情報（任意）</p>

              <div className="space-y-1">
                <Label className="text-xs">カテゴリ</Label>
                <Select value={editCategory} onValueChange={(v) => setEditCategory(v ?? EMPTY)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={EMPTY}>—（なし）</SelectItem>
                    <SelectItem value="software">ソフトウェア</SelectItem>
                    <SelectItem value="hardware">ハードウェア</SelectItem>
                    <SelectItem value="network">ネットワーク</SelectItem>
                    <SelectItem value="security">セキュリティ</SelectItem>
                    <SelectItem value="other">その他</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">サブカテゴリ</Label>
                <Input value={editSubcategory} onChange={(e) => setEditSubcategory(e.target.value)} placeholder="例: Application" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">影響度</Label>
                  <Select value={editImpact} onValueChange={(v) => setEditImpact(v ?? EMPTY)}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={EMPTY}>—</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">緊急度</Label>
                  <Select value={editUrgency} onValueChange={(v) => setEditUrgency(v ?? EMPTY)}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={EMPTY}>—</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">担当グループ</Label>
                <Input value={editAssignmentGroup} onChange={(e) => setEditAssignmentGroup(e.target.value)} placeholder="例: インフラチーム" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">構成アイテム (CI)</Label>
                <Input value={editConfigurationItem} onChange={(e) => setEditConfigurationItem(e.target.value)} placeholder="例: 顧客管理システム" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">連絡手段</Label>
                <Select value={editContactType} onValueChange={(v) => setEditContactType(v ?? EMPTY)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={EMPTY}>—（なし）</SelectItem>
                    <SelectItem value="phone">電話</SelectItem>
                    <SelectItem value="email">メール</SelectItem>
                    <SelectItem value="self_service">セルフサービス</SelectItem>
                    <SelectItem value="chat">チャット</SelectItem>
                    <SelectItem value="other">その他</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">保留理由</Label>
                <Input value={editOnHoldReason} onChange={(e) => setEditOnHoldReason(e.target.value)} placeholder="保留の理由を入力" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">解決メモ</Label>
                <Textarea value={editResolutionNotes} onChange={(e) => setEditResolutionNotes(e.target.value)} rows={2} placeholder="解決時の対応内容" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">クローズコード</Label>
                <Select value={editCloseCode} onValueChange={(v) => setEditCloseCode(v ?? EMPTY)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={EMPTY}>—（なし）</SelectItem>
                    <SelectItem value="solved">解決済み</SelectItem>
                    <SelectItem value="duplicate">重複</SelectItem>
                    <SelectItem value="no_fault_found">問題なし</SelectItem>
                    <SelectItem value="cancelled">キャンセル</SelectItem>
                    <SelectItem value="other">その他</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />
              <div className="space-y-1">
                <Label className="text-xs">コメント</Label>
                <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="変更理由・作業メモなど" />
              </div>
              <Button className="w-full" onClick={() => handleUpdate()} disabled={saving}>
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
                    disabled={saving}
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

          <Button variant="outline" className="w-full" onClick={() => router.push("/")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            トップページへ戻る
          </Button>
        </div>
      </main>
    </div>
  );
}
