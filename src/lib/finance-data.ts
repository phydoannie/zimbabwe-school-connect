import { supabase } from "@/integrations/supabase/client";
import type { CashEntry } from "@/lib/cashbook";

/** Loads non-voided receipts (with allocations) and expenses for a date range as cash entries. */
export async function loadCashEntries(schoolId: string, from: string, to: string) {
  let r = supabase.from("payment_receipts").select("id,receipt_number,paid_on,method,total,students(first_name,last_name)").eq("school_id", schoolId).eq("voided", false);
  let e = supabase.from("expenses").select("*").eq("school_id", schoolId);
  let a = supabase.from("payment_allocations").select("amount,receipt_id,fee_types(name,account),payment_receipts!inner(paid_on,voided)").eq("school_id", schoolId).eq("payment_receipts.voided", false);
  if (from) { r = r.gte("paid_on", from); e = e.gte("spent_on", from); a = a.gte("payment_receipts.paid_on", from); }
  if (to) { r = r.lte("paid_on", to); e = e.lte("spent_on", to); a = a.lte("payment_receipts.paid_on", to); }
  const [rr, er, ar] = await Promise.all([r, e, a]);
  if (rr.error) throw rr.error; if (er.error) throw er.error; if (ar.error) throw ar.error;
  const entries: CashEntry[] = [
    ...(rr.data ?? []).map((x: any) => ({ id: x.id, date: x.paid_on, kind: "in" as const, detail: `Fees — ${x.students ? `${x.students.first_name} ${x.students.last_name}` : "Student"}`, ref: x.receipt_number, method: x.method, account: "Fees", amount: Number(x.total) })),
    ...(er.data ?? []).map((x) => ({ id: x.id, date: x.spent_on, kind: "out" as const, detail: `${x.category} — ${x.description}`, ref: x.voucher_reference ?? "", method: x.method, account: x.account, amount: Number(x.amount) })),
  ];
  const allocations = (ar.data ?? []).map((x: any) => ({ amount: Number(x.amount), fee: x.fee_types?.name ?? "Other", account: x.fee_types?.account ?? "Other" }));
  return { entries, allocations, expenses: er.data ?? [] };
}
