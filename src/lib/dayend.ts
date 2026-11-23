import type { CashEntry } from "@/lib/cashbook";
import { groupTotals } from "@/lib/cashbook";

/** Day-end summary: fees vs other income, money in by method, and money out. */
export function dayEndSummary(entries: CashEntry[]) {
  const ins = entries.filter((e) => e.kind === "in"); const outs = entries.filter((e) => e.kind === "out");
  const r = (n: number) => Math.round(n * 100) / 100;
  const fees = r(ins.filter((e) => e.account === "Fees").reduce((s, e) => s + e.amount, 0));
  const other = r(ins.filter((e) => e.account !== "Fees").reduce((s, e) => s + e.amount, 0));
  const spent = r(outs.reduce((s, e) => s + e.amount, 0));
  return { fees, other, totalIn: r(fees + other), spent, net: r(fees + other - spent),
    bySource: groupTotals(ins, (e) => (e.account === "Fees" ? "School fees" : e.account), (e) => e.amount),
    byMethod: groupTotals(ins, (e) => e.method, (e) => e.amount), ins, outs };
}
