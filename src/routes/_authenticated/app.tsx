import { createFileRoute, Link, Navigate, Outlet, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard, Users, Wallet, Receipt, AlertTriangle, Tags, TrendingDown, CalendarCheck, BarChart3, BookOpen, Settings, LogOut, Menu,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/lib/school-context";
import { ROLE_LABELS, type Perm } from "@/lib/constants";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Button } from '@/components/ui/button';

export const Route = createFileRoute("/_authenticated/app")({
  component: AppLayout,
});

const NAV: { to: string; label: string; icon: typeof Users; perm: Perm }[] = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, perm: "view" },
  { to: "/app/students", label: "Students", icon: Users, perm: "view" },
  { to: "/app/collect", label: "Collect fees", icon: Wallet, perm: "finance" },
  { to: "/app/receipts", label: "Receipts", icon: Receipt, perm: "reports" },
  { to: "/app/debtors", label: "Debtors", icon: AlertTriangle, perm: "reports" },
  { to: "/app/fees", label: "Fee structure", icon: Tags, perm: "view" },
  { to: "/app/expenses", label: "Expenses", icon: TrendingDown, perm: "reports" },
  { to: "/app/cashbook", label: "Cash book", icon: BookOpen, perm: "reports" },
  { to: "/app/attendance", label: "Staff attendance", icon: CalendarCheck, perm: "view" },
  { to: "/app/reports", label: "Reports", icon: BarChart3, perm: "reports" },
  { to: "/app/settings", label: "Settings", icon: Settings, perm: "view" },
];

function AppLayout() {
  const ctx = useSchool();
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const nav = useNavigate();

  if (ctx.loading) return <div className="p-10 text-muted-foreground">Loading…</div>;
  if (!ctx.school) return <Navigate to="/onboarding" />;

  const active = ctx.memberships.filter((m) => m.status === "active" && m.schools);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    nav({ to: "/auth", replace: true });
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="zim-stripe h-1" />
      <div className="px-5 py-5">
        <div className="font-display text-lg font-bold text-sidebar-accent-foreground">SchoolSys<span className="text-sidebar-primary"> Pro</span></div>
        {active.length > 1 ? (
          <select
            value={ctx.school.id}
            onChange={(e) => { ctx.switchSchool(e.target.value); setOpen(false); }}
            className="mt-3 w-full rounded-md border border-sidebar-border bg-sidebar-accent px-2 py-2 text-sm"
          >
            {active.map((m) => <option key={m.school_id} value={m.school_id}>{m.schools?.name}</option>)}
          </select>
        ) : (
          <div className="mt-3 truncate text-sm font-medium text-sidebar-accent-foreground">{ctx.school.name}</div>
        )}
        <div className="mt-1 break-words text-xs opacity-70">{ctx.role ? ROLE_LABELS[ctx.role] : ''} · {ctx.school.code}</div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {NAV.filter((n) => ctx.can(n.perm)).map((n) => (
          <Link
            key={n.to}
            to={n.to}
            activeOptions={{ exact: n.to === "/app" }}
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-sidebar-accent"
            activeProps={{ className: "bg-sidebar-accent text-sidebar-primary font-semibold" }}
          >
            <n.icon className="h-4 w-4" /> {n.label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <div className="truncate px-3 text-xs opacity-70">{ctx.email}</div>
        <Button variant="ghost" onClick={signOut} className="mt-1 w-full justify-start gap-3">
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 lg:block">{sidebar}</aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 border-0 p-0">{sidebar}</SheetContent>
      </Sheet>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-card/90 px-4 py-3 backdrop-blur lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></Button>
          <div className="truncate font-display font-semibold">{ctx.school.name}</div>
        </header>
        <main className={cn("mx-auto max-w-6xl p-4 md:p-8")}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
