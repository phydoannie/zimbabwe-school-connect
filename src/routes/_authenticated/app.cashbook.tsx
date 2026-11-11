import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Printer } from "lucide-react";
import { PageHeader, Empty, selectCls } from "@/components/page";
import { useCurrentSchool } from "@/lib/school-context";
import { PAYMENT_METHODS, money } from "@/lib/constants";
import { buildCashBook, downloadCsv } from "@/lib/cashbook";
import { loadCashEntries } from "@/lib/finance-data";
import { pageHead } from "@/lib/metadata";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/app/cashbook")({
  head: () => pageHead("Cash Book", "Daily cash book of fee receipts and expense payments with running balance."),
  component: CashBook,
});

function CashBook() {
  const { school, can } = useCurrentSchool();
  const [from, setFrom] = useState(`${school.current_year}-01-01`); const [to, setTo] = useState("");
  const [method, setMethod] = useState(""); const [opening, setOpening] = useState("0");
  const { data, error, isLoading } = useQuery({ queryKey: ["cashbook", school.id, from, to], enabled: can("finance") || can("reports"), queryFn: () => loadCashEntries(school.id, from, to) });
  if (!can("reports") && !can("finance")) return <Empty>You do not have access to the cash book.</Empty>;
  const entries = (data?.entries ?? []).filter((e) => !method || e.method === method);
  const rows = buildCashBook(entries, Number(opening) || 0);
  const tin = entries.filter((e) => e.kind === "in").reduce((s, e) => s + e.amount, 0);
  const tout = entries.filter((e) => e.kind === "out").reduce((s, e) => s + e.amount, 0);
  const closing = (Number(opening) || 0) + tin - tout; const c = school.currency;
  return <>
    <PageHeader title="Cash Book" sub={`${rows.length} entries`} action={<div className="flex gap-2 print:hidden">
      <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" />Print</Button>
      <Button variant="outline" disabled={!rows.length} onClick={() => downloadCsv("cash-book.csv", [["Date", "Details", "Ref", "Method", "Account", "Receipts", "Payments", "Balance"], ...rows.map((r) => [r.date, r.detail, r.ref, r.method, r.account, r.kind === "in" ? r.amount : "", r.kind === "out" ? r.amount : "", r.balance])])}><Download className="h-4 w-4" />CSV</Button></div>} />
    <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
      <div><Label htmlFor="cbFrom">From</Label><Input id="cbFrom" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
      <div><Label htmlFor="cbTo">To</Label><Input id="cbTo" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      <div><Label htmlFor="cbMethod">Method</Label><select id="cbMethod" className={selectCls} value={method} onChange={(e) => setMethod(e.target.value)}><option value="">All methods</option>{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</select></div>
      <div><Label htmlFor="cbOpen">Opening balance ({c})</Label><Input id="cbOpen" type="number" step="0.01" value={opening} onChange={(e) => setOpening(e.target.value)} /></div>
    </div>
    <div className="mb-5 grid gap-3 sm:grid-cols-4">
      {[["Opening", Number(opening) || 0], ["Receipts", tin], ["Payments", tout], ["Closing balance", closing]].map(([l, v]) => <div key={l as string} className="rounded-lg border bg-card p-4"><div className="text-xs text-muted-foreground">{l}</div><div className="text-lg font-semibold">{money(v as number, c)}</div></div>)}
    </div>
    {error ? <Empty>Cash book could not be loaded.</Empty> : isLoading ? <Empty>Loading cash book…</Empty> : !rows.length ? <Empty>No money in or out for these dates.</Empty> :
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b text-muted-foreground"><tr>{["Date", "Details", "Ref / Method", "Receipts", "Payments", "Balance"].map((h) => <th key={h} className="px-3 py-3">{h}</th>)}</tr></thead>
        <tbody className="divide-y">{rows.map((r) => <tr key={r.kind + r.id}><td className="whitespace-nowrap px-3 py-3">{r.date}</td><td className="min-w-48 px-3 py-3">{r.detail}<div className="text-muted-foreground">{r.account}</div></td><td className="px-3 py-3">{r.ref || "—"}<div className="text-muted-foreground">{r.method}</div></td>
          <td className="whitespace-nowrap px-3 py-3 text-primary">{r.kind === "in" ? money(r.amount, c) : ""}</td><td className="whitespace-nowrap px-3 py-3 text-destructive">{r.kind === "out" ? money(r.amount, c) : ""}</td><td className="whitespace-nowrap px-3 py-3 font-semibold">{money(r.balance, c)}</td></tr>)}</tbody></table></div>}
  </>;
}
