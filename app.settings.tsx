import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentSchool } from "@/lib/school-context";
import { CURRENCIES } from "@/lib/constants";
import { PageHeader, Card, selectCls } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/app/settings")({
  head: () => ({ meta: [{ title: "Settings — SchoolSys Pro" }] }),
  component: Settings,
});

function Settings() {
  const { school, can } = useCurrentSchool();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!can("settings")) { toast.error("You do not have permission to change school settings."); return; }
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await supabase.from("schools").update({
      name: String(f.get("name")).trim(), address: String(f.get("address") || "").trim() || null,
      phone: String(f.get("phone") || "").trim() || null, email: String(f.get("email") || "").trim() || null,
      slogan: String(f.get("slogan") || "").trim() || null, bank_details: String(f.get("bank_details") || "").trim() || null,
      currency: String(f.get("currency")), current_year: Number(f.get("year")), current_term: Number(f.get("term")),
    }).eq("id", school.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    await qc.invalidateQueries();
    toast.success("School settings saved");
  }
  return <><PageHeader title="School settings" sub={`School code: ${school.code}`} />
    <Card className="max-w-2xl"><form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><Label>School name</Label><Input name="name" defaultValue={school.name} required disabled={!can("settings")} /></div>
      <div className="sm:col-span-2"><Label>Address</Label><Input name="address" defaultValue={school.address ?? ""} disabled={!can("settings")} /></div>
      <div><Label>Phone</Label><Input name="phone" defaultValue={school.phone ?? ""} disabled={!can("settings")} /></div>
      <div><Label>School email</Label><Input name="email" type="email" defaultValue={school.email ?? ""} disabled={!can("settings")} /></div>
      <div className="sm:col-span-2"><Label>School motto / slogan</Label><Input name="slogan" defaultValue={school.slogan ?? ""} disabled={!can("settings")} /></div>
      <div className="sm:col-span-2"><Label>Bank details for receipts</Label><Input name="bank_details" defaultValue={school.bank_details ?? ""} disabled={!can("settings")} /></div>
      <div><Label>Currency</Label><select name="currency" className={selectCls} defaultValue={school.currency} disabled={!can("settings")}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></div>
      <div className="grid grid-cols-2 gap-2"><div><Label>Academic year</Label><Input name="year" type="number" min="2020" max="2100" defaultValue={school.current_year} required disabled={!can("settings")} /></div><div><Label>Current term</Label><select name="term" className={selectCls} defaultValue={school.current_term} disabled={!can("settings")}><option value="1">Term 1</option><option value="2">Term 2</option><option value="3">Term 3</option></select></div></div>
      {can("settings") && <Button disabled={busy} className="sm:col-span-2">{busy ? "Saving…" : "Save settings"}</Button>}
      {!can("settings") && <p className="text-sm text-muted-foreground sm:col-span-2">Only the School Head or an authorized administrator can change these settings.</p>}
    </form></Card>
  </>;
}
