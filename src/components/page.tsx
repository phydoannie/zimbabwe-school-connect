import type { ReactNode } from "react";

export function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border bg-card p-4 shadow-card md:p-5 ${className}`}>{children}</div>;
}

export function Stat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "good" | "bad" | "gold" }) {
  const c = { default: "text-foreground", good: "text-success", bad: "text-destructive", gold: "text-gold-foreground" }[tone];
  return (
    <Card>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-2 font-display text-2xl font-bold ${c}`}>{value}</div>
    </Card>
  );
}

export const selectCls = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">{children}</div>;
}
