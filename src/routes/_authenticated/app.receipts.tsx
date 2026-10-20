import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentSchool } from "@/lib/school-context";
import { money } from "@/lib/constants";
import { receiptPdf } from "@/lib/pdf";
import { PageHeader, Empty } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/app/receipts")({
  head: () => ({ meta: [{ title: "Receipts — SchoolSys Pro" }] }),
  component: Receipts,
});

function Receipts() {
  const { school, role } = useCurrentSchool();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const { data } = useQuery({
    queryKey: ["receipts", school.id, q],
    queryFn: async () => {
      let r = supabase.from("payment_receipts")
        .select("*, students(first_name,last_name,reg_number,grade), payment_allocations(amount, fee_types(name))")
        .eq("school_id", school.id).order("created_at", { ascending: false }).limit(100);
      if (q) r = r.ilike("receipt_number", `%${q}%`);
      return (await r).data ?? [];
    },
  });

  function pdf(r: NonNullable<typeof data>[number]) {
    receiptPdf(school, {
      ...r, total: Number(r.total), student: r.students!,
      items: r.payment_allocations.map((a) => ({ name: a.fee_types?.name ?? "Fee", amount: Number(a.amount) })),
    }).save(`${r.receipt_number}.pdf`);
  }

  async function voidIt(id: string) {
    const reason = prompt("Reason for voiding this receipt?");
    if (!reason) return;
    const { error } = await supabase.rpc("void_receipt", { _receipt: id, _reason: reason });
    if (error) return toast.error(error.message);
    toast.success("Receipt voided");
    qc.invalidateQueries();
  }

  return (
    <>
      <PageHeader title="Receipts" sub="Receipts are never deleted — voids are recorded with a reason." />
      <Input placeholder="Search receipt number" value={q} onChange={(e) => setQ(e.target.value)} className="mb-4 h-10" />
      {(data ?? []).length === 0 ? <Empty>No receipts yet.</Empty> : (
        <div className="space-y-2">
          {data!.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-medium">{r.students?.first_name} {r.students?.last_name}
                  {r.voided && <Badge variant="destructive">VOID</Badge>}</div>
                <div className="text-xs text-muted-foreground">{r.receipt_number} · {r.paid_on} · {r.method} · {r.payment_allocations.map((a) => a.fee_types?.name).join(", ")}</div>
                {r.voided && <div className="text-xs text-destructive">Reason: {r.void_reason}</div>}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{money(r.total, school.currency)}</span>
                <Button size="sm" variant="outline" onClick={() => pdf(r)}>PDF</Button>
                {!r.voided && (role === "head" || role === "bursar") && <Button size="sm" variant="ghost" onClick={() => voidIt(r.id)}>Void</Button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
