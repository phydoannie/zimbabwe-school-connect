import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/lib/school-context";
import { CURRENCIES, ROLE_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Set up your school — SchoolSys Pro" }] }),
  component: Onboarding,
});

function Onboarding() {
  const { memberships, userId, switchSchool } = useSchool();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const pending = memberships.filter((m) => m.status === "pending");

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const { data, error } = await supabase.rpc("create_school", {
      _name: String(f.get("name")), _address: String(f.get("address") || ""), _phone: String(f.get("phone") || ""),
      _email: String(f.get("email") || ""), _currency: String(f.get("currency")), _year: Number(f.get("year")),
      _term: Number(f.get("term")), _full_name: String(f.get("full_name")),
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    await qc.invalidateQueries({ queryKey: ["memberships", userId] });
    switchSchool(data as string);
    toast.success("School created");
    nav({ to: "/app" });
  }

  async function join(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await supabase.rpc("request_membership", {
      _code: String(f.get("code")), _role: f.get("role") as "bursar", _full_name: String(f.get("full_name")),
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    await qc.invalidateQueries({ queryKey: ["memberships", userId] });
    toast.success("Request sent. The School Head must approve it.");
  }

  const sel = "h-11 w-full rounded-md border border-input bg-background px-3 text-sm";
  return (
    <div className="min-h-screen bg-background">
      <div className="zim-stripe h-1.5" />
      <div className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-3xl font-bold">Let's get your school set up</h1>
        <p className="mt-2 text-muted-foreground">Register a new school, or join one with its school code.</p>
        {pending.length > 0 && (
          <div className="mt-6 rounded-lg border border-gold bg-gold/10 p-4 text-sm">
            You have {pending.length} membership request(s) awaiting approval.
          </div>
        )}
        <Tabs defaultValue="create" className="mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create">Register school</TabsTrigger>
            <TabsTrigger value="join">Join with code</TabsTrigger>
          </TabsList>
          <TabsContent value="create">
            <form onSubmit={create} className="space-y-3 rounded-xl border bg-card p-5 shadow-card">
              <div><Label>Your full name</Label><Input name="full_name" required className="h-11" /></div>
              <div><Label>School name</Label><Input name="name" required placeholder="e.g. Mabvuku High School" className="h-11" /></div>
              <div><Label>Address</Label><Input name="address" placeholder="Street, town, province" className="h-11" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Phone</Label><Input name="phone" placeholder="+263…" className="h-11" /></div>
                <div><Label>Email</Label><Input name="email" type="email" className="h-11" /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Currency</Label><select name="currency" className={sel}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></div>
                <div><Label>Year</Label><Input name="year" type="number" defaultValue={new Date().getFullYear()} className="h-11" /></div>
                <div><Label>Term</Label><select name="term" className={sel}><option>1</option><option>2</option><option>3</option></select></div>
              </div>
              <Button disabled={busy} className="h-11 w-full">Create school</Button>
              <p className="text-xs text-muted-foreground">You'll be the School Head and receive a unique school code.</p>
            </form>
          </TabsContent>
          <TabsContent value="join">
            <form onSubmit={join} className="space-y-3 rounded-xl border bg-card p-5 shadow-card">
              <div><Label>Your full name</Label><Input name="full_name" required className="h-11" /></div>
              <div><Label>School code</Label><Input name="code" required placeholder="SCH-XXXXXX" className="h-11 uppercase" /></div>
              <div><Label>Requested role</Label>
                <select name="role" className={sel}>
                  {["bursar", "deputy_head", "admin", "teacher"].map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
              <Button disabled={busy} className="h-11 w-full">Request access</Button>
              <p className="text-xs text-muted-foreground">A school code doesn't grant access on its own — the head approves every request.</p>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
