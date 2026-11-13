import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { registerOfflineApp } from '@/lib/pwa';
import { restoreOfflineViews, saveOfflineViews } from '@/lib/offline-cache';

export function OfflineStatus({ userId, onConnectionChange }: { userId: string; onConnectionChange: (online: boolean) => void }) {
  const client = useQueryClient();
  const [online, setOnline] = useState(true);
  const [savedAt, setSavedAt] = useState<number>();
  const [syncing, setSyncing] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void registerOfflineApp().catch(() => setFailed(true));
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void restoreOfflineViews(client, userId).then((saved) => { if (!disposed && saved) setSavedAt(saved); }).catch(() => setFailed(true));
    const connection = () => { setOnline(navigator.onLine); onConnectionChange(navigator.onLine); };
    connection();
    const refresh = () => { void client.invalidateQueries(); };
    window.addEventListener('online', connection);
    window.addEventListener('online', refresh);
    window.addEventListener('offline', connection);
    const unsubscribe = client.getQueryCache().subscribe((event) => {
      if (!navigator.onLine || event.type !== 'updated' || event.action.type !== 'success') return;
      clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          const { data } = await supabase.auth.getSession();
          if (disposed || data.session?.user.id !== userId || !data.session.expires_at) return;
          const saved = await saveOfflineViews(client, userId, data.session.expires_at);
          if (!disposed) { setSavedAt(saved); setFailed(false); }
        } catch { if (!disposed) setFailed(true); }
      }, 500);
    });
    return () => { disposed = true; clearTimeout(timer); unsubscribe(); window.removeEventListener('online', connection); window.removeEventListener('online', refresh); window.removeEventListener('offline', connection); };
  }, [client, userId, onConnectionChange]);

  async function sync() {
    setSyncing(true); setFailed(false);
    try {
      await client.invalidateQueries();
      if (client.getQueryCache().getAll().some((q) => q.isActive() && q.state.status === 'error')) throw new Error('Refresh failed');
      const { data } = await supabase.auth.getSession();
      if (data.session?.user.id === userId && data.session.expires_at) setSavedAt(await saveOfflineViews(client, userId, data.session.expires_at));
    } catch { setFailed(true); } finally { setSyncing(false); }
  }

  return <div role="status" className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted px-4 py-2 text-xs md:px-8">
    <div className="flex items-center gap-2">{online ? <Wifi className="h-4 w-4 text-success" /> : <WifiOff className="h-4 w-4 text-warning" />}
      <span>{!online ? 'OFFLINE · Saved views only · Changes unavailable' : syncing ? 'SYNCING' : failed ? 'SYNC FAILED' : 'ONLINE'}{savedAt && ` · Saved ${new Date(savedAt).toLocaleTimeString()}`}</span>
    </div>
    <Button variant="ghost" size="sm" disabled={!online || syncing} onClick={sync}><RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />Sync now</Button>
  </div>;
}