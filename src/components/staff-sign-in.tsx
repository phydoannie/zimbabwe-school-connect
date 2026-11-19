import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { usernameEmail } from '@/lib/accounts';
import { subscriptionAllowsAccess } from '@/lib/subscriptions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function StaffSignIn({ schoolCode = '', schoolName }: { schoolCode?: string; schoolName?: string }) {
  const nav = useNavigate();
  const [code, setCode] = useState(schoolCode);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [owner, setOwner] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      const signed = await supabase.auth.signInWithPassword({ email: usernameEmail(username), password });
      if (signed.error) throw signed.error;
      const platform = await supabase.rpc('is_super_admin');
      if (platform.error) throw platform.error;
      if (platform.data) { await nav({ to: '/super-admin' }); return; }
      if (owner) { await supabase.auth.signOut(); throw new Error('Only the platform owner can sign in here.'); }
      const result = await supabase.from('school_members').select('school_id,status,schools!inner(code)').eq('user_id', signed.data.user.id).eq('schools.code', code.trim().toUpperCase());
      if (result.error) throw result.error;
      const member = result.data.find(m => m.status === 'active');
      if (!member) { await supabase.auth.signOut(); throw new Error('Wrong school code or no active membership.'); }
      const subscription = await supabase.from('school_subscriptions').select('*').eq('school_id', member.school_id).maybeSingle();
      if (subscription.error) throw subscription.error;
      if (!subscriptionAllowsAccess(subscription.data)) { await supabase.auth.signOut(); throw new Error('School access is suspended or expired. Contact the SchoolSys administrator.'); }
      localStorage.setItem('schoolsys.currentSchool', member.school_id);
      await nav({ to: '/app' });
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Sign in failed'); }
    finally { setBusy(false); }
  }
  return <main className="flex min-h-screen flex-col bg-hero"><div className="zim-stripe h-1.5"/><div className="flex flex-1 items-center justify-center p-4"><div className="w-full max-w-sm rounded-lg bg-card p-6 shadow-card"><Link to="/" className="font-display text-lg font-bold">SchoolSys <span className="text-primary">Pro</span></Link><h1 className="mt-4 break-words text-2xl font-bold">{owner ? 'Platform owner sign in' : schoolName ?? 'Staff sign in'}</h1><form onSubmit={submit} className="mt-5 space-y-3">{!owner && <div><Label htmlFor="code">School code</Label><Input id="code" required readOnly={!!schoolCode} value={code} onChange={e=>setCode(e.target.value)} className="h-11 uppercase"/></div>}<div><Label htmlFor="username">Username</Label><Input id="username" required autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} className="h-11"/></div><div><Label htmlFor="password">Password</Label><Input id="password" required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} className="h-11"/></div><Button disabled={busy} type="submit" className="h-11 w-full">{busy ? 'Signing in…' : 'Sign in'}</Button></form>{!schoolCode && <Button variant="link" className="mt-3 w-full" onClick={()=>setOwner(!owner)}>{owner ? 'Staff sign in' : 'Platform owner sign in'}</Button>}</div></div></main>;
}