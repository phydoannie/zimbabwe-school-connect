import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentSchool } from "@/lib/school-context";
import { PAYMENT_METHODS, money, sumAllocations } from "@/lib/constants";
import { receiptPdf } from "@/lib/pdf";
import { PageHeader, Card, selectCls } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/app/collect")({
  head: () => ({ meta: [{ title: "Collect fees — SchoolSys Pro" }] }),
  component: Collect,
});

type Stu = { id: string; first_name: string; last_name: string; reg_number: string; grade: string };

function Collect() {
  const { school, can } = useCurrentSchool();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [stu, setStu] = useState<Stu | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [method, setMethod] = useState<string>(PAYMENT_METHODS[0] ?? "Cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const search = useQuery({
    queryKey: ["stu-search", school.id, q],
    enabled: q.length >= 2 && !stu,
    queryFn: async () => {
      const { data } = await supabase.from("students").select("id,first_name,last_name,reg_number,grade")
        .eq("school_id", school.id).eq("status", "active")
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,reg_number.ilike.%${q}%`).limit(8);
      return data ?? [];
    },
  });

  const bal = useQuery({
    queryKey: ["balances", stu?.id],
    enabled: !!stu,
    queryFn: async () => (await supabase.rpc("student_balances", { _student: stu!.id })).data ?? [],
  });

  if (!can("finance")) return <p>You don't have permission to collect fees.</p>;

  const items = Object.entries(amounts).map(([fee_type_id, a]) => ({ fee_type_id, amount: Number(a) })).filter((i) => i.amount > 0);
  const total = sumAllocations(items);

  async function submit() {
    if (!stu || items.length === 0) { toast.error("Enter at least one amount"); return; }
    setBusy(true);
    const { data: rid, error } = await supabase.rpc("collect_payment", {
      _student: stu.id, _method: method, _reference: reference || "", _notes: notes || "",
      _paid_on: new Date().toISOString().slice(0, 10), _items: items,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const { data: r } = await supabase.from("payment_receipts").select("*").eq("id", rid as string).single();
    const newBal = (await supabase.rpc("student_balances", { _student: stu.id })).data ?? [];
    if (r) {
      receiptPdf(school, {
        ...r, total: Number(r.total), student: stu,
        items: items.map((i) => {
          const b = newBal.find((x) => x.fee_type_id === i.fee_type_id);
          return { name: b?.name ?? "Fee", amount: i.amount, ...(b ? { balance: Number(b.balance) } : {}) };
        }),
      }).save(`${r.receipt_number}.pdf`);
    }
    toast.success(`Receipt ${r?.receipt_number} issued for ${money(total, school.currency)}`);
    setAmounts({}); setReference(""); setNotes(""); setStu(null); setQ("");
    qc.invalidateQueries();
  }

  return (
    <>
      <PageHeader title="Collect fees" sub={`Term ${school.current_term}, ${school.current_year}`} />
      {!stu ? (
        <Card>
          <Label>Find student</Label>
          <Input autoFocus placeholder="Name or registration number" value={q} onChange={(e) => setQ(e.target.value)} className="mt-1 h-11" />
          <div className="mt-3 divide-y">
            {(search.data ?? []).map((s) => (
              <button key={s.id} onClick={() => setStu(s)} className="flex w-full items-center justify-between py-3 text-left hover:bg-muted/50">
                <span className="font-medium">{s.first_name} {s.last_name}</span>
                <span className="text-xs text-muted-foreground">{s.reg_number} · {s.grade}</span>
              </button>
            ))}
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-semibold">{stu.first_name} {stu.last_name}</div>
                <div className="text-sm text-muted-foreground">{stu.reg_number} · {stu.grade}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setStu(null); setAmounts({}); }}>Change</Button>
            </div>
            <div className="mt-4 space-y-2">
              {(bal.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">No fees set for this class this term. Add them under Fee structure.</p>}
              {(bal.data ?? []).map((b) => (
                <div key={b.fee_type_id} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_auto_auto_8rem]">
                  <div><div className="font-medium">{b.name}</div><div className="text-xs text-muted-foreground">{b.account}</div></div>
                  <div className="hidden text-right text-xs sm:block">Due<br /><span className="font-semibold">{money(b.due, school.currency)}</span></div>
                  <div className="hidden text-right text-xs sm:block">Balance<br /><span className={`font-semibold ${Number(b.balance) > 0 ? "text-destructive" : "text-success"}`}>{money(b.balance, school.currency)}</span></div>
                  <Input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0.00" className="h-11 text-right"
                    value={amounts[b.fee_type_id] ?? ""} onChange={(e) => setAmounts({ ...amounts, [b.fee_type_id]: e.target.value })} />
                </div>
              ))}
            </div>
          </Card>
          <Card className="h-fit space-y-3 lg:sticky lg:top-6">
            <div><Label>Payment method</Label><select className={selectCls} value={method} onChange={(e) => setMethod(e.target.value)}>{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</select></div>
            <div><Label>Reference (EcoCash / bank ref)</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} /></div>
            <div><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
            <div className="flex items-center justify-between border-t pt-3">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="font-display text-2xl font-bold">{money(total, school.currency)}</span>
            </div>
            <Button variant="gold" className="h-12 w-full" disabled={busy || total <= 0} onClick={submit}>Issue one receipt</Button>
          </Card>
        </div>
      )}
    </>
  );
}
