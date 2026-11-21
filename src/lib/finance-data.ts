import { supabase } from "@/integrations/supabase/client";
import type { CashEntry } from "@/lib/cashbook";
import type { Database } from '@/integrations/supabase/types';

export type CashData = {
  entries: CashEntry[];
  allocations: { date: string; amount: number; fee: string; account: string; id?: string; ref?: string; method?: string; detail?: string }[];
  expenses: Database['public']['Tables']['expenses']['Row'][];
};

/** Loads non-voided receipts (with allocations) and expenses for a date range as cash entries. */
export async function loadCashEntries(schoolId: string, from: string, to: string): Promise<CashData> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const { readOfflineAccess } = await import('./offline-cache');
    const { readCollectionPack } = await import('./offline-payments');
    const access = await readOfflineAccess();
    const pack = access ? await readCollectionPack(access.userId, schoolId) : null;
    if (!pack?.cashData) throw new Error('Connect and sync school records first');
    const within = (date: string) => (!from || date >= from) && (!to || date <= to);
    return { entries: pack.cashData.entries.filter((e) => within(e.date)), allocations: pack.cashData.allocations.filter((a) => within(a.date)), expenses: pack.cashData.expenses.filter((e) => within(e.spent_on)) };
  }
  let r = supabase.from("payment_receipts").select("id,receipt_number,paid_on,method,total,students(first_name,last_name)").eq("school_id", schoolId).eq("voided", false);
  let e = supabase.from("expenses").select("*").eq("school_id", schoolId);
  let a = supabase.from("payment_allocations").select("id,amount,receipt_id,fee_types(name,account),payment_receipts!inner(paid_on,voided,receipt_number,method,students(first_name,last_name))").eq("school_id", schoolId).eq("payment_receipts.voided", false);
  if (from) { r = r.gte("paid_on", from); e = e.gte("spent_on", from); a = a.gte("payment_receipts.paid_on", from); }
  if (to) { r = r.lte("paid_on", to); e = e.lte("spent_on", to); a = a.lte("payment_receipts.paid_on", to); }
  async function pages<T>(query: { range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }> }) {
    const rows: T[] = [];
    for (let page = 0; ; page++) { const result = await query.range(page * 1000, page * 1000 + 999); if (result.error) throw result.error; rows.push(...(result.data ?? [])); if ((result.data?.length ?? 0) < 1000) break; }
    return { data: rows };
  }
  const [rr, er, ar] = await Promise.all([pages(r.order('id')), pages(e.order('id')), pages(a.order('id'))]);
  const entries: CashEntry[] = [
    ...(rr.data ?? []).map((x: any) => ({ id: x.id, date: x.paid_on, kind: "in" as const, detail: `Fees — ${x.students ? `${x.students.first_name} ${x.students.last_name}` : "Student"}`, ref: x.receipt_number, method: x.method, account: "Fees", amount: Number(x.total) })),
    ...(er.data ?? []).map((x) => ({ id: x.id, date: x.spent_on, kind: "out" as const, detail: `${x.category} — ${x.description}`, ref: x.voucher_reference ?? "", method: x.method, account: x.account, amount: Number(x.amount) })),
  ];
  const allocations = (ar.data ?? []).map((x: any) => ({ date: x.payment_receipts.paid_on as string, amount: Number(x.amount), fee: x.fee_types?.name ?? "Other", account: x.fee_types?.account ?? "Other", id: x.id, ref: x.payment_receipts.receipt_number, method: x.payment_receipts.method, detail: `${x.fee_types?.name ?? "Fees"} — ${x.payment_receipts.students ? `${x.payment_receipts.students.first_name} ${x.payment_receipts.students.last_name}` : "Student"}` }));
  return { entries, allocations, expenses: er.data ?? [] };
}
