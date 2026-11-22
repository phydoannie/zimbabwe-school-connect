import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { registerOfflineApp } from '@/lib/pwa';
import { restoreOfflineViews, saveOfflineViews, saveOfflineAccess } from '@/lib/offline-cache';
import type { Membership } from '@/lib/school-context';
import { listPayments, prepareCollection, readCollectionPack, syncPayments } from '@/lib/offline-payments';
import { listEntries, syncEntries } from '@/lib/offline-entries';

export function OfflineStatus({ userId, schoolId, canCollect, onConnectionChange }: { userId: string; schoolId: string; canCollect: boolean; onConnectionChange: (online: boolean) => void }) {
  const client = useQueryClient();
  const [online, setOnline] = useState(true);
  const [savedAt, setSavedAt] = useState<number>();
  const [syncing, setSyncing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(0);
  const [ready, setReady] = useState(false);
  async function verifyAccess() {
    const { data, error } = await supabase.auth.getUser();
    if (error || data.user?.id !== userId) throw new Error('Sign in again to sync');
    const result = await supabase.from('school_members').select('school_id, role, status, full_name, schools(*)').eq('user_id', userId);
    if (result.error) throw result.error;
    const subscriptions = await supabase.from('school_subscriptions').select('*');
    if (subscriptions.error) throw subscriptions.error;
    const memberships: Membership[] = (result.data ?? []).map(m => ({ ...m, subscription: subscriptions.data.find(s => s.school_id === m.school_id) ?? null }));
    await saveOfflineAccess(data.user, memberships);
    client.setQueryData(['memberships', userId], memberships);
  }

  useEffect(() => {
    let disposed = false;
    let working = false;
    async function counts() {
      const payments = await listPayments(userId, schoolId);
      const pack = await readCollectionPack(userId, schoolId);
      const entries = await listEntries(userId, schoolId);
      if (!disposed) { setPending(payments.filter((p) => p.status === 'pending').length + entries.filter(e => e.status === 'pending').length); setReady(!!pack); }
    }
    async function refreshCollections() {
      if (!navigator.onLine || working) return;
      working = true;
      try {
        await verifyAccess();
        await syncEntries(userId, schoolId);
        if (canCollect) await syncPayments(userId, schoolId);
        await prepareCollection(userId, schoolId);
        const pack = await readCollectionPack(userId, schoolId);
        if (!disposed) setSavedAt(pack?.savedAt);
        if (!disposed) setFailed(false);
        await client.invalidateQueries();
        await saveOfflineViews(client, userId);
      } catch { if (!disposed) setFailed(true); }
      finally { working = false; await counts(); }
    }
    const changed = () => { void counts(); };
    const refresh = () => { void refreshCollections(); };
    void counts(); void refreshCollections();
    window.addEventListener('collections-changed', changed);
    window.addEventListener('online', refresh);
    const retry = setInterval(refresh, 60000);
    return () => { disposed = true; clearInterval(retry); window.removeEventListener('collections-changed', changed); window.removeEventListener('online', refresh); };
  }, [userId, schoolId, canCollect, client]);

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
      await verifyAccess();
      await syncEntries(userId, schoolId);
      if (canCollect) {
        await syncPayments(userId, schoolId);
      }
      await prepareCollection(userId, schoolId);
      if ('storage' in navigator && navigator.storage.persist) await navigator.storage.persist();
      await client.invalidateQueries();
      if (client.getQueryCache().getAll().some((q) => q.isActive() && q.state.status === 'error')) throw new Error('Refresh failed');
      const { data } = await supabase.auth.getSession();
      if (data.session?.user.id === userId && data.session.expires_at) setSavedAt(await saveOfflineViews(client, userId, data.session.expires_at));
    } catch { setFailed(true); } finally { setSyncing(false); }
  }

  return <div role="status" className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted px-4 py-2 text-xs md:px-8">
    <div className="flex items-center gap-2">{online ? <Wifi className="h-4 w-4 text-success" /> : <WifiOff className="h-4 w-4 text-warning" />}
      <span>{!online ? (canCollect && ready ? 'OFFLINE · Cash collection available' : 'OFFLINE · Saved records') : syncing ? 'SYNCING' : failed ? 'SYNC FAILED · Retry sync' : 'ONLINE'} · {ready ? 'School records saved' : 'Saving school records…'}{pending > 0 && ` · ${pending} entries pending`}{savedAt && ` · Saved ${new Date(savedAt).toLocaleString()}`} · Online sign-in required every 7 days</span>
    </div>
    <Button variant="ghost" size="sm" disabled={!online || syncing} onClick={sync}><RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />Sync now</Button>
  </div>;
}