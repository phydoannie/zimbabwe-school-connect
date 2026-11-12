import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Empty } from "@/components/page";
import { useCurrentSchool } from "@/lib/school-context";
import { pageHead } from "@/lib/metadata";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/app/devices")({
  head: () => pageHead("Android Devices", "Approve or revoke Android devices that sync with your school."),
  component: Devices,
});

const fmt = (d: string | null) => (d ? new Date(d).toLocaleString() : "—");

function Devices() {
  const { school, role } = useCurrentSchool(); const qc = useQueryClient();
  const allowed = role === "head" || role === "admin";
  const [tab, setTab] = useState<"pending" | "approved" | "revoked">("pending");
  const [revoke, setRevoke] = useState<string | null>(null);
  const { data = [], error, isLoading } = useQuery({ queryKey: ["devices", school.id], enabled: allowed, queryFn: async () => { const r = await supabase.rpc("list_sync_devices", { _school: school.id }); if (r.error) throw r.error; return r.data ?? []; } });
  async function setStatus(device: string, status: "approved" | "revoked") {
    const r = await supabase.rpc("set_sync_device_status", { _school: school.id, _device: device, _status: status });
    if (r.error) { toast.error(r.error.message); return; }
    toast.success(status === "approved" ? "Device approved" : "Device revoked"); qc.invalidateQueries({ queryKey: ["devices", school.id] });
  }
  if (!allowed) return <Empty>Only the School Head or Administrator can manage Android devices.</Empty>;
  const rows = data.filter((d) => d.status === tab);
  return <>
    <PageHeader title="Android Devices" sub={`Android app pairs with school code ${school.code}`} />
    <div className="mb-4 flex gap-2">{(["pending", "approved", "revoked"] as const).map((t) => <Button key={t} variant={tab === t ? "default" : "outline"} onClick={() => setTab(t)} className="capitalize">{t} ({data.filter((d) => d.status === t).length})</Button>)}</div>
    {error ? <Empty>Devices could not be loaded.</Empty> : isLoading ? <Empty>Loading devices…</Empty> : !rows.length ? <Empty>No {tab} devices.</Empty> :
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b text-muted-foreground"><tr>{["Device", "Device ID", "Requested", "Approved", "Last sync", ""].map((h) => <th key={h} className="px-3 py-3">{h}</th>)}</tr></thead>
        <tbody className="divide-y">{rows.map((d) => <tr key={d.id}><td className="px-3 py-3 font-medium">{d.device_name ?? "Android device"}<div className="text-muted-foreground capitalize">{d.platform} · {d.status}</div></td><td className="px-3 py-3 font-mono text-xs">{d.device_id}</td><td className="whitespace-nowrap px-3 py-3">{fmt(d.requested_at)}</td><td className="whitespace-nowrap px-3 py-3">{fmt(d.approved_at)}</td><td className="whitespace-nowrap px-3 py-3">{fmt(d.last_seen_at)}</td>
          <td className="whitespace-nowrap px-3 py-3 text-right">{d.status !== "approved" && <Button size="sm" onClick={() => setStatus(d.device_id, "approved")}>Approve</Button>} {d.status !== "revoked" && <Button size="sm" variant="outline" onClick={() => setRevoke(d.device_id)}>{d.status === "pending" ? "Reject" : "Revoke"}</Button>}</td></tr>)}</tbody></table></div>}
    <AlertDialog open={!!revoke} onOpenChange={(o) => !o && setRevoke(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Revoke this device?</AlertDialogTitle><AlertDialogDescription>It will no longer be allowed to synchronise with your school. You can approve it again later.</AlertDialogDescription></AlertDialogHeader>
      <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { if (revoke) setStatus(revoke, "revoked"); setRevoke(null); }}>Revoke</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}
