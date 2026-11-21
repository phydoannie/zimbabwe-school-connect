import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentSchool } from '@/lib/school-context';
import { validReceiptStart } from '@/lib/receipt-settings';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';

export function ReceiptSettings() {
  const { school, can } = useCurrentSchool();
  const query = useQuery({ queryKey: ['receipt-settings', school.id], queryFn: async () => {
    const result = await supabase.from('school_receipt_settings').select('*').eq('school_id', school.id).maybeSingle();
    if (result.error) throw result.error;
    return result.data ?? { automatic_numbering: false, next_number: 1 };
  } });
  if (query.isError) return <p className="text-sm text-destructive">Receipt settings could not be loaded.</p>;
  if (!query.data) return null;
  return <ReceiptNumberForm key={`${school.id}:${query.data.automatic_numbering}:${query.data.next_number}`} schoolId={school.id} editable={can('settings')} initial={query.data} />;
}

function ReceiptNumberForm({ schoolId, editable, initial }: { schoolId: string; editable: boolean; initial: { automatic_numbering: boolean; next_number: number } }) {
  const [enabled, setEnabled] = useState(initial.automatic_numbering);
  const [next, setNext] = useState(String(initial.next_number));
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  return <section className="mb-8 space-y-4 border-t pt-6">
    <h2 className="text-xl font-semibold">Receipt numbering</h2>
    <form className="space-y-4" onSubmit={async (event) => {
      event.preventDefault();
      if (!validReceiptStart(Number(next))) { toast.error('Enter a whole receipt number from 1 to 2147483646'); return; }
      setBusy(true);
      try {
        const result = await supabase.rpc('save_receipt_settings', { _school: schoolId, _enabled: enabled, _next: Number(next) });
        if (result.error) throw result.error;
        await qc.invalidateQueries({ queryKey: ['receipt-settings', schoolId] });
        toast.success('Receipt numbering saved');
      } catch (error) { toast.error(error instanceof Error ? error.message : 'Receipt settings could not be saved'); }
      finally { setBusy(false); }
    }}>
      <div className="flex items-center gap-3"><Switch id="automatic_numbering" checked={enabled} onCheckedChange={setEnabled} disabled={!editable || busy} /><Label htmlFor="automatic_numbering">Use my school’s receipt numbers</Label></div>
      <div className="max-w-xs"><Label htmlFor="next_receipt_number">Next official receipt number</Label><Input id="next_receipt_number" type="number" min="1" max="2147483646" step="1" required value={next} disabled={!editable || busy || !enabled} onChange={(event) => setNext(event.target.value)} /></div>
      <p className="text-sm text-muted-foreground">{enabled ? 'Used numbers are skipped. Offline receipts get official numbers when synced.' : 'SchoolSys receipt numbers remain active. Existing receipts do not change.'}</p>
      {editable && <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save receipt numbering'}</Button>}
    </form>
  </section>;
}