import { createFileRoute } from "@tanstack/react-router";
import { hashPairingToken, validPairingToken } from '@/lib/device-pair-policy';

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json", "access-control-allow-origin": "*" } });

// Android devices request pairing here. A request only creates a "pending" entry;
// it grants no data access until a School Head/Admin approves it in the web app.
export const Route = createFileRoute("/api/public/device-pair")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type", "access-control-allow-methods": "POST" } }),
      POST: async ({ request }) => {
        let b: Record<string, unknown>; try { const value: unknown = await request.json(); if (!value || typeof value !== 'object' || Array.isArray(value)) return json({ error: 'Invalid JSON' }, 400); b = value as Record<string, unknown>; } catch { return json({ error: "Invalid JSON" }, 400); }
        const code = String(b['school_code'] ?? "").trim().toUpperCase();
        const device = String(b['device_id'] ?? "").trim();
        if (!/^SCH-[A-Z0-9]{6,10}$/.test(code) || !device || device.length > 128) return json({ error: "school_code and device_id are required" }, 400);
        if (b['action'] !== "pair" && b['action'] !== "status") return json({ error: "Unsupported action. Use pair or status." }, 400);
        const token = b['device_token'];
        if (b['action'] === 'status' && !validPairingToken(token)) return json({ error: 'Private device_token required; pair this device first' }, 401);
        const tokenHash = validPairingToken(token) ? await hashPairingToken(token) : null;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: sc } = await supabaseAdmin.from("schools").select("id").eq("code", code).maybeSingle();
        const newToken = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
        if (!sc) return json({ status: 'pending', ...(b['action'] === 'pair' ? { device_token: newToken } : {}) });
        const { data: ex, error: lookupError } = await supabaseAdmin.from("school_sync_devices").select("status,pairing_token_hash").eq("school_id", sc.id).eq("device_id", device).maybeSingle();
        if (lookupError) return json({ error: 'Could not check device' }, 500);
        if (ex) {
          if (!tokenHash || ex.pairing_token_hash !== tokenHash) return json({ status: 'pending' });
          await supabaseAdmin.from('school_sync_devices').update({ last_seen_at: new Date().toISOString() }).eq('school_id', sc.id).eq('device_id', device);
          return json({ status: ex.status });
        }
        if (b['action'] === "status") return json({ status: "pending" });
        const { error } = await supabaseAdmin.from("school_sync_devices").insert({ school_id: sc.id, device_id: device, device_name: String(b['device_name'] ?? "Android device").slice(0, 80), platform: String(b['platform'] ?? "android").slice(0, 20), pairing_token_hash: await hashPairingToken(newToken) });
        if (error) return json({ error: "Could not register device" }, 500);
        return json({ status: "pending", device_token: newToken });
      },
    },
  },
});
