import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentSchool } from '@/lib/school-context';
import { createStaff, changeCredentials } from '@/lib/accounts.functions';
import { STAFF_ROLES } from '@/lib/accounts';
import { ROLE_LABELS } from '@/lib/constants';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { selectCls } from './page';

export function StaffSettings() {
  const { school, userId } = useCurrentSchool();
  const qc = useQueryClient();
  const addStaff = useServerFn(createStaff);
  const credentials = useServerFn(changeCredentials);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(userId);
  const { data: members = [], error } = useQuery({ queryKey: ['staff', school.id], queryFn: async () => {
    const result = await supabase.from('school_members').select('*').eq('school_id', school.id).order('created_at');
    if (result.error) throw result.error;
    const profiles = await supabase.from('profiles').select('id,username');
    if (profiles.error) throw profiles.error;
    return (result.data ?? []).map(m => ({ ...m, username: profiles.data?.find(p => p.id === m.user_id)?.username ?? m.full_name ?? 'Unassigned' }));
  } });
  async function perform(action: () => Promise<unknown>) {
    setBusy(true);
    try { await action(); await qc.invalidateQueries(); toast.success('Account updated'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Account could not be updated'); }
    finally { setBusy(false); }
  }
  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget; const f = new FormData(form);
    await perform(async () => { await addStaff({ data: { schoolId: school.id, username: String(f.get('username')), password: String(f.get('password')), role: f.get('role') as typeof STAFF_ROLES[number] } }); form.reset(); });
  }
  async function update(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget; const f = new FormData(form);
    await perform(async () => { await credentials({ data: { schoolId: school.id, userId: selected, username: String(f.get('username') || '') || undefined, password: String(f.get('password') || '') || undefined, currentPassword: String(f.get('currentPassword') || '') || undefined } }); form.reset(); });
  }
  async function membership(id: string, values: { role?: typeof STAFF_ROLES[number]; status?: string }) {
    await perform(async () => { const r = await supabase.from('school_members').update(values).eq('id', id).eq('school_id', school.id).select('id'); if (r.error) throw r.error; if (!r.data?.length) throw new Error('You cannot change this membership.'); });
  }
  return <section className="space-y-6 border-t pt-6">
    <h2 className="text-xl font-semibold">Staff accounts</h2>
    {error && <p className="text-destructive">Accounts could not be loaded.</p>}
    <div className="divide-y">
      {members.map(m => <div key={m.id} className="flex flex-wrap items-center gap-3 py-3">
        <div className="min-w-0 flex-1 break-words"><div className="font-medium">{m.username}{m.user_id === userId ? ' (you)' : ''}</div><div className="text-sm text-muted-foreground">{m.status}</div></div>
        <select aria-label={`Role for ${m.username}`} disabled={busy || m.user_id === userId || m.role === 'head'} value={m.role} className={`${selectCls} max-w-60`} onChange={e => membership(m.id, { role: e.target.value as typeof STAFF_ROLES[number] })}>
          {m.role === 'head' && <option value="head">School Head</option>}{STAFF_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
        {m.user_id !== userId && m.role !== 'head' && <>
          {m.status !== 'active' && <Button variant="outline" disabled={busy} onClick={() => membership(m.id, { status: 'active' })}>Approve</Button>}
          {m.status !== 'revoked' && <Button variant="outline" disabled={busy} onClick={() => membership(m.id, { status: 'revoked' })}>{m.status === 'pending' ? 'Reject' : 'Revoke'}</Button>}
        </>}
      </div>)}
    </div>
    <div className="grid gap-8 md:grid-cols-2">
      <form onSubmit={create} className="space-y-3"><h3 className="font-semibold">Create staff account</h3>
        <div><Label htmlFor="staffUsername">Username</Label><Input id="staffUsername" name="username" required autoComplete="off" /></div>
        <div><Label htmlFor="staffPassword">Password</Label><Input id="staffPassword" name="password" type="password" required minLength={8} autoComplete="new-password" /></div>
        <div><Label htmlFor="staffRole">Role</Label><select id="staffRole" name="role" className={selectCls} defaultValue="headmaster">{STAFF_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select></div>
        <Button disabled={busy}>Create account</Button>
      </form>
      <form onSubmit={update} className="space-y-3"><h3 className="font-semibold">Change username or password</h3>
        <div><Label htmlFor="credentialAccount">Account</Label><select id="credentialAccount" value={selected} onChange={e => setSelected(e.target.value)} className={selectCls}>{members.map(m => <option key={m.user_id} value={m.user_id}>{m.username}</option>)}</select></div>
        {selected === userId && <div><Label htmlFor="currentPassword">Current password</Label><Input id="currentPassword" name="currentPassword" type="password" required autoComplete="current-password" /></div>}
        <div><Label htmlFor="newUsername">New username</Label><Input id="newUsername" name="username" autoComplete="off" /></div>
        <div><Label htmlFor="newPassword">New password</Label><Input id="newPassword" name="password" type="password" minLength={8} autoComplete="new-password" /></div>
        <Button disabled={busy}>Update credentials</Button>
      </form>
    </div>
  </section>;
}