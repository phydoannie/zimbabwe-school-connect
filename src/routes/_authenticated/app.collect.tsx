import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentSchool } from "@/lib/school-context";
import { PAYMENT_METHODS, money, sumAllocations } from "@/lib/constants";
import { receiptPdf } from "@/lib/pdf";
import { pageHead } from '@/lib/metadata';
import { PageHeader, Card, selectCls } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { applyPending, collectionChanged, listPayments, queuePayment, readCollectionPack, syncPayments, type CollectionPack, type QueuedPayment } from "@/lib/offline-payments";

export const Route = createFileRoute("/_authenticated/app/collect")({
  head: () => pageHead('Collect fees', 'Collect multiple school fees and issue an official receipt.'),
  component: Collect,
});

type Stu = { id: string; first_name: string; last_name: string; reg_number: string; grade: string };

function Collect() {
  const { school, can, userId } = useCurrentSchool();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [stu, setStu] = useState<Stu | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [method, setMethod] = useState<string>(PAYMENT_METHODS[0] ?? "Cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const [online, setOnline] = useState(true);
  const [pack, setPack] = useState<CollectionPack | null>(null);
  const [queued, setQueued] = useState<QueuedPayment[]>([]);
  useEffect(() => {
    let disposed = false;
    const load = async () => {
      const saved = await readCollectionPack(userId, school.id);
      const payments = await listPayments(userId, school.id);
      if (!disposed) { setPack(saved); setQueued(payments); }
    };
    const changed = () => { void load(); };
    const connection = () => setOnline(navigator.onLine);
    connection(); void load();
    window.addEventListener('online', connection); window.addEventListener('offline', connection); window.addEventListener('collections-changed', changed);
    return () => { disposed = true; window.removeEventListener('online', connection); window.removeEventListener('offline', connection); window.removeEventListener('collections-changed', changed); };
  }, [userId, school.id]);
  const search = useQuery({
    queryKey: ["stu-search", school.id, q], enabled: online && can('finance') && q.length >= 2 && !stu,
    queryFn: async () => { const result = await supabase.from("students").select("id,first_name,last_name,reg_number,grade").eq("school_id", school.id).eq("status", "active").or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,reg_number.ilike.%${q}%`).limit(8); if (result.error) throw result.error; return result.data ?? []; },
  });
  const matches = !online ? (pack?.students ?? []).filter((s) => `${s.first_name} ${s.last_name} ${s.reg_number}`.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : search.data ?? [];
  const bal = useQuery({
    queryKey: ["balances", school.id, stu?.id], enabled: online && !!stu,
    queryFn: async () => { if (!stu) return []; const result = await supabase.rpc("student_balances", { _student: stu.id }); if (result.error) throw result.error; return result.data ?? []; },
  });
  const balances = stu ? (!online ? applyPending(pack?.balances ?? [], queued.filter((p) => !pack?.syncedReferences?.includes(p.id)), stu.id).map((b) => ({ ...b, name: b.fee_name })) : (bal.data ?? []).map((b) => { const pending = queued.filter((p) => p.status === 'pending' && p.studentId === stu.id && !pack?.syncedReferences?.includes(p.id)).flatMap((p) => p.items).filter((i) => i.fee_type_id === b.fee_type_id).reduce((n, i) => n + i.amount, 0); return { ...b, balance: Number(b.balance) - pending }; })) : [];
  const feeCount = useQuery({
    queryKey: ["fee_types_count", school.id, school.current_year, school.current_term], enabled: online && can("finance"),
    queryFn: async () => { const result = await supabase.from("fee_types").select("id", { count: "exact", head: true }).eq("school_id", school.id).eq("year", school.current_year).eq("term", school.current_term).eq("active", true); if (result.error) throw result.error; return result.count ?? 0; },
  });
  const count = online ? feeCount.data : pack?.fees.filter((f) => f.active && f.year === school.current_year && f.term === school.current_term).length;
  if (!can("finance")) return <p>You don't have permission to collect fees.</p>;

  const items = Object.entries(amounts).map(([fee_type_id, a]) => ({ fee_type_id, amount: Number(a) })).filter((i) => i.amount > 0);
  const total = sumAllocations(items);

  async function submit() {
    if (busy) return;
    if (!stu || items.length === 0) { toast.error("Enter at least one amount"); return; }
    if (items.some((i) => !Number.isFinite(i.amount)) || count === 0) { toast.error("Add fee types and valid amounts first"); return; }
    setBusy(true);
    if (!online || method.startsWith("Cash (")) {
      try {
        const id = crypto.randomUUID();
        const receipt = { receipt_number: `OFF-${id.slice(0, 8).toUpperCase()}`, pending: true, paid_on: new Date().toISOString().slice(0, 10), year: school.current_year, term: school.current_term, method, reference, notes, total, received_by_name: "Bursar", voided: false, student: stu, items: items.map((i) => { const balance = balances.find((b) => b.fee_type_id === i.fee_type_id); return { name: balance?.name ?? "Fee", amount: i.amount, balance: Number(balance?.balance ?? 0) - i.amount }; }) };
        if (online && !pack) { toast.error("Wait until collection records are saved, then retry"); return; }
        await queuePayment({ id, userId, schoolId: school.id, studentId: stu.id, receipt, items, status: 'pending' });
        toast.success("Cash receipt saved on this device");
        setAmounts({}); setReference(""); setNotes(""); setStu(null); setQ("");
        try { receiptPdf(school, receipt).save(`${receipt.receipt_number}.pdf`); } catch { toast.error("Receipt saved; download it below"); }
        if (online) { try { await syncPayments(userId, school.id); void qc.invalidateQueries(); } catch { toast.error("Receipt saved locally; sync will retry"); } }
      } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save receipt"); }
      finally { setBusy(false); collectionChanged(); }
      return;
    }
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
      {count === 0 && (
        <div className="mb-4 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
          <span className="font-semibold">Add fee types first.</span> Before collecting, set up this term's fees (Tuition, General Levy, etc.) so parents can pay against them.{" "}
          <Link to="/app/fees" className="font-semibold text-primary underline">Open fee structure</Link>
        </div>
      )}
      {!online && !pack && <p className="mb-4 text-sm text-warning">Reconnect to save school records before collecting offline.</p>}
      {!stu ? (
        <Card>
          <Label>Find student</Label>
          <Input autoFocus placeholder="Name or registration number" value={q} onChange={(e) => setQ(e.target.value)} className="mt-1 h-11" />
          <div className="mt-3 divide-y">
            {matches.map((s) => (
              <Button key={s.id} variant="ghost" onClick={() => setStu(s)} className="flex h-auto w-full items-center justify-between py-3 text-left">
                <span className="font-medium">{s.first_name} {s.last_name}</span>
                <span className="text-xs text-muted-foreground">{s.reg_number} · {s.grade}</span>
              </Button>
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
              {balances.length === 0 && <p className="text-sm text-muted-foreground">No fees set for this class this term. Add them under Fee structure.</p>}
              {balances.length > 0 && <p className="text-xs text-muted-foreground">Tick the fees the parent is paying and type the exact amount handed over — partial payments are fine, the balance carries forward.</p>}
              {balances.map((b) => {
                const on = b.fee_type_id in amounts;
                return (
                <div key={b.fee_type_id} className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border p-3 sm:grid-cols-[auto_1fr_auto_auto_8rem] ${on ? "border-primary bg-primary/5" : ""}`}>
                  <input type="checkbox" className="h-5 w-5" checked={on} aria-label={`Pay ${b.name}`}
                    onChange={(e) => {
                      const n = { ...amounts };
                      if (e.target.checked) n[b.fee_type_id] = "";
                      else delete n[b.fee_type_id];
                      setAmounts(n);
                    }} />
                  <div><div className="font-medium">{b.name}</div><div className="text-xs text-muted-foreground">{b.account} · bal {money(b.balance, school.currency)}</div></div>
                  <div className="hidden text-right text-xs sm:block">Due<br /><span className="font-semibold">{money(b.due, school.currency)}</span></div>
                  <div className="hidden text-right text-xs sm:block">Balance<br /><span className={`font-semibold ${Number(b.balance) > 0 ? "text-destructive" : "text-success"}`}>{money(b.balance, school.currency)}</span></div>
                  <Input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0.00" className="col-span-3 h-11 text-right sm:col-span-1"
                    aria-label={`Amount for ${b.name}`} disabled={!on || busy} value={amounts[b.fee_type_id] ?? ""} onChange={(e) => setAmounts({ ...amounts, [b.fee_type_id]: e.target.value })} />
                </div>
                );
              })}
            </div>
          </Card>
          <Card className="h-fit space-y-3 lg:sticky lg:top-6">
            <div><Label>Payment method</Label><select className={selectCls} value={method} onChange={(e) => setMethod(e.target.value)}>{PAYMENT_METHODS.map((m) => <option key={m} disabled={!online && !m.startsWith("Cash (")}>{m}</option>)}</select></div>
            <div><Label>Reference (EcoCash / bank ref)</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} /></div>
            <div><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
            <div className="flex items-center justify-between border-t pt-3">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="font-display text-2xl font-bold">{money(total, school.currency)}</span>
            </div>
            <Button variant="gold" className="h-12 w-full" disabled={busy || total <= 0 || count === 0 || (!online && (!pack || !method.startsWith("Cash (")))} onClick={submit}>Issue one receipt</Button>
          </Card>
        </div>
      )}
      {queued.length > 0 && <section className="mt-6 space-y-2 border-t pt-4">
        <h2 className="font-semibold">Receipts collected on this device</h2>
        {[...queued].reverse().map((payment) => <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-3 text-sm">
          <div><div>{payment.receipt.student.first_name} {payment.receipt.student.last_name} · {money(payment.receipt.total, school.currency)}</div><div className="text-xs text-muted-foreground">{payment.officialNumber ?? payment.receipt.receipt_number} · {payment.status === 'synced' ? 'Synced' : 'Pending sync'}</div>{payment.error && <p className="text-xs text-destructive">{payment.error}</p>}</div>
          <Button variant="outline" size="sm" onClick={() => receiptPdf(school, { ...payment.receipt, pending: payment.status !== 'synced', receipt_number: payment.officialNumber ?? payment.receipt.receipt_number }).save(`${payment.officialNumber ?? payment.receipt.receipt_number}.pdf`)}>PDF</Button>
        </div>)}
      </section>}
    </>
  );
}
