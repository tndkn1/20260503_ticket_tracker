"use client";
import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  defaultAssignee?: string;
}

const EMPTY = "_none";

export function CreateIncidentDialog({ open, onOpenChange, onCreated, defaultAssignee }: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "p3",
    assignee: defaultAssignee ?? "",
    category: EMPTY,
    subcategory: "",
    impact: EMPTY,
    urgency: EMPTY,
    assignmentGroup: "",
    configurationItem: "",
    contactType: EMPTY,
  });

  const defaultAssigneeRef = useRef(defaultAssignee);
  useEffect(() => { defaultAssigneeRef.current = defaultAssignee; }, [defaultAssignee]);

  useEffect(() => {
    if (open) {
      setForm({
        title: "", description: "", priority: "p3",
        assignee: defaultAssigneeRef.current ?? "",
        category: EMPTY, subcategory: "", impact: EMPTY,
        urgency: EMPTY, assignmentGroup: "", configurationItem: "",
        contactType: EMPTY,
      });
    }
  }, [open]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.title || !form.description) {
      toast.error("タイトルと説明は必須です");
      return;
    }
    setLoading(true);
    try {
      const body: Record<string, string | undefined> = {
        title: form.title,
        description: form.description,
        priority: form.priority,
        assignee: form.assignee || undefined,
        category: form.category !== EMPTY ? form.category : undefined,
        subcategory: form.subcategory || undefined,
        impact: form.impact !== EMPTY ? form.impact : undefined,
        urgency: form.urgency !== EMPTY ? form.urgency : undefined,
        assignmentGroup: form.assignmentGroup || undefined,
        configurationItem: form.configurationItem || undefined,
        contactType: form.contactType !== EMPTY ? form.contactType : undefined,
      };
      const res = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("インシデントを起票しました");
      onOpenChange(false);
      onCreated();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>インシデント起票</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto flex-1 space-y-4 pr-1">
            <div className="space-y-1">
              <Label htmlFor="title">タイトル *</Label>
              <Input
                id="title"
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="簡潔にインシデントを説明してください"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="description">説明 *</Label>
              <Textarea
                id="description"
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={3}
                placeholder="発生状況、影響範囲、暫定対処などを記載"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>優先度</Label>
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v ?? "p3" }))}>
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
                <Label htmlFor="assignee">担当者</Label>
                <Input id="assignee" name="assignee" value={form.assignee} onChange={handleChange} placeholder="未割り当て" />
              </div>
            </div>

            <Separator />
            <p className="text-xs text-muted-foreground font-medium">追加情報（任意）</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>カテゴリ</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v ?? EMPTY }))}>
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
                <Label>影響度</Label>
                <Select value={form.impact} onValueChange={(v) => setForm((f) => ({ ...f, impact: v ?? EMPTY }))}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={EMPTY}>—（なし）</SelectItem>
                    <SelectItem value="high">High – 広範な影響</SelectItem>
                    <SelectItem value="medium">Medium – 一部影響</SelectItem>
                    <SelectItem value="low">Low – 軽微な影響</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="subcategory">サブカテゴリ</Label>
                <Input id="subcategory" name="subcategory" value={form.subcategory} onChange={handleChange} placeholder="例: Application" />
              </div>
              <div className="space-y-1">
                <Label>緊急度</Label>
                <Select value={form.urgency} onValueChange={(v) => setForm((f) => ({ ...f, urgency: v ?? EMPTY }))}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={EMPTY}>—（なし）</SelectItem>
                    <SelectItem value="high">High – 即時対応</SelectItem>
                    <SelectItem value="medium">Medium – 通常対応</SelectItem>
                    <SelectItem value="low">Low – 低優先</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="assignmentGroup">担当グループ</Label>
                <Input id="assignmentGroup" name="assignmentGroup" value={form.assignmentGroup} onChange={handleChange} placeholder="例: インフラチーム" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="configurationItem">構成アイテム (CI)</Label>
                <Input id="configurationItem" name="configurationItem" value={form.configurationItem} onChange={handleChange} placeholder="例: 顧客管理システム" />
              </div>
            </div>

            <div className="space-y-1">
              <Label>連絡手段</Label>
              <Select value={form.contactType} onValueChange={(v) => setForm((f) => ({ ...f, contactType: v ?? EMPTY }))}>
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
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              キャンセル
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "作成中..." : "起票する"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
