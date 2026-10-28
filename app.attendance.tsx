import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentSchool } from "@/lib/school-context";
import { PageHeader, Card, Empty, selectCls, Stat } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/app/attendance")({
  head: () => ({ meta: [{ title: "Staff attendance — SchoolSys Pro" }] }),
  component: Attendance,
});

type Status = "present" | "absent" | "late" | "leave";
function Attendance() {
  const { school, userId, can } = useCurrentSchool();
  const qc = useQueryClient();
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const teachers = useQuery({ queryKey: ["teachers", school.id], queryFn: async () => {
    const { data, error } = await supabase.from("teachers").select("id,full_name,ec_number,phone,active").eq("school_id", school.id).eq("active", true).order("full_name");
    if (error) throw error; return data ?? [];
  }});
  const attendance = useQuery({ queryKey: ["teacher-attendance", school.id, day], queryFn: async () => {
    const { data, error } = await supabase.from("teacher_attendance").select("id,teacher_id,status,check_in,check_out,notes").eq("school_id", school.id).eq("day", day);
    if (error) throw error; return data ?? [];
  }});
  async function addTeacher(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!can("attendance")) return;
    const form = e.currentTarget; const f = new FormData(form);
    setBusy(true);
    const { error } = await supabase.from("teachers").insert({ school_id: school.id, full_name: String(f.get("full_name")).trim(), ec_number: String(f.get("ec_number") || "").trim() || null, phone: String(f.get("phone") || "").trim() || null });
    setBusy(false); if (error) { toast.error(error.message); return; }
    form.reset(); toast.success("Teacher added"); qc.invalidateQueries({ queryKey: ["teachers", school.id] });
  }
  async function saveAttendance() {
    if (!can("attendance")) { toast.error("You do not have permission to mark attendance."); return; }
    const staff = teachers.data ?? []; if (!staff.length) { toast.error("Add teachers first."); return; }
    setBusy(true);
    for (const t of staff) {
      const existing = (attendance.data ?? []).find((a) => a.teacher_id === t.id);
      const status = statuses[t.id] ?? (existing?.status as Status | undefined);
      if (!status) continue;
      const payload = { school_id: school.id, teacher_id: t.id, day, status, recorded_by: userId };
      const result = existing
        ? await supabase.from("teacher_attendance").update({ status, recorded_by: userId }).eq("id", existing.id)
        : await supabase.from("teacher_attendance").insert(payload);
      if (result.error) { setBusy(false); toast.error(`${t.full_name}: ${result.error.message}`); return; }
    }
    setBusy(false); toast.success("Attendance saved"); setStatuses({}); qc.invalidateQueries({ queryKey: ["teacher-attendance", school.id, day] });
  }
  const staff = teachers.data ?? []; const marked = staff.filter((t) => statuses[t.id] || (attendance.data ?? []).some((a) => a.teacher_id === t.id)).length;
  const present = staff.filter((t) => (statuses[t.id] ?? attendance.data?.find((a) => a.teacher_id === t.id)?.status) === "present").length;
  return <>
    <PageHeader title="Staff attendance" sub="Manage teacher records and daily attendance." />
    <div className="mb-4 grid grid-cols-2 gap-3"><Stat label="Active teachers" value={String(staff.length)} /><Stat label="Marked for selected day" value={`${marked} / ${staff.length}`} /></div>
    <div className="grid gap-4 lg:grid-cols-3">
      {can("attendance") && <Card className="h-fit"><h2 className="mb-3 font-semibold">Add teacher</h2><form onSubmit={addTeacher} className="space-y-3"><div><Label>Full name</Label><Input name="full_name" required /></div><div><Label>EC number</Label><Input name="ec_number" /></div><div><Label>Phone</Label><Input name="phone" /></div><Button disabled={busy} className="w-full">Add teacher</Button></form></Card>}
      <Card className="lg:col-span-2"><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><Label>Attendance date</Label><Input type="date" value={day} onChange={(e) => setDay(e.target.value)} /></div><div className="text-sm text-muted-foreground">Present: {present}</div></div>
        {staff.length === 0 ? <Empty>No active teachers yet. Add a teacher to start the register.</Empty> : <div className="space-y-2">{staff.map((t) => { const old = attendance.data?.find((a) => a.teacher_id === t.id); const value = statuses[t.id] ?? (old?.status as Status | undefined) ?? ""; return <div key={t.id} className="grid grid-cols-[1fr_8rem] items-center gap-3 rounded-lg border p-3"><div><div className="font-medium">{t.full_name}</div><div className="text-xs text-muted-foreground">{t.ec_number || "No EC number"} {old ? `· previously marked ${old.status}` : "· not marked"}</div></div><select className={selectCls} value={value} disabled={!can("attendance")} onChange={(e) => setStatuses({ ...statuses, [t.id]: e.target.value as Status })}><option value="">Not marked</option><option value="present">Present</option><option value="absent">Absent</option><option value="late">Late</option><option value="leave">On leave</option></select></div>; })}</div>}
        {can("attendance") && staff.length > 0 && <Button className="mt-4 w-full" disabled={busy} onClick={saveAttendance}>{busy ? "Saving…" : "Save attendance"}</Button>}
      </Card>
    </div>
  </>;
}
