import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { PageHeader, Empty } from "@/components/page";
import { useCurrentSchool } from "@/lib/school-context";
import { money } from "@/lib/constants";
import { loadCashEntries } from "@/lib/finance-data";
import { dayEndSummary } from "@/lib/dayend";
import { pageHead } from "@/lib/metadata";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/app/dayend")({
  head: () => pageHead("Day-end report", "Daily summary of fees, other income and expenses for closing the till."),
  component: DayEnd,
});

function DayEnd() {
  const { school, can } = useCurrentSchool(); const c = school.currency;
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const allowed = can("reports") || can("finance");
  const q = useQuery({ queryKey: ["dayend", school.id, day], enabled: allowed && !!day, networkMode: "always", queryFn: () => loadCashEntries(school.id, day, day) });
  if (!allowed) return <Empty>You do not have access to reports.</Empty>;
  const s = q.data ? dayEndSummary(q.data.entries) : null;
  const List = ({ title, rows }: { title: string; rows: { name: string; total: number }[] }) => <div className="rounded-lg border bg-card p-4"><h3 className="mb-3 font-semibold">{title}</h3>{!rows.length ? <p className="text-sm text-muted-foreground">Nothing recorded.</p> : <table className="w-full text-sm"><tbody className="divide-y">{rows.map((r) => <tr key={r.name}><td className="py-2">{r.name}</td><td className="py-2 text-right">{money(r.total, c)}</td></tr>)}</tbody></table>}</div>;
  return <>
    <PageHeader title="Day-end report" sub={`${school.name} · ${day}`} action={<Button variant="outline" className="print:hidden" onClick={() => window.print()}><Printer className="h-4 w-4" />Print</Button>} />
    <div className="mb-5 max-w-xs print:hidden"><Label htmlFor="deDay">Date</Label><Input id="deDay" type="date" value={day} onChange={(e) => setDay(e.target.value)} /></div>
    {q.error ? <Empty>Day-end report could not be loaded.</Empty> : !s ? <Empty>Loading report…</Empty> : <>
      <div className="mb-5 grid gap-3 grid-cols-2 lg:grid-cols-5">
        {([["School fees", s.fees], ["Other income", s.other], ["Total income", s.totalIn], ["Expenses", s.spent], ["Net for the day", s.net]] as const).map(([l, v]) => <div key={l} className="rounded-lg border bg-card p-4"><div className="text-xs text-muted-foreground">{l}</div><div className={`text-lg font-semibold ${v < 0 ? "text-destructive" : ""}`}>{money(v, c)}</div></div>)}
      </div>
      <div className="mb-5 grid gap-4 md:grid-cols-2"><List title="Income by source" rows={s.bySource} /><List title="Income by payment method (cash-up)" rows={s.byMethod} /></div>
      <div className="overflow-x-auto rounded-lg border bg-card p-4"><h3 className="mb-3 font-semibold">All transactions</h3>{![...s.ins, ...s.outs].length ? <p className="text-sm text-muted-foreground">No money in or out on this day.</p> :
        <table className="w-full text-left text-sm"><thead className="text-muted-foreground"><tr>{["Details", "Ref / Method", "In", "Out"].map((h) => <th key={h} className="py-2 pr-3">{h}</th>)}</tr></thead><tbody className="divide-y">{[...s.ins, ...s.outs].map((e) => <tr key={e.kind + e.id}><td className="py-2 pr-3">{e.detail}</td><td className="py-2 pr-3">{e.ref || "—"}<div className="text-muted-foreground">{e.method}</div></td><td className="py-2 pr-3 text-primary">{e.kind === "in" ? money(e.amount, c) : ""}</td><td className="py-2 text-destructive">{e.kind === "out" ? money(e.amount, c) : ""}</td></tr>)}</tbody></table>}</div>
    </>}
  </>;
}
