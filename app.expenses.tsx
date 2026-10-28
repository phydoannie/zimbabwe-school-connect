import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentSchool } from "@/lib/school-context";
import { ACCOUNTS, EXPENSE_CATEGORIES, PAYMENT_METHODS, money } from "@/lib/constants";
import { PageHeader, Card, Empty, selectCls, Stat } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/app/expenses")({
  head: () => ({ meta: [{ title: "Expenses — SchoolSys Pro" }] }),
  component: Expenses,
});

function Expenses() {
  const { school, userId, can } = useCurrentSchool();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const { data } = useQuery({
    queryKey: ["expenses", school.id, month],
    queryFn: async () => {
      const start = `${month}-01`;
      const endDate = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
      const end = `${month}-${String(endDate).padStart(2, "0")}`;
      const { data, error } = await supabase.from("expenses").select("*").eq("school_id", school.id)
        .gte("spent_on", start).lte("spent_on", end).order("spent_on", { ascending: false }).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!can("finance")) { toast.error("You do not have permission to record expenses."); return; }
    const f = new FormData(e.currentTarget);
    const amount = Number(f.get("amount"));
    if (!Number.isFinite(amount) || amount <= 0) { toast.error("Enter an amount greater than zero."); return; }
    setBusy(true);
    const { error } = await supabase.from("expenses").insert({
      school_id: school.id, spent_on: String(f.get("spent_on")), category: String(f.get("category")),
      account: String(f.get("account")), description: String(f.get("description")).trim(), amount,
      method: String(f.get("method")), recorded_by: userId,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Expense recorded");
    (e.currentTarget as HTMLFormElement).reset();
    qc.invalidateQueries({ queryKey: ["expenses", school.id] });
    qc.invalidateQueries({ queryKey: ["dashboard", school.id] });
  }
  const rows = data ?? [];
  const total = rows.reduce((sum, row) => sum + Number(row.amount), 0);
  return <>
    <PageHeader title="Expenses" sub="Record and review school expenditure." />
    <div className="mb-4 grid grid-cols-2 gap-3"><Stat label="Entries this month" value={String(rows.length)} /><Stat label="Monthly total" value={money(total, school.currency)} /></div>
    <div className="grid gap-4 lg:grid-cols-3">
      {can("finance") && <Card className="h-fit"><h2 className="mb-3 font-semibold">Record expense</h2><form onSubmit={add} className="space-y-3">
        <div><Label>Date</Label><Input name="spent_on" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></div>
        <div><Label>Expense category</Label><select name="category" className={selectCls}>{EXPENSE_CATEGORIES.map((x) => <option key={x}>{x}</option>)}</select></div>
        <div><Label>Account paid from</Label><select name="account" className={selectCls}>{ACCOUNTS.map((x) => <option key={x}>{x}</option>)}</select></div>
        <div><Label>Description / payee</Label><Input name="description" required maxLength={200} placeholder="e.g. Stationery from supplier" /></div>
        <div><Label>Amount ({school.currency})</Label><Input name="amount" type="number" min="0.01" step="0.01" required /></div>
        <div><Label>Payment method</Label><select name="method" className={selectCls}>{PAYMENT_METHODS.map((x) => <option key={x}>{x}</option>)}</select></div>
        <Button className="w-full" disabled={busy}>{busy ? "Saving…" : "Save expense"}</Button>
      </form></Card>}
      <Card className="lg:col-span-2"><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><Label>Month</Label><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></div><Button variant="outline" onClick={() => { const lines = [["Date","Category","Account","Description","Method","Amount"], ...rows.map((r) => [r.spent_on,r.category,r.account,r.description,r.method,String(r.amount)])]; const csv = lines.map((line) => line.map((x) => `"${String(x ?? "").replaceAll('"','""')}"`).join(",")).join("\n"); const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `schoolsys-expenses-${month}.csv`; a.click(); URL.revokeObjectURL(a.href); }}>Export CSV</Button></div>
        {rows.length === 0 ? <Empty>No expenses recorded for this month.</Empty> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="p-2">Date</th><th>Expense</th><th>Account</th><th className="text-right">Amount</th></tr></thead><tbody className="divide-y">{rows.map((r) => <tr key={r.id}><td className="p-2 whitespace-nowrap">{r.spent_on}</td><td><div className="font-medium">{r.description}</div><div className="text-xs text-muted-foreground">{r.category} · {r.method}</div></td><td>{r.account}</td><td className="text-right font-semibold">{money(r.amount, school.currency)}</td></tr>)}</tbody><tfoot><tr><td colSpan={3} className="p-2 text-right font-semibold">Total</td><td className="text-right font-bold">{money(total, school.currency)}</td></tr></tfoot></table></div>}
      </Card>
    </div>
  </>;
}
