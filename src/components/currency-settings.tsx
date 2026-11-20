import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentSchool } from '@/lib/school-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function useSchoolCurrencies(schoolId: string) {
  return useQuery({ queryKey: ['currencies', schoolId], queryFn: async () => {
    const r = await supabase.from('school_currencies').select('*').eq('school_id', schoolId).order('code');
    if (r.error) throw r.error; return r.data;
  } });
}

export function CurrencySettings() {
  const { school, can } = useCurrentSchool();
  const qc = useQueryClient();
  const list = useSchoolCurrencies(school.id);
  const [code, setCode] = useState(''); const [rate, setRate] = useState('');
  const edit = can('settings');
  async function save(c: string, r: number) {
    if (!c.trim() || !(r > 0)) { toast.error('Enter a currency and a rate above 0'); return; }
    const res = await supabase.from('school_currencies').upsert({ school_id: school.id, code: c.trim().toUpperCase(), rate: r, updated_at: new Date().toISOString() }, { onConflict: 'school_id,code' });
    if (res.error) { toast.error(res.error.message); return; }
    setCode(''); setRate(''); toast.success('Rate saved'); void qc.invalidateQueries({ queryKey: ['currencies', school.id] });
  }
  async function remove(id: string) {
    const res = await supabase.from('school_currencies').delete().eq('id', id);
    if (res.error) toast.error(res.error.message); else void qc.invalidateQueries({ queryKey: ['currencies', school.id] });
  }
  return <section className="mb-8 space-y-3">
    <h2 className="text-xl font-semibold">Other currencies</h2>
    <p className="text-sm text-muted-foreground">Main currency: <b>{school.currency}</b>. Add other currencies parents pay in, with your rate (how much of that currency equals 1 {school.currency}). Leave empty if you only use {school.currency}.</p>
    <ul className="space-y-2">{(list.data ?? []).map(c => <li key={c.id} className="flex items-center justify-between rounded-md border p-2 text-sm"><span>1 {school.currency} = <b>{Number(c.rate)} {c.code}</b></span>{edit && <span className="flex gap-2"><Button size="sm" variant="outline" onClick={() => { const v = prompt(`New rate for ${c.code}`, String(c.rate)); if (v) void save(c.code, Number(v)); }}>Change rate</Button><Button size="sm" variant="ghost" onClick={() => remove(c.id)}>Remove</Button></span>}</li>)}</ul>
    {edit && <div className="flex flex-wrap items-end gap-2"><div><Label htmlFor="cur-code">Currency</Label><Input id="cur-code" placeholder="ZAR" value={code} onChange={e => setCode(e.target.value)} className="w-28 uppercase" /></div><div><Label htmlFor="cur-rate">Rate per 1 {school.currency}</Label><Input id="cur-rate" type="number" step="any" min="0" placeholder="18.50" value={rate} onChange={e => setRate(e.target.value)} className="w-36" /></div><Button onClick={() => save(code, Number(rate))}>Add currency</Button></div>}
  </section>;
}
