export type CashEntry = { id: string; date: string; kind: "in" | "out"; detail: string; ref: string; method: string; account: string; amount: number };
export type CashRow = CashEntry & { balance: number };

/** Sorts entries by date (receipts before payments on the same day) and adds a running balance. */
export function buildCashBook(entries: CashEntry[], opening = 0): CashRow[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date) || (a.kind === b.kind ? 0 : a.kind === "in" ? -1 : 1));
  let bal = opening;
  return sorted.map((e) => { bal = Math.round((bal + (e.kind === "in" ? e.amount : -e.amount)) * 100) / 100; return { ...e, balance: bal }; });
}

export function groupTotals<T>(rows: T[], key: (r: T) => string, amt: (r: T) => number) {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + amt(r));
  return [...m.entries()].map(([name, total]) => ({ name, total: Math.round(total * 100) / 100 })).sort((a, b) => b.total - a.total);
}

export function downloadCsv(name: string, rows: (string | number | null | undefined)[][]) {
  const cell = (v: unknown) => `"${String(v ?? "").replace(/^[=+@-]/, "'$&").replace(/"/g, '""')}"`;
  const url = URL.createObjectURL(new Blob([rows.map((r) => r.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
