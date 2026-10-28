import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { normalizeUsername, usernameEmail, STAFF_ROLES } from './accounts';

const staffInput = z.object({ schoolId: z.string().uuid(), username: z.string(), password: z.string().min(8), role: z.enum(STAFF_ROLES) });
export const createStaff = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => staffInput.parse(input)).handler(async ({ data, context }) => {
    const { data: allowed, error } = await context.supabase.rpc('has_perm', { _school: data.schoolId, _perm: 'users' });
    if (error || !allowed) throw new Error('Only account managers can create staff accounts.');
    const username = normalizeUsername(data.username);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const result = await supabaseAdmin.auth.admin.createUser({ email: usernameEmail(username), password: data.password, email_confirm: true });
    if (result.error || !result.data.user) throw new Error(result.error?.message ?? 'Account could not be created.');
    const userId = result.data.user.id;
    const member = await supabaseAdmin.from('school_members').insert({ school_id: data.schoolId, user_id: userId, role: data.role, full_name: username, status: 'active' });
    if (member.error) { await supabaseAdmin.auth.admin.deleteUser(userId); throw new Error(member.error.message); }
    await supabaseAdmin.from('audit_logs').insert({ school_id: data.schoolId, user_id: context.userId, action: 'staff.created', record_type: 'school_members', details: { username, role: data.role } });
    return { success: true };
  });

export const changeCredentials = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ schoolId: z.string().uuid(), userId: z.string().uuid(), username: z.string().optional(), password: z.string().min(8).optional(), currentPassword: z.string().optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: allowed } = await context.supabase.rpc('has_perm', { _school: data.schoolId, _perm: 'users' });
    if (!allowed) throw new Error('Only account managers can change credentials.');
    const { data: member } = await context.supabase.from('school_members').select('user_id,role').eq('school_id', data.schoolId).eq('user_id', data.userId).maybeSingle();
    if (!member) throw new Error('Account not found in this school.');
    if (!data.password && !data.username) throw new Error('Enter a new username or password.');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    // A shared account must not be changed by an administrator of only one school.
    const memberships = await supabaseAdmin.from('school_members').select('school_id').eq('user_id', data.userId);
    for (const m of memberships.data ?? []) {
      const check = await context.supabase.rpc('has_perm', { _school: m.school_id, _perm: 'users' });
      if (!check.data) throw new Error('This account belongs to another school; its credentials cannot be changed here.');
    }
    if (data.userId === context.userId) {
      const current = await supabaseAdmin.auth.admin.getUserById(context.userId);
      if (!current.data.user?.email || !data.currentPassword) throw new Error('Current password is required.');
      const { createClient } = await import('@supabase/supabase-js');
      const verifier = createClient(process.env['SUPABASE_URL']!, process.env['SUPABASE_PUBLISHABLE_KEY']!, { auth: { persistSession: false, autoRefreshToken: false } });
      const verified = await verifier.auth.signInWithPassword({ email: current.data.user.email, password: data.currentPassword });
      if (verified.error) throw new Error('Current password is incorrect.');
      await verifier.auth.signOut();
    }
    const username = data.username ? normalizeUsername(data.username) : undefined;
    if (username) {
      const duplicate = await supabaseAdmin.from('profiles').select('id').eq('username', username).neq('id', data.userId).maybeSingle();
      if (duplicate.data) throw new Error('That username is already taken.');
    }
    const result = await supabaseAdmin.auth.admin.updateUserById(data.userId, { ...(username ? { email: usernameEmail(username), email_confirm: true } : {}), ...(data.password ? { password: data.password } : {}) });
    if (result.error) throw new Error(result.error.message);
    if (username) {
      const profile = await supabaseAdmin.from('profiles').upsert({ id: data.userId, username });
      if (profile.error) throw new Error(profile.error.message);
    }
    await supabaseAdmin.from('audit_logs').insert({ school_id: data.schoolId, user_id: context.userId, action: 'staff.credentials_changed', record_id: data.userId });
    return { success: true };
  });