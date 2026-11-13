import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentSchool } from "@/lib/school-context";
import { money } from "@/lib/constants";
import { PageHeader, Stat, Card } from "@/components/page";
import { Button } from "@/components/ui/button";
import { pageHead } from '@/lib/metadata';

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => pageHead('Dashboard', 'School fee collection, student totals, expenses and outstanding balances.'),
  component: Dashboard,
});

function Dashboard() {
  const { school, can } = useCurrentSchool();
  const fin = can("reports");
  const { data } = useQuery({
    queryKey: ["dashboard", school.id],
    queryFn: async () => {
      const [st, rc, ex, db] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }).eq("school_id", school.id).eq("status", "active"),
        fin ? supabase.from("payment_receipts").select("id,receipt_number,total,paid_on,method,students(first_name,last_name)")
          .eq("school_id", school.id).eq("year", school.current_year).eq("term", school.current_term).eq("voided", false).order("created_at", { ascending: false }) : null,
        fin ? supabase.from("expenses").select("amount").eq("school_id", school.id).gte("spent_on", `${school.current_year}-01-01`) : null,
        fin ? supabase.rpc("debtors", { _school: school.id }) : null,
      ]);
      const receipts = rc?.data ?? [];
      return {
        students: st.count ?? 0,
        collected: receipts.reduce((s, r) => s + Number(r.total), 0),
        recent: receipts.slice(0, 6),
        expenses: (ex?.data ?? []).reduce((s, e) => s + Number(e.amount), 0),
        outstanding: (db?.data ?? []).reduce((s, d) => s + Math.max(0, Number(d.balance)), 0),
        debtors: (db?.data ?? []).filter((d) => Number(d.balance) > 0).length,
      };
    },
  });

  return (
    <>
      <PageHeader
        title="Dashboard"
        sub={`Term ${school.current_term}, ${school.current_year} · Code ${school.code}`}
        action={can("finance") && <Button asChild variant="gold"><Link to="/app/collect">Collect fees</Link></Button>}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active students" value={String(data?.students ?? "—")} />
        {fin && <>
          <Stat label="Collected this term" value={money(data?.collected, school.currency)} tone="good" />
          <Stat label="Outstanding" value={money(data?.outstanding, school.currency)} tone="bad" />
          <Stat label="Expenses this year" value={money(data?.expenses, school.currency)} />
        </>}
      </div>
      {fin && (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Recent receipts</h2>
              <Link to="/app/receipts" className="text-sm text-primary">View all</Link>
            </div>
            <div className="divide-y">
              {(data?.recent ?? []).map((r) => (
                <div key={r.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <div className="font-medium">{r.students?.first_name} {r.students?.last_name}</div>
                    <div className="text-xs text-muted-foreground">{r.receipt_number} · {r.method} · {r.paid_on}</div>
                  </div>
                  <div className="font-semibold">{money(r.total, school.currency)}</div>
                </div>
              ))}
              {data && data.recent.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No payments this term yet.</p>}
            </div>
          </Card>
          <Card>
            <h2 className="font-semibold">Debtors</h2>
            <div className="mt-3 font-display text-4xl font-bold text-destructive">{data?.debtors ?? "—"}</div>
            <p className="text-sm text-muted-foreground">students with a balance</p>
            <Button asChild variant="outline" className="mt-4 w-full"><Link to="/app/debtors">Open debtors list</Link></Button>
          </Card>
        </div>
      )}
    </>
  );
}
