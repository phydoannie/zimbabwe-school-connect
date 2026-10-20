import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentSchool } from "@/lib/school-context";
import { GRADES, money } from "@/lib/constants";
import { PageHeader, Empty, Stat, selectCls } from "@/components/page";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/debtors")({
  head: () => ({ meta: [{ title: "Debtors — SchoolSys Pro" }] }),
  component: Debtors,
});

function Debtors() {
  const { school } = useCurrentSchool();
  const [grade, setGrade] = useState("");
  const { data } = useQuery({
    queryKey: ["debtors", school.id],
    queryFn: async () => (await supabase.rpc("debtors", { _school: school.id })).data ?? [],
  });
  const rows = (data ?? []).filter((d) => Number(d.balance) > 0 && (!grade || d.grade === grade));
  const total = rows.reduce((s, d) => s + Number(d.balance), 0);

  function csv() {
    const lines = [["Reg No", "Name", "Class", "Guardian phone", "Due", "Paid", "Balance"], ...rows.map((d) => [d.reg_number, d.full_name, d.grade, d.guardian_phone ?? "", d.due, d.paid, d.balance])];
    const blob = new Blob([lines.map((l) => l.map((c) => `"${c}"`).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "debtors.csv"; a.click();
  }

  return (
    <>
      <PageHeader title="Debtors" sub={`Term ${school.current_term}, ${school.current_year} including arrears`} action={<Button variant="outline" onClick={csv}>Export CSV</Button>} />
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Stat label="Debtors" value={String(rows.length)} />
        <Stat label="Total owed" value={money(total, school.currency)} tone="bad" />
      </div>
      <select className={`${selectCls} mb-4 sm:w-48`} value={grade} onChange={(e) => setGrade(e.target.value)}>
        <option value="">All classes</option>{GRADES.map((g) => <option key={g}>{g}</option>)}
      </select>
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
                    <a href={`https://wa.me/${d.guardian_phone.replace(/\D/g, "").replace(/^0/, "263")}?text=${encodeURIComponent(`Dear parent, ${d.full_name} has an outstanding balance of ${money(d.balance, school.currency)} at ${school.name}. Thank you.`)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
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
