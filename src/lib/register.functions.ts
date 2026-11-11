import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { normalizeUsername, usernameEmail } from './accounts';

// Public: creates only the first (head) account for a brand-new school. The school
// itself is created afterwards by that signed-in user via create_school, which
// makes them head of that school only; no access to other schools is granted.
export const registerSchoolAccount = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => z.object({ username: z.string(), password: z.string().min(8).max(72) }).parse(input))
  .handler(async ({ data }) => {
    const username = normalizeUsername(data.username);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const exists = await supabaseAdmin.from('profiles').select('id').eq('username', username).maybeSingle();
    if (exists.data) throw new Error('That username is already taken. Choose another.');
    const res = await supabaseAdmin.auth.admin.createUser({ email: usernameEmail(username), password: data.password, email_confirm: true });
    if (res.error) throw new Error(res.error.message.includes('already') ? 'That username is already taken. Choose another.' : res.error.message);
    return { success: true };
  });
