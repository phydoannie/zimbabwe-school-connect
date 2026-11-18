import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { normalizeUsername, usernameEmail } from './accounts';

export const platformDirectory = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const check = await context.supabase.rpc('is_super_admin');
  if (check.error || !check.data) throw new Error('Only the platform owner can open this page.');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const schools = await supabaseAdmin.from('schools').select('id,name,code,currency,created_at,school_subscriptions(*)').order('name');
  if (schools.error) throw new Error('School directory could not be loaded.');
  return schools.data;
});

export const provisionSchool = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ name: z.string().trim().min(1).max(150), slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(80), username: z.string(), password: z.string().min(8).max(72), endsAt: z.string().datetime(), currency: z.enum(['USD','ZiG','ZAR']) }).parse(input))
  .handler(async ({ context, data }) => {
    const check = await context.supabase.rpc('is_super_admin');
    if (check.error || !check.data) throw new Error('Only the platform owner can register schools.');
    if (Date.parse(data.endsAt) <= Date.now()) throw new Error('Choose a future subscription end date.');
    const username = normalizeUsername(data.username);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const account = await supabaseAdmin.auth.admin.createUser({ email: usernameEmail(username), password: data.password, email_confirm: true });
    if (account.error || !account.data.user) throw new Error('Username is unavailable or account could not be created.');
    const id = account.data.user.id;
    const result = await supabaseAdmin.rpc('provision_managed_school', { _name: data.name, _username: username, _admin: id, _slug: data.slug, _ends: data.endsAt, _currency: data.currency });
    if (result.error) {
      const cleanup = await supabaseAdmin.auth.admin.deleteUser(id);
      if (cleanup.error) throw new Error('School setup failed; the unused account needs administrator cleanup.');
      throw new Error('School setup failed. Check that the school link is unique.');
    }
    return { schoolId: result.data };
  });

export const changeOwnerCredentials = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ username: z.string(), currentPassword: z.string(), password: z.string().min(8).max(72) }).parse(input))
  .handler(async ({ data, context }) => {
    const check = await context.supabase.rpc('is_super_admin');
    if (check.error || !check.data) throw new Error('Not permitted.');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const current = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const email = current.data.user?.email;
    if (!email) throw new Error('Account not found.');
    const { createClient } = await import('@supabase/supabase-js');
    const key = process.env['SUPABASE_PUBLISHABLE_KEY']!;
    const verifier = createClient(process.env['SUPABASE_URL']!, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const verified = await verifier.auth.signInWithPassword({ email, password: data.currentPassword });
    if (verified.error) throw new Error('Current password is incorrect.');
    await verifier.auth.signOut();
    const username = normalizeUsername(data.username);
    const result = await supabaseAdmin.auth.admin.updateUserById(context.userId, { email: usernameEmail(username), email_confirm: true, password: data.password });
    if (result.error) throw new Error('Credentials could not be updated; choose a unique username.');
    const profile = await supabaseAdmin.from('profiles').upsert({ id: context.userId, username });
    if (profile.error) throw new Error('Credentials changed but username display could not be refreshed.');
    return { success: true };
  });