import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentSchool } from "@/lib/school-context";
import { GRADES } from "@/lib/constants";
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

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const { error } = await supabase.from("students").insert({
      school_id: school.id, reg_number: f.reg_number.trim(), first_name: f.first_name.trim(), last_name: f.last_name.trim(),
      gender: (f.gender || null) as "M" | null, grade: f.grade, class_name: f.class_name || null, boarding: f.boarding === "on",
      guardian_name: f.guardian_name || null, guardian_phone: f.guardian_phone || null,
      opening_balance: Number(f.opening_balance || 0),
    });
    if (error) return toast.error(error.code === "23505" ? "That registration number already exists" : error.message);
    toast.success("Student added");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["students", school.id] });
  }

  const rows = data?.rows ?? [];
  return (
    <>
      <PageHeader title="Students" sub={`${data?.count ?? 0} students`} action={can("students") && <Button onClick={() => setOpen(true)}>Add student</Button>} />
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
                  <tr key={s.id}>
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
              <Card key={s.id}>
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
            <div className="col-span-2"><Label>Opening balance (arrears)</Label><Input name="opening_balance" type="number" step="0.01" defaultValue="0" /></div>
            <Button className="col-span-2">Save student</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
