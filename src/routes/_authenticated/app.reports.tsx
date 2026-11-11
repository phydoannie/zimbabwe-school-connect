import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Empty } from "@/components/page";
import { useCurrentSchool } from "@/lib/school-context";
import { money } from "@/lib/constants";
import { groupTotals, downloadCsv } from "@/lib/cashbook";
import { loadCashEntries } from "@/lib/finance-data";
import { pageHead } from "@/lib/metadata";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/app/reports")({
  head: () => pageHead("Reports", "Income, expenses, fee collection and debtors summary for your school."),
  component: Reports,
});

function Table({ title, rows, c, total }: { title: string; rows: { name: string; total: number }[]; c: string; total?: boolean }) {
  const sum = rows.reduce((s, r) => s + r.total, 0);
  return <div className="rounded-lg border bg-card p-4"><h3 className="mb-3 font-semibold">{title}</h3>
    {!rows.length ? <p className="text-sm text-muted-foreground">Nothing recorded.</p> : <table className="w-full text-sm"><tbody className="divide-y">{rows.map((r) => <tr key={r.name}><td className="py-2">{r.name}</td><td className="py-2 text-right">{money(r.total, c)}</td></tr>)}
      {total !== false && <tr className="font-semibold"><td className="py-2">Total</td><td className="py-2 text-right">{money(sum, c)}</td></tr>}</tbody></table>}</div>;
}

function Reports() {
  const { school, can } = useCurrentSchool(); const c = school.currency;
  const [from, setFrom] = useState(`${school.current_year}-01-01`); const [to, setTo] = useState("");
  const allowed = can("reports") || can("finance");
  const fin = useQuery({ queryKey: ["reports", school.id, from, to], enabled: allowed, queryFn: () => loadCashEntries(school.id, from, to) });
  const debt = useQuery({ queryKey: ["reports-debt", school.id], enabled: allowed, queryFn: async () => { const r = await supabase.rpc("debtors_by_fee", { _school: school.id }); if (r.error) throw r.error; return r.data ?? []; } });
  if (!allowed) return <Empty>You do not have access to reports.</Empty>;
  if (fin.error) return <Empty>Reports could not be loaded.</Empty>;
  if (fin.isLoading) return <Empty>Loading reports…</Empty>;
  const d = fin.data!;
  const income = d.entries.filter((e) => e.kind === "in"); const spend = d.entries.filter((e) => e.kind === "out");
  const tin = income.reduce((s, e) => s + e.amount, 0); const tout = spend.reduce((s, e) => s + e.amount, 0);
  const byFee = groupTotals(d.allocations, (a) => a.fee, (a) => a.amount);
  const byAccIn = groupTotals(d.allocations, (a) => a.account, (a) => a.amount);
  const byAccOut = groupTotals(spend, (e) => e.account, (e) => e.amount);
  const byCat = groupTotals(d.expenses, (e) => e.category, (e) => Number(e.amount));
  const byMethod = groupTotals(income, (e) => e.method, (e) => e.amount);
  const debtRows = (debt.data ?? []).filter((r) => Number(r.balance) > 0);
  const debtByFee = groupTotals(debtRows, (r) => r.fee_name, (r) => Number(r.balance));
  const accounts = [...new Set([...byAccIn.map((a) => a.name), ...byAccOut.map((a) => a.name)])].map((name) => {
    const i = byAccIn.find((a) => a.name === name)?.total ?? 0; const o = byAccOut.find((a) => a.name === name)?.total ?? 0; return { name, i, o, net: i - o };
  });
  return <>
    <PageHeader title="Reports" sub={`${school.name} · ${from || "start"} to ${to || "today"}`} action={<div className="flex gap-2 print:hidden">
      <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" />Print</Button>
      <Button variant="outline" onClick={() => downloadCsv("account-summary.csv", [["Account", "Income", "Expenses", "Net"], ...accounts.map((a) => [a.name, a.i, a.o, a.net])])}><Download className="h-4 w-4" />CSV</Button></div>} />
    <div className="mb-5 grid max-w-md gap-3 grid-cols-2 print:hidden">
      <div><Label htmlFor="rFrom">From</Label><Input id="rFrom" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
      <div><Label htmlFor="rTo">To</Label><Input id="rTo" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
    </div>
    <div className="mb-5 grid gap-3 sm:grid-cols-4">
      {[["Fees collected", tin], ["Expenses", tout], ["Surplus / deficit", tin - tout], ["Outstanding debts", debtRows.reduce((s, r) => s + Number(r.balance), 0)]].map(([l, v]) => <div key={l as string} className="rounded-lg border bg-card p-4"><div className="text-xs text-muted-foreground">{l}</div><div className="text-lg font-semibold">{money(v as number, c)}</div></div>)}
    </div>
    <div className="mb-5 rounded-lg border bg-card p-4"><h3 className="mb-3 font-semibold">Income & expenditure by account</h3>
      {!accounts.length ? <p className="text-sm text-muted-foreground">Nothing recorded.</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-muted-foreground"><tr><th className="py-2 text-left">Account</th><th className="py-2 text-right">Income</th><th className="py-2 text-right">Expenses</th><th className="py-2 text-right">Net</th></tr></thead>
        <tbody className="divide-y">{accounts.map((a) => <tr key={a.name}><td className="py-2">{a.name}</td><td className="py-2 text-right">{money(a.i, c)}</td><td className="py-2 text-right">{money(a.o, c)}</td><td className={`py-2 text-right font-semibold ${a.net < 0 ? "text-destructive" : ""}`}>{money(a.net, c)}</td></tr>)}</tbody></table></div>}</div>
    <div className="grid gap-4 md:grid-cols-2">
      <Table title="Collections by fee type" rows={byFee} c={c} />
      <Table title="Collections by payment method" rows={byMethod} c={c} />
      <Table title="Expenses by category" rows={byCat} c={c} />
      <Table title="Outstanding debts by fee type" rows={debtByFee} c={c} />
    </div>
  </>;
}
