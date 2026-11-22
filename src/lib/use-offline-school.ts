import { useEffect, useState } from 'react';
import { useCurrentSchool } from './school-context';
import { applyPending, listPayments, readCollectionPack, type CollectionPack } from './offline-payments';
import { listEntries, type OfflineEntry } from './offline-entries';

export function useOfflineSchool() {
  const { userId, school } = useCurrentSchool();
  const [online, setOnline] = useState(true);
  const [pack, setPack] = useState<CollectionPack | null>(null);
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<OfflineEntry[]>([]);
  useEffect(() => {
    let disposed = false;
    const load = async () => {
      setOnline(navigator.onLine);
      try {
        const saved = await readCollectionPack(userId, school.id);
        const payments = await listPayments(userId, school.id);
        const mutations = await listEntries(userId, school.id);
        if (!disposed) setEntries(mutations);
        const pending = payments.filter((p) => !saved?.syncedReferences?.includes(p.id));
        if (!disposed) setPack(saved ? { ...saved, balances: saved.students.flatMap((s) => applyPending(saved.balances, pending, s.id)) } : null);
      } finally { if (!disposed) setLoading(false); }
    };
    const changed = () => { void load().catch(() => { if (!disposed) setPack(null); }); };
    changed();
    const timer = setInterval(changed, 30000);
    window.addEventListener('online', changed); window.addEventListener('offline', changed); window.addEventListener('collections-changed', changed);
    return () => { disposed = true; clearInterval(timer); window.removeEventListener('online', changed); window.removeEventListener('offline', changed); window.removeEventListener('collections-changed', changed); };
  }, [userId, school.id]);
  return { online, pack, loading, entries };
}

export function overallDebts(balances: CollectionPack['balances']) {
  const rows = new Map<string, CollectionPack['balances'][number]>();
  for (const b of balances) {
    const existing = rows.get(b.student_id);
    rows.set(b.student_id, { ...b, due: Number(existing?.due ?? 0) + Number(b.due), paid: Number(existing?.paid ?? 0) + Number(b.paid), balance: Number(existing?.balance ?? 0) + Number(b.balance) });
  }
  return [...rows.values()];
}