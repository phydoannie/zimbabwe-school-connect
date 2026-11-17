import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useOfflineSchool } from "@/lib/use-offline-school";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentSchool } from "@/lib/school-context";
import { GRADES, money } from "@/lib/constants";
import { pageHead } from '@/lib/metadata';
import { PageHeader, Card, Empty, selectCls } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/app/students")({
  head: () => pageHead('Students', 'School student register, classes and guardian contact records.'),
  component: Students,
});

const PAGE = 50;

type StuRow = { id: string; reg_number: string; first_name: string; last_name: string; grade: string; class_name: string | null; boarding: boolean; guardian_name: string | null; guardian_phone: string | null; status: string };

function StudentProfile({ student, onClose }: { student: StuRow; onClose: () => void }) {
  const { school, can } = useCurrentSchool();
  const offline = useOfflineSchool();
  const qc = useQueryClient();
  const [amounts, setAmounts] = useState<Record<string, string> | null>(null);
  const [busy, setBusy] = useState(false);

  const bal = useQuery({
    queryKey: ["balances", school.id, student.id], enabled: offline.online,
    queryFn: async () => { const result = await supabase.rpc("student_balances", { _student: student.id }); if (result.error) throw result.error; return result.data ?? []; },
  });
  const arrears = useQuery({
    queryKey: ["arrears", school.id, student.id], enabled: offline.online,
    queryFn: async () => { const result = await supabase.from("student_fee_arrears").select("fee_type_id, amount").eq("school_id", school.id).eq("student_id", student.id); if (result.error) throw result.error; return result.data ?? []; },
  });

  const balanceRows = offline.online ? bal.data : offline.pack?.balances.filter((b) => b.student_id === student.id).map((b) => ({ ...b, name: b.fee_name, account: offline.pack?.fees.find((f) => f.id === b.fee_type_id)?.account ?? "" }));
  // Initialize the editor once both queries have loaded.
  if (amounts === null && bal.data && arrears.data) {
    const init: Record<string, string> = {};
    for (const b of bal.data) init[b.fee_type_id] = "0";
    for (const a of arrears.data) init[a.fee_type_id] = String(Number(a.amount));
    setAmounts(init);
  }

  async function saveArrears() {
    if (!amounts) return;
    setBusy(true);
    const items = Object.entries(amounts).map(([fee_type_id, v]) => ({ fee_type_id, amount: Number(v || 0) }));
    if (items.some((i) => !Number.isFinite(i.amount) || i.amount < 0)) { setBusy(false); toast.error("Enter valid arrears amounts"); return; }
    const { error } = await supabase.rpc("save_student_arrears", { _student: student.id, _items: items });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Arrears saved");
    qc.invalidateQueries({ queryKey: ["arrears", school.id, student.id] });
    qc.invalidateQueries({ queryKey: ["balances", school.id, student.id] });
    qc.invalidateQueries({ queryKey: ["debtors"] });
    qc.invalidateQueries({ queryKey: ["debtors_by_fee"] });
  }

  const total = (balanceRows ?? []).reduce((s, b) => s + Number(b.balance), 0);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{student.first_name} {student.last_name}</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">{student.reg_number} · {student.grade}{student.class_name ? ` ${student.class_name}` : ""}{student.boarding ? " · Boarder" : ""}</p>
        <div className="mt-2 flex items-center justify-between rounded-lg border bg-muted/40 p-3">
          <span className="text-sm text-muted-foreground">Total balance</span>
          <span className={`font-display text-xl font-bold ${total > 0 ? "text-destructive" : "text-success"}`}>{money(total, school.currency)}</span>
        </div>
        <div className="mt-3 space-y-2">
          {(bal.isError || arrears.isError) && <p className="text-sm text-destructive">Student balances could not load. Reconnect and try again.</p>}
          {(balanceRows ?? []).length === 0 && <p className="text-sm text-muted-foreground">No fee types for this class this term.</p>}
          {(balanceRows ?? []).map((b) => (
            <div key={b.fee_type_id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">{b.name}</div>
                <div className={`text-sm font-semibold ${Number(b.balance) > 0 ? "text-destructive" : "text-success"}`}>{money(b.balance, school.currency)}</div>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">Due {money(b.due, school.currency)} · Paid {money(b.paid, school.currency)}</div>
              {offline.online && can("finance") && amounts && (
                <div className="mt-2 flex items-center gap-2">
                  <Label htmlFor={`arrears-${b.fee_type_id}`} className="text-xs">Arrears (older unpaid terms)</Label>
                  <Input type="number" min="0" step="0.01" inputMode="decimal" className="h-9 w-28 text-right"
                    id={`arrears-${b.fee_type_id}`} aria-label={`${b.name} arrears`}
                    value={amounts[b.fee_type_id] ?? ""} placeholder="0.00"
                    onChange={(e) => setAmounts({ ...amounts, [b.fee_type_id]: e.target.value })} />
                </div>
              )}
            </div>
          ))}
        </div>
        {offline.online && can("finance") && (balanceRows ?? []).length > 0 && (
          <Button variant="gold" className="mt-3 w-full" disabled={busy || !amounts || bal.isError || arrears.isError} onClick={saveArrears}>Save arrears</Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Students() {
  const { school, can } = useCurrentSchool();
  const offline = useOfflineSchool();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [grade, setGrade] = useState("");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [opening, setOpening] = useState<Record<string, string>>({});
  const fees = useQuery({ enabled: offline.online, queryKey: ["enrolment-fees", school.id], queryFn: async () => { const result = await supabase.from("fee_types").select("id,name,year,term").eq("school_id", school.id).eq("active", true).order("name"); if (result.error) throw result.error; return result.data; } });
  const [profile, setProfile] = useState<StuRow | null>(null);

  const register = useQuery({
    enabled: offline.online,
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

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string | undefined>;
    if (saving) return;
    const arrears = Object.entries(opening).map(([fee_type_id, amount]) => ({ fee_type_id, amount: Number(amount || 0) }));
    if (arrears.some((i) => !Number.isFinite(i.amount) || i.amount < 0)) { toast.error("Enter valid arrears amounts"); return; }
    setSaving(true);
    const { error } = await supabase.rpc("enrol_student", { _school: school.id, _student: {
      reg_number: (f["reg_number"] ?? "").trim(), first_name: (f["first_name"] ?? "").trim(), last_name: (f["last_name"] ?? "").trim(),
      gender: f["gender"] || "", grade: f["grade"] ?? "Grade 1", class_name: f["class_name"] || "", boarding: f["boarding"] === "on",
      guardian_name: f["guardian_name"] || "", guardian_phone: f["guardian_phone"] || "",
    }, _arrears: arrears });
    setSaving(false);
    if (error) { toast.error(error.code === "23505" ? "That registration number already exists" : error.message); return; }
    toast.success("Student and arrears saved");
    setOpen(false); setOpening({});
    void qc.invalidateQueries();
  }

  const localRows = (offline.pack?.students ?? []).filter((s) => (!grade || s.grade === grade) && `${s.first_name} ${s.last_name} ${s.reg_number} ${s.guardian_phone ?? ""}`.toLowerCase().includes(q.toLowerCase())).sort((a,b) => a.last_name.localeCompare(b.last_name));
  const data = offline.online ? register.data : { rows: localRows.slice(page * PAGE, (page + 1) * PAGE), count: localRows.length };
  const rows = data?.rows ?? [];
  return (
    <>
      <PageHeader title="Students" sub={`${data?.count ?? 0} students`} action={offline.online && can("students") && <Button onClick={() => { setOpening({}); setOpen(true); }}>Add student</Button>} />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Input placeholder="Search name, reg no, guardian phone…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} className="h-10" />
        <select className={`${selectCls} sm:w-44`} value={grade} onChange={(e) => { setGrade(e.target.value); setPage(0); }}>
          <option value="">All classes</option>{GRADES.map((g) => <option key={g}>{g}</option>)}
        </select>
      </div>
      {rows.length === 0 ? <Empty>No students found.</Empty> : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
                <tr><th className="p-3">Reg No</th><th>Name</th><th>Class</th><th>Guardian</th><th>Status</th></tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((s) => (
                  <tr key={s.id} onClick={() => setProfile(s)} className="cursor-pointer hover:bg-muted/50">
                    <td className="p-3 font-mono text-xs">{s.reg_number}</td>
                    <td className="font-medium">{s.first_name} {s.last_name} {s.boarding && <Badge variant="secondary" className="ml-1">Boarder</Badge>}</td>
                    <td>{s.grade}{s.class_name ? ` ${s.class_name}` : ""}</td>
                    <td className="text-muted-foreground">{s.guardian_name} {s.guardian_phone && <a className="text-primary" href={`tel:${s.guardian_phone}`}>{s.guardian_phone}</a>}</td>
                    <td><Badge variant={s.status === "active" ? "default" : "outline"}>{s.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 md:hidden">
             {rows.map((s) => (
              <Card key={s.id} onClick={() => setProfile(s)} className="cursor-pointer">
                <div className="flex justify-between"><div className="font-medium">{s.first_name} {s.last_name}</div><Badge variant="secondary">{s.grade}</Badge></div>
                <div className="mt-1 text-xs text-muted-foreground">{s.reg_number} · {s.guardian_phone ?? "no phone"}</div>
              </Card>
            ))}
          </div>
          <div className="mt-4 flex justify-between">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={(page + 1) * PAGE >= (data?.count ?? 0)} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </>
      )}
      {profile && <StudentProfile student={profile} onClose={() => setProfile(null)} />}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New student</DialogTitle></DialogHeader>
          <form onSubmit={add} className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Registration number</Label><Input name="reg_number" required /></div>
            <div><Label>First name</Label><Input name="first_name" required /></div>
            <div><Label>Surname</Label><Input name="last_name" required /></div>
            <div><Label>Grade / Form</Label><select name="grade" className={selectCls}>{GRADES.map((g) => <option key={g}>{g}</option>)}</select></div>
            <div><Label>Class (stream)</Label><Input name="class_name" placeholder="e.g. Blue, 2A" /></div>
            <div><Label>Gender</Label><select name="gender" className={selectCls}><option value="">—</option><option value="M">Male</option><option value="F">Female</option></select></div>
            <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" name="boarding" /> Boarder</label>
            <div><Label>Guardian name</Label><Input name="guardian_name" /></div>
            <div><Label>Guardian phone</Label><Input name="guardian_phone" placeholder="07…" /></div>
            {offline.online && can("finance") && <div className="col-span-2 space-y-2 border-t pt-3">
              <Label>Opening arrears by fee type</Label>
              {fees.isPending && <p className="text-sm text-muted-foreground">Loading fee types…</p>}
              {fees.isError && <p className="text-sm text-destructive">Fee types could not load. Reconnect and try again.</p>}
              {fees.data?.length === 0 && <p className="text-sm text-muted-foreground">No fee types configured.</p>}
              {(fees.data ?? []).map((fee) => <div key={fee.id} className="flex items-center justify-between gap-3">
                <Label htmlFor={`opening-${fee.id}`}>{fee.name} · {fee.year}, period {fee.term}</Label>
                <Input id={`opening-${fee.id}`} aria-label={`${fee.name} opening arrears`} className="w-28 text-right" type="number" min="0" step="0.01" value={opening[fee.id] ?? "0"} onChange={(e) => setOpening({ ...opening, [fee.id]: e.target.value })} />
              </div>)}
              <div className="flex justify-between border-t pt-2 text-sm font-semibold"><span>Total opening arrears</span><span>{money(Object.values(opening).reduce((s, v) => s + Number(v || 0), 0), school.currency)}</span></div>
            </div>}
            <Button disabled={saving || (offline.online && can("finance") && (fees.isPending || fees.isError))} className="col-span-2">{saving ? "Saving…" : "Save student"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
