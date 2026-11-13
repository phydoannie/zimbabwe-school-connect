import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentSchool } from "@/lib/school-context";
import { GRADES, money } from "@/lib/constants";
import { PageHeader, Empty, Stat, selectCls } from "@/components/page";
import { Button } from "@/components/ui/button";
import { pageHead } from '@/lib/metadata';

export const Route = createFileRoute("/_authenticated/app/debtors")({
  head: () => pageHead('Debtors', 'Outstanding school balances by student, class and fee type.'),
  component: Debtors,
});

type Row = { student_id: string; reg_number: string; full_name: string; grade: string; guardian_phone: string | null; due: number; paid: number; balance: number; detail?: string };

function Debtors() {
  const { school } = useCurrentSchool();
  const [grade, setGrade] = useState("");
  const [fee, setFee] = useState("");
  const all = useQuery({
    queryKey: ["debtors", school.id],
    queryFn: async () => (await supabase.rpc("debtors", { _school: school.id })).data ?? [],
  });
  const byFee = useQuery({
    queryKey: ["debtors_by_fee", school.id],
    queryFn: async () => (await supabase.rpc("debtors_by_fee", { _school: school.id })).data ?? [],
  });
  const feeNames = useMemo(() => [...new Set((byFee.data ?? []).map((r) => r.fee_name))].sort(), [byFee.data]);

  const rows: Row[] = (fee
    ? (byFee.data ?? []).filter((r) => r.fee_name === fee).map((r) => ({ ...r, due: Number(r.due), paid: Number(r.paid), balance: Number(r.balance) }))
    : (all.data ?? []).map((r) => ({ ...r, due: Number(r.due), paid: Number(r.paid), balance: Number(r.balance) })))
    .filter((d) => d.balance > 0 && (!grade || d.grade === grade))
    .sort((a, b) => b.balance - a.balance);
  const total = rows.reduce((s, d) => s + d.balance, 0);

  // Per fee-type totals summary
  const summary = feeNames.map((n) => {
    const r = (byFee.data ?? []).filter((x) => x.fee_name === n && Number(x.balance) > 0 && (!grade || x.grade === grade));
    return { name: n, count: r.length, total: r.reduce((s, x) => s + Number(x.balance), 0) };
  }).filter((s) => s.count > 0);

  function csv() {
    const lines = [["Reg No", "Name", "Class", "Fee type", "Guardian phone", "Due", "Paid", "Balance"], ...rows.map((d) => [d.reg_number, d.full_name, d.grade, fee || "All fees", d.guardian_phone ?? "", d.due, d.paid, d.balance])];
    const blob = new Blob([lines.map((l) => l.map((c) => `"${c}"`).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `debtors${fee ? "-" + fee : ""}.csv`; a.click();
  }

  return (
    <>
      <PageHeader title="Debtors" sub={fee ? `${fee} — Term ${school.current_term}, ${school.current_year}` : `Term ${school.current_term}, ${school.current_year} including arrears`} action={<Button variant="outline" onClick={csv}>Export CSV</Button>} />
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Stat label="Debtors" value={String(rows.length)} />
        <Stat label="Total owed" value={money(total, school.currency)} tone="bad" />
      </div>
      {summary.length > 0 && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          <button onClick={() => setFee("")} className={`shrink-0 rounded-lg border px-3 py-2 text-left text-xs ${!fee ? "border-primary bg-primary/10" : "bg-card"}`}>
            <div className="font-semibold">All fees</div><div className="text-muted-foreground">overall</div>
          </button>
          {summary.map((s) => (
            <button key={s.name} onClick={() => setFee(s.name)} className={`shrink-0 rounded-lg border px-3 py-2 text-left text-xs ${fee === s.name ? "border-primary bg-primary/10" : "bg-card"}`}>
              <div className="font-semibold">{s.name}</div>
              <div className="text-muted-foreground">{s.count} · {money(s.total, school.currency)}</div>
            </button>
          ))}
        </div>
      )}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <select className={`${selectCls} sm:w-48`} value={fee} onChange={(e) => setFee(e.target.value)}>
          <option value="">All fee types</option>{feeNames.map((n) => <option key={n}>{n}</option>)}
        </select>
        <select className={`${selectCls} sm:w-48`} value={grade} onChange={(e) => setGrade(e.target.value)}>
          <option value="">All classes</option>{GRADES.map((g) => <option key={g}>{g}</option>)}
        </select>
      </div>
      {rows.length === 0 ? <Empty>No outstanding balances.</Empty> : (
        <div className="space-y-2">
          {rows.map((d) => (
            <div key={d.student_id} className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4">
              <div className="min-w-0">
                <div className="truncate font-medium">{d.full_name}</div>
                <div className="text-xs text-muted-foreground">{d.reg_number} · {d.grade} · paid {money(d.paid, school.currency)} of {money(d.due, school.currency)}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-destructive">{money(d.balance, school.currency)}</span>
                {d.guardian_phone && (
                  <Button asChild size="sm" variant="outline">
                    <a href={`https://wa.me/${d.guardian_phone.replace(/\D/g, "").replace(/^0/, "263")}?text=${encodeURIComponent(`Dear parent, ${d.full_name} has an outstanding ${fee ? fee + " " : ""}balance of ${money(d.balance, school.currency)} at ${school.name}. Thank you.`)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
