"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  sub?: string;
  accent?: "red" | "orange" | "green" | "blue" | "default";
}

const ACCENT: Record<string, string> = {
  red:     "border-l-4 border-l-red-500",
  orange:  "border-l-4 border-l-orange-400",
  green:   "border-l-4 border-l-green-500",
  blue:    "border-l-4 border-l-blue-500",
  default: "",
};

export function StatCard({ title, value, sub, accent = "default" }: StatCardProps) {
  return (
    <Card className={cn("min-w-0", ACCENT[accent])}>
      <CardHeader className="pb-1 pt-4 px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <p className="text-3xl font-bold tabular-nums">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}
