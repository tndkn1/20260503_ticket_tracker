"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";
import type { SessionPayload } from "@/lib/auth";

export function UserMenu() {
  const router = useRouter();
  const [user, setUser] = useState<SessionPayload | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setUser(data?.user ?? null))
      .catch(() => {});
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  if (!user) return null;

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <User className="w-3.5 h-3.5" />
        <span>{user.username}</span>
        <span className="text-xs bg-muted px-1.5 py-0.5 rounded capitalize">
          {user.role}
        </span>
      </div>
      <Button variant="ghost" size="sm" onClick={handleLogout} className="text-xs h-7 px-2">
        <LogOut className="w-3.5 h-3.5 mr-1" />
        ログアウト
      </Button>
    </div>
  );
}
