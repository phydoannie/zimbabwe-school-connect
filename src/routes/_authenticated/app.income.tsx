import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Empty, selectCls } from "@/components/page";
import { useCurrentSchool } from "@/lib/school-context";
import { INCOME_SOURCES, PAYMENT_METHODS, money } from "@/lib/constants";
import { validExpenseAmount } from "@/lib/accounts";
import { useOfflineSchool } from "@/lib/use-offline-school";
import { pageHead } from "@/lib/metadata";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/app/income")({
  head: () => pageHead("Other income", "Record school income besides fees, such as rent and tuck shop sales."),
  component: Income,
});

function Income() {
  const offline = useOfflineSchool();
  const { school, can, userId } = useCurrentSchool(); const qc = useQueryClient();
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false);
  const [source, setSource] = useState(""); const [from, setFrom] = useState(`${school.current_year}-01-01`); const [to, setTo] = useState("");
  const q = useQuery({ queryKey: ["other-income", school.id, from, to, source], enabled: offline.online && (can("finance") || can("reports")), queryFn: async () => {
    let query = supabase.from("other_income").select("*").eq("school_id", school.id).order("received_on", { ascending: false });
    if (from) query = query.gte("received_on", from); if (to) query = query.lte("received_on", to); if (source) query = query.eq("source", source);
    const r = await query; if (r.error) throw r.error; return r.data ?? [];
  } });
  const rows = q.data ?? [];
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (busy || !can("finance")) return; const f = new FormData(e.currentTarget); const amount = Number(f.get("amount"));
    if (!validExpenseAmount(amount)) { toast.error("Enter an amount greater than zero"); return; }
    setBusy(true); try {
      const r = await supabase.from("other_income").insert({ school_id: school.id, recorded_by: userId, amount, received_on: String(f.get("received_on")), source: String(f.get("source")), description: String(f.get("description") ?? "").trim(), method: String(f.get("method")), reference: String(f.get("reference") ?? "").trim() || null });
      if (r.error) throw r.error; await qc.invalidateQueries(); setOpen(false); toast.success("Income recorded");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Income could not be recorded"); } finally { setBusy(false); }
  }
  if (!can("reports") && !can("finance")) return <Empty>You do not have access to income.</Empty>;
  return <>
    <PageHeader title="Other income" sub={`${rows.length} entries · ${money(rows.reduce((s, r) => s + Number(r.amount), 0), school.currency)}`} action={can("finance") && <Button disabled={!offline.online} onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Add income</Button>} />
    {!offline.online && <p className="mb-4 text-sm text-muted-foreground">Connect to the internet to record or view other income.</p>}
    <div className="mb-5 grid gap-3 sm:grid-cols-3">
      <div><Label htmlFor="incSrc">Source</Label><select id="incSrc" className={selectCls} value={source} onChange={(e) => setSource(e.target.value)}><option value="">All sources</option>{INCOME_SOURCES.map((s) => <option key={s}>{s}</option>)}</select></div>
      <div><Label htmlFor="incFrom">From</Label><Input id="incFrom" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
      <div><Label htmlFor="incTo">To</Label><Input id="incTo" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
    </div>
    {q.error ? <Empty>Income could not be loaded.</Empty> : q.isLoading ? <Empty>Loading income…</Empty> : !rows.length ? <Empty>No income recorded for these filters.</Empty> :
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b text-muted-foreground"><tr>{["Date", "Source", "Description", "Ref / Method", "Amount"].map((h) => <th key={h} className="px-3 py-3">{h}</th>)}</tr></thead>
        <tbody className="divide-y">{rows.map((r) => <tr key={r.id}><td className="whitespace-nowrap px-3 py-3">{r.received_on}</td><td className="px-3 py-3">{r.source}</td><td className="min-w-40 px-3 py-3">{r.description || "—"}</td><td className="px-3 py-3">{r.reference || "—"}<div className="text-muted-foreground">{r.method}</div></td><td className="whitespace-nowrap px-3 py-3 font-semibold text-primary">{money(r.amount, school.currency)}</td></tr>)}</tbody></table></div>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Add income</DialogTitle></DialogHeader><form onSubmit={save} className="space-y-3">
      <div><Label htmlFor="incDate">Date</Label><Input id="incDate" name="received_on" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></div>
      <div><Label htmlFor="incSource">Source</Label><Input id="incSource" name="source" list="incomeSources" required placeholder="e.g. Rent, Tuck shop" /><datalist id="incomeSources">{INCOME_SOURCES.map((s) => <option key={s} value={s} />)}</datalist></div>
      <div><Label htmlFor="incDesc">Description</Label><Input id="incDesc" name="description" placeholder="e.g. Canteen rent for November" /></div>
      <div><Label htmlFor="incAmt">Amount ({school.currency})</Label><Input id="incAmt" name="amount" type="number" min="0.01" step="0.01" required /></div>
      <div><Label htmlFor="incMethod">Payment method</Label><select id="incMethod" name="method" className={selectCls}>{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</select></div>
      <div><Label htmlFor="incRef">Reference</Label><Input id="incRef" name="reference" /></div>
      <Button disabled={busy} type="submit">Record income</Button>
    </form></DialogContent></Dialog>
  </>;
}
