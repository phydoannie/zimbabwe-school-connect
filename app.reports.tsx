import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentSchool } from "@/lib/school-context";
import { money } from "@/lib/constants";
import { PageHeader, Card, Stat } from "@/components/page";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/reports")({
  head: () => ({ meta: [{ title: "Reports — SchoolSys Pro" }] }),
  component: Reports,
});
function Reports() {
  const { school } = useCurrentSchool();
  const { data, isLoading, error } = useQuery({ queryKey: ["reports", school.id, school.current_year, school.current_term], queryFn: async () => {
    const [students, receipts, expenses, debtors] = await Promise.all([
      supabase.from("students").select("id", { count: "exact", head: true }).eq("school_id", school.id).eq("status", "active"),
      supabase.from("payment_receipts").select("receipt_number,paid_on,total,method,voided").eq("school_id", school.id).eq("year", school.current_year).eq("term", school.current_term).order("paid_on", { ascending: false }),
      supabase.from("expenses").select("spent_on,category,account,description,amount").eq("school_id", school.id).gte("spent_on", `${school.current_year}-01-01`).order("spent_on", { ascending: false }),
      supabase.rpc("debtors", { _school: school.id }),
    ]);
    for (const r of [students, receipts, expenses, debtors]) if (r.error) throw r.error;
    const validReceipts = receipts.data ?? []; const validExpenses = expenses.data ?? []; const rows = debtors.data ?? [];
    return { students: students.count ?? 0, receipts: validReceipts.filter((r) => !r.voided), allReceipts: validReceipts, expenses: validExpenses, debtors: rows };
  }});
  const d = data;
  const collected = (d?.receipts ?? []).reduce((sum, r) => sum + Number(r.total), 0);
  const spent = (d?.expenses ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
  const outstanding = (d?.debtors ?? []).reduce((sum, r) => sum + Math.max(0, Number(r.balance)), 0);
  function exportCsv() {
    if (!d) return;
    const lines = [["Report","Date","Reference / Description","Category / Method","Amount"],
      ...d.allReceipts.map((r) => [r.voided ? "VOIDED RECEIPT" : "Receipt", r.paid_on, r.receipt_number, r.method, String(r.voided ? 0 : r.total)]),
      ...d.expenses.map((e) => ["Expense", e.spent_on, e.description, `${e.category} / ${e.account}`, String(e.amount)]),
      ...d.debtors.filter((x) => Number(x.balance) > 0).map((x) => ["Debtor", "", `${x.reg_number} ${x.full_name}`, x.grade, String(x.balance)])];
    const csv = lines.map((line) => line.map((x) => `"${String(x ?? "").replaceAll('"','""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `schoolsys-report-${school.current_year}-term-${school.current_term}.csv`; a.click(); URL.revokeObjectURL(a.href);
  }
  return <><PageHeader title="Reports" sub={`${school.name} · Term ${school.current_term}, ${school.current_year}`} action={<Button variant="outline" onClick={exportCsv} disabled={!d}>Export CSV</Button>} />
    {isLoading && <p className="text-sm text-muted-foreground">Loading report…</p>}{error && <p className="text-sm text-destructive">Could not load reports: {(error as Error).message}</p>}
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Stat label="Active students" value={String(d?.students ?? "—")} /><Stat label="Collected this term" value={money(collected, school.currency)} tone="good" /><Stat label="Outstanding balances" value={money(outstanding, school.currency)} tone="bad" /><Stat label="Expenses this year" value={money(spent, school.currency)} /></div>
    <div className="mt-4 grid gap-4 lg:grid-cols-2"><Card><h2 className="mb-3 font-semibold">Recent receipts</h2>{(d?.receipts ?? []).slice(0, 10).map((r) => <div key={r.receipt_number} className="flex justify-between gap-3 border-b py-2 text-sm"><span>{r.paid_on} · {r.receipt_number} · {r.method}</span><strong>{money(r.total, school.currency)}</strong></div>)}{d && d.receipts.length === 0 && <p className="text-sm text-muted-foreground">No receipts this term.</p>}</Card>
      <Card><h2 className="mb-3 font-semibold">Outstanding by student</h2>{(d?.debtors ?? []).filter((x) => Number(x.balance) > 0).sort((a,b) => Number(b.balance)-Number(a.balance)).slice(0, 10).map((x) => <div key={x.student_id} className="flex justify-between gap-3 border-b py-2 text-sm"><span>{x.full_name} <span className="text-muted-foreground">· {x.grade}</span></span><strong>{money(x.balance, school.currency)}</strong></div>)}{d && d.debtors.filter((x) => Number(x.balance) > 0).length === 0 && <p className="text-sm text-muted-foreground">No outstanding balances.</p>}</Card></div>
  </>;
}
