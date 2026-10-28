import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentSchool } from "@/lib/school-context";
import { GRADES, money } from "@/lib/constants";
import { PageHeader, Card, Empty, selectCls } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/app/students")({
  head: () => ({ meta: [{ title: "Students — SchoolSys Pro" }] }),
  component: Students,
});

const PAGE = 50;
function Students() {
  const { school, can } = useCurrentSchool();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [grade, setGrade] = useState("");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(false);
  const [newGrade, setNewGrade] = useState(GRADES[0] ?? "ECD A");
  const [boarding, setBoarding] = useState(false);
  const [selectedArrears, setSelectedArrears] = useState<Record<string, boolean>>({});
  const [arrears, setArrears] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({
    queryKey: ["students", school.id, q, grade, page],
    queryFn: async () => {
      let r = supabase.from("students").select("*", { count: "exact" }).eq("school_id", school.id)
        .order("last_name").range(page * PAGE, page * PAGE + PAGE - 1);
      if (grade) r = r.eq("grade", grade);
      if (q) r = r.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,reg_number.ilike.%${q}%,guardian_phone.ilike.%${q}%`);
      const { data, count, error } = await r;
      if (error) throw error;
      return { rows: data, count: count ?? 0 };
    },
  });
  const fees = useQuery({
    queryKey: ["student-create-fees", school.id, school.current_year, school.current_term],
    queryFn: async () => {
      const { data, error } = await supabase.from("fee_types").select("id,name,account,amount,applies_to,boarding_only")
        .eq("school_id", school.id).eq("year", school.current_year).eq("term", school.current_term).eq("active", true).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const eligibleFees = (fees.data ?? []).filter((f) => (!f.applies_to.length || f.applies_to.includes(newGrade)) && (!f.boarding_only || boarding));

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string | undefined>;
    const selectedFees = eligibleFees.filter((fee) => selectedArrears[fee.id]);
    if (selectedFees.some((fee) => !Number.isFinite(Number(arrears[fee.id])) || Number(arrears[fee.id]) <= 0)) {
      toast.error("Enter a positive arrears amount for every selected fee type."); return;
    }
    const items = selectedFees.map((fee) => ({ fee_type_id: fee.id, amount: Number(arrears[fee.id]) }));
    setBusy(true);
    const { error } = await supabase.rpc("create_student_with_arrears", {
      _student: {
        school_id: school.id,
        reg_number: (f["reg_number"] ?? "").trim(),
        first_name: (f["first_name"] ?? "").trim(),
        last_name: (f["last_name"] ?? "").trim(),
        gender: f["gender"] || null,
        grade: newGrade,
        class_name: f["class_name"] || null,
        boarding,
        guardian_name: f["guardian_name"] || null,
        guardian_phone: f["guardian_phone"] || null,
      },
      _arrears: items,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(items.length ? `Student added with ${items.length} fee arrears item(s)` : "Student added");
    setOpen(false); setSelectedArrears({}); setArrears({}); setBoarding(false);
    qc.invalidateQueries({ queryKey: ["students", school.id] });
    qc.invalidateQueries({ queryKey: ["debtors", school.id] });
    qc.invalidateQueries({ queryKey: ["debtors_by_fee", school.id] });
    qc.invalidateQueries({ queryKey: ["dashboard", school.id] });
  }

  const rows = data?.rows ?? [];
  return (
    <>
      <PageHeader title="Students" sub={`${data?.count ?? 0} students`} action={can("students") && <Button onClick={() => { setSelectedArrears({}); setArrears({}); setOpen(true); }}>Add student</Button>} />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Input placeholder="Search name, reg no, guardian phone…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} className="h-10" />
        <select className={`${selectCls} sm:w-44`} value={grade} onChange={(e) => { setGrade(e.target.value); setPage(0); }}>
          <option value="">All classes</option>{GRADES.map((g) => <option key={g}>{g}</option>)}
        </select>
      </div>
      {rows.length === 0 ? <Empty>No students found.</Empty> : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
            <table className="w-full text-sm"><thead className="bg-muted text-left text-xs uppercase text-muted-foreground"><tr><th className="p-3">Reg No</th><th>Name</th><th>Class</th><th>Guardian</th><th>Status</th></tr></thead>
              <tbody className="divide-y">{rows.map((s) => <tr key={s.id}><td className="p-3 font-mono text-xs">{s.reg_number}</td><td className="font-medium">{s.first_name} {s.last_name} {s.boarding && <Badge variant="secondary" className="ml-1">Boarder</Badge>}</td><td>{s.grade}{s.class_name ? ` ${s.class_name}` : ""}</td><td className="text-muted-foreground">{s.guardian_name} {s.guardian_phone && <a className="text-primary" href={`tel:${s.guardian_phone}`}>{s.guardian_phone}</a>}</td><td><Badge variant={s.status === "active" ? "default" : "outline"}>{s.status}</Badge></td></tr>)}</tbody>
            </table>
          </div>
          <div className="space-y-2 md:hidden">{rows.map((s) => <Card key={s.id}><div className="flex justify-between"><div className="font-medium">{s.first_name} {s.last_name}</div><Badge variant="secondary">{s.grade}</Badge></div><div className="mt-1 text-xs text-muted-foreground">{s.reg_number} · {s.guardian_phone ?? "no phone"}</div></Card>)}</div>
          <div className="mt-4 flex justify-between"><Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={(page + 1) * PAGE >= (data?.count ?? 0)} onClick={() => setPage(page + 1)}>Next</Button></div>
        </>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New student</DialogTitle></DialogHeader>
          <form onSubmit={add} className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Registration number</Label><Input name="reg_number" required /></div>
            <div><Label>First name</Label><Input name="first_name" required /></div><div><Label>Surname</Label><Input name="last_name" required /></div>
            <div><Label>Grade / Form</Label><select name="grade" value={newGrade} onChange={(e) => { setNewGrade(e.target.value); setSelectedArrears({}); }} className={selectCls}>{GRADES.map((g) => <option key={g}>{g}</option>)}</select></div>
            <div><Label>Class (stream)</Label><Input name="class_name" placeholder="e.g. Blue, 2A" /></div>
            <div><Label>Gender</Label><select name="gender" className={selectCls}><option value="">—</option><option value="M">Male</option><option value="F">Female</option></select></div>
            <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={boarding} onChange={(e) => { setBoarding(e.target.checked); setSelectedArrears({}); }} /> Boarder</label>
            <div><Label>Guardian name</Label><Input name="guardian_name" /></div><div><Label>Guardian phone</Label><Input name="guardian_phone" placeholder="07…" /></div>
            <div className="col-span-2 rounded-lg border p-3">
              <div className="font-semibold">Opening arrears by fee type</div><p className="mb-3 mt-1 text-xs text-muted-foreground">Select each fee owed from a previous term and enter the outstanding amount. These balances remain separate by fee type.</p>
              {eligibleFees.length === 0 ? <p className="text-sm text-muted-foreground">Add fee types for this term first.</p> : <div className="space-y-2">{eligibleFees.map((fee) => <div key={fee.id} className="grid grid-cols-[auto_1fr_6.5rem] items-center gap-2"><input type="checkbox" aria-label={`Add arrears for ${fee.name}`} checked={!!selectedArrears[fee.id]} onChange={(e) => setSelectedArrears({ ...selectedArrears, [fee.id]: e.target.checked })} /><div className="min-w-0"><div className="text-sm font-medium">{fee.name}</div><div className="text-xs text-muted-foreground">{fee.account} · current fee {money(fee.amount, school.currency)}</div></div><Input aria-label={`${fee.name} arrears amount`} type="number" min="0.01" step="0.01" placeholder="Amount" disabled={!selectedArrears[fee.id]} value={arrears[fee.id] ?? ""} onChange={(e) => setArrears({ ...arrears, [fee.id]: e.target.value })} /></div>)}</div>}
              <div className="mt-3 border-t pt-3 text-right text-sm">Total opening arrears: <strong>{money(eligibleFees.reduce((sum, fee) => sum + (selectedArrears[fee.id] ? Number(arrears[fee.id] || 0) : 0), 0), school.currency)}</strong></div>
            </div>
            <Button className="col-span-2" disabled={busy}>{busy ? "Saving…" : "Save student"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
