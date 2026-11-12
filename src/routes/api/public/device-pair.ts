import { createFileRoute } from "@tanstack/react-router";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json", "access-control-allow-origin": "*" } });

// Android devices request pairing here. A request only creates a "pending" entry;
// it grants no data access until a School Head/Admin approves it in the web app.
export const Route = createFileRoute("/api/public/device-pair")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type", "access-control-allow-methods": "POST" } }),
      POST: async ({ request }) => {
        let b: any; try { b = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
        const code = String(b?.school_code ?? "").trim().toUpperCase();
        const device = String(b?.device_id ?? "").trim();
        if (!/^SCH-[A-Z0-9]{6}$/.test(code) || !device || device.length > 128) return json({ error: "school_code and device_id are required" }, 400);
        if (b.action !== "pair" && b.action !== "status") return json({ error: "Unsupported action. Use pair or status." }, 400);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: sc } = await supabaseAdmin.from("schools").select("id").eq("code", code).maybeSingle();
        if (!sc) return json({ status: "pending" }); // do not reveal whether a school exists
        const { data: ex } = await supabaseAdmin.from("school_sync_devices").select("status").eq("school_id", sc.id).eq("device_id", device).maybeSingle();
        if (ex) { await supabaseAdmin.from("school_sync_devices").update({ last_seen_at: new Date().toISOString() }).eq("school_id", sc.id).eq("device_id", device); return json({ status: ex.status }); }
        if (b.action === "status") return json({ status: "pending" });
        const { error } = await supabaseAdmin.from("school_sync_devices").insert({ school_id: sc.id, device_id: device, device_name: String(b.device_name ?? "Android device").slice(0, 80), platform: String(b.platform ?? "android").slice(0, 20) });
        if (error) return json({ error: "Could not register device" }, 500);
        return json({ status: "pending" });
      },
    },
  },
});
