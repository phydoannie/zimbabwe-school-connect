import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentSchool } from "@/lib/school-context";
import { ACCOUNTS, DEFAULT_FEE_NAMES, GRADES, money } from "@/lib/constants";
import { PageHeader, Card, Empty, selectCls } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { pageHead } from '@/lib/metadata';

export const Route = createFileRoute("/_authenticated/app/fees")({
  head: () => pageHead('Fee structure', 'School fees, account allocations and class-specific term charges.'),
  component: Fees,
});

function Fees() {
  const { school, can } = useCurrentSchool();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [account, setAccount] = useState(ACCOUNTS[0] ?? "Tuition");
  const [amount, setAmount] = useState("");
  const [grades, setGrades] = useState<string[]>([]);
  const [boarding, setBoarding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [invFee, setInvFee] = useState<{ id: string; name: string; amount: number; applies_to: string[] } | null>(null);
  const [invGrades, setInvGrades] = useState<string[]>([]);
  const [invBusy, setInvBusy] = useState(false);

  const { data } = useQuery({
    queryKey: ["fee_types", school.id, school.current_year, school.current_term],
    queryFn: async () => (await supabase.from("fee_types").select("*").eq("school_id", school.id)
      .eq("year", school.current_year).eq("term", school.current_term).order("name")).data ?? [],
  });

  async function add() {
    if (!name.trim() || !(Number(amount) > 0)) { toast.error("Enter a fee name and amount"); return; }
    setBusy(true);
    const { error } = await supabase.from("fee_types").insert({
      school_id: school.id, name: name.trim(), account, amount: Number(amount), applies_to: grades,
      boarding_only: boarding, year: school.current_year, term: school.current_term,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Fee type added");
    setName(""); setAmount(""); setGrades([]); setBoarding(false);
    qc.invalidateQueries({ queryKey: ["fee_types"] });
  }

  async function toggle(id: string, active: boolean) {
    const { error } = await supabase.from("fee_types").update({ active }).eq("id", id);
    if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["fee_types"] });
  }

  function openInvoice(f: { id: string; name: string; amount: number; applies_to: string[] }) {
    setInvFee(f);
    setInvGrades(f.applies_to.length ? [...f.applies_to] : []);
  }

  async function runInvoice() {
    if (!invFee) return;
    setInvBusy(true);
    const { data: n, error } = await supabase.rpc("invoice_fee", {
      _fee_type: invFee.id, _grades: invGrades, _year: school.current_year, _term: school.current_term,
    });
    setInvBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(n === 0 ? "Already invoiced for this period — balances unchanged" : `Invoiced ${n} student${n === 1 ? "" : "s"}: ${invFee.name} ${money(invFee.amount, school.currency)} each`);
    setInvFee(null);
    qc.invalidateQueries({ queryKey: ["debtors"] });
    qc.invalidateQueries({ queryKey: ["debtors_by_fee"] });
    qc.invalidateQueries({ queryKey: ["balances"] });
  }

  return (
    <>
      <PageHeader title="Fee structure" sub={`Term ${school.current_term}, ${school.current_year}`} />
      <div className="grid gap-4 lg:grid-cols-3">
        {can("fees_setup") && (
          <Card className="h-fit space-y-3">
            <div className="font-semibold">Add fee type</div>
            <div>
              <Label>Name</Label>
              <Input list="fee-names" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tuition" />
              <datalist id="fee-names">{DEFAULT_FEE_NAMES.map((n) => <option key={n} value={n} />)}</datalist>
            </div>
            <div><Label>Account</Label><select className={selectCls} value={account} onChange={(e) => setAccount(e.target.value)}>{ACCOUNTS.map((a) => <option key={a}>{a}</option>)}</select></div>
            <div><Label>Amount ({school.currency})</Label><Input type="number" min="0" step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div>
              <Label>Applies to classes (none selected = all)</Label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {GRADES.map((g) => {
                  const on = grades.includes(g);
                  return (
                    <button key={g} type="button" onClick={() => setGrades(on ? grades.filter((x) => x !== g) : [...grades, g])}
                      className={`rounded-full border px-2.5 py-1 text-xs ${on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{g}</button>
                  );
                })}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={boarding} onChange={(e) => setBoarding(e.target.checked)} /> Boarders only</label>
            <Button variant="gold" className="w-full" disabled={busy} onClick={add}>Add fee type</Button>
          </Card>
        )}
        <div className="space-y-2 lg:col-span-2">
          {(data ?? []).length === 0 ? <Empty>No fee types for this term yet.</Empty> : (data ?? []).map((f) => (
            <div key={f.id} className={`flex items-center justify-between gap-3 rounded-xl border bg-card p-4 ${f.active ? "" : "opacity-50"}`}>
              <div className="min-w-0">
                <div className="font-medium">{f.name}</div>
                <div className="text-xs text-muted-foreground">
                  {f.account} · {f.applies_to.length ? f.applies_to.join(", ") : "All classes"}{f.boarding_only ? " · Boarders" : ""}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{money(f.amount, school.currency)}</span>
                {can("finance") && f.active && <Button size="sm" variant="gold" onClick={() => openInvoice(f)}>Invoice</Button>}
                {can("fees_setup") && <Button size="sm" variant="outline" onClick={() => toggle(f.id, !f.active)}>{f.active ? "Disable" : "Enable"}</Button>}
              </div>
            </div>
          ))}
        </div>
      </div>
      <Dialog open={!!invFee} onOpenChange={(o) => !o && setInvFee(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invoice {invFee?.name}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Adds {invFee ? money(invFee.amount, school.currency) : ""} to each selected student's balance for Term {school.current_term}, {school.current_year}.
            Running it again for the same period will not double-charge.
          </p>
          <div>
            <Label>Classes to invoice (none selected = all classes this fee applies to)</Label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {GRADES.map((g) => {
                const on = invGrades.includes(g);
                return (
                  <button key={g} type="button" onClick={() => setInvGrades(on ? invGrades.filter((x) => x !== g) : [...invGrades, g])}
                    className={`rounded-full border px-2.5 py-1 text-xs ${on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{g}</button>
                );
              })}
            </div>
          </div>
          <Button variant="gold" className="w-full" disabled={invBusy} onClick={runInvoice}>Run invoicing</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
