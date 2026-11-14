import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Card, selectCls } from "@/components/page";
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentSchool } from '@/lib/school-context';
import { CURRENCIES } from '@/lib/constants';
import { pageHead } from '@/lib/metadata';
import { StaffSettings } from '@/components/staff-settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const Route = createFileRoute("/_authenticated/app/settings")({
  head: () => pageHead('Settings', 'School profile, academic term and staff account settings.'),
  component: Settings,
});

function Settings() {
  const { school, can } = useCurrentSchool();
  const qc = useQueryClient(); const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget); setBusy(true);
    try {
      const result = await supabase.from('schools').update({ name: String(f.get('name')).trim(), address: String(f.get('address')), phone: String(f.get('phone')), email: String(f.get('email')), slogan: String(f.get('slogan')), bank_details: String(f.get('bank_details')), logo_url: String(f.get('logo_url')) || null, currency: String(f.get('currency')), billing_cycle: String(f.get('billing_cycle')), current_year: Number(f.get('year')), current_term: Number(f.get('term')) }).eq('id', school.id).select('id');
      if (result.error) throw result.error; if (!result.data?.length) throw new Error('Settings could not be saved');
      await qc.invalidateQueries(); toast.success('School settings saved');
    } catch(e) { toast.error(e instanceof Error ? e.message : 'Settings could not be saved'); } finally { setBusy(false); }
  }
  const fields = [['name','School name'],['address','Address'],['phone','Phone'],['email','School email'],['slogan','Slogan'],['bank_details','Bank details'],['logo_url','School logo URL']] as const;
  return <><PageHeader title="Settings" sub={school.code} />
    <form key={school.id} onSubmit={save} className="mb-8 space-y-5">
      <h2 className="text-xl font-semibold">School profile</h2>
      {school.logo_url && <img src={school.logo_url} alt={`${school.name} logo`} className="h-20 w-20 object-contain" />}
      <fieldset disabled={!can('settings') || busy} className="grid gap-4 sm:grid-cols-2">
        {fields.map(([key,label]) => <div key={key}><Label htmlFor={key}>{label}</Label><Input id={key} name={key} defaultValue={school[key] ?? ''} required={key === 'name'} type={key === 'email' ? 'email' : key === 'logo_url' ? 'url' : 'text'} /></div>)}
        <div><Label htmlFor="currency">Currency</Label><select id="currency" name="currency" defaultValue={school.currency} className={selectCls}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select></div>
        <div><Label htmlFor="billing_cycle">Billing cycle</Label><select id="billing_cycle" name="billing_cycle" defaultValue={school.billing_cycle} className={selectCls}><option value="termly">Termly (government / council schools)</option><option value="monthly">Monthly (private schools & colleges)</option></select></div>
        <div><Label htmlFor="year">Academic year</Label><Input id="year" name="year" type="number" min={2000} max={2100} required defaultValue={school.current_year} /></div>
        <div><Label htmlFor="term">Term</Label><select id="term" name="term" defaultValue={school.current_term} className={selectCls}>{[1,2,3].map(t => <option key={t}>{t}</option>)}</select></div>
      </fieldset>
      {can('settings') && <Button disabled={busy} type="submit">Save school settings</Button>}
    </form>
    {can('users') && <StaffSettings />}
  </>;
}
