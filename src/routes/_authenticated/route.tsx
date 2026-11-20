import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SchoolProvider } from "@/lib/school-context";
import { readOfflineAccess, restoreOfflineViews, saveOfflineAccess } from '@/lib/offline-cache';

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ context }) => {
    const offline = async () => {
      const access = await readOfflineAccess().catch(() => null);
      if (!access) throw redirect({ to: '/auth' });
      await restoreOfflineViews(context.queryClient, access.userId).catch(() => null);
      return { user: access.user };
    };
    if (!navigator.onLine) return offline();
    // Weak rural networks: fall back to the saved 7-day device access instead of forcing sign-in.
    const online = await Promise.race([
      supabase.auth.getUser().then((r) => (r.error && !r.data.user && /fetch|network|timeout/i.test(r.error.message) ? null : r)),
      new Promise<null>((res) => setTimeout(() => res(null), 5000)),
    ]).catch(() => null);
    if (!online) return offline();
    const { data } = online;
    if (!data.user) throw redirect({ to: "/auth" });
    const result = await supabase.from('school_members').select('school_id, role, status, full_name, schools(*)').eq('user_id', data.user.id);
    if (result.error) throw result.error;
    const memberships = result.data ?? [];
    const subscriptions = await supabase.from('school_subscriptions').select('*');
    if (subscriptions.error) throw subscriptions.error;
    const verified = memberships.map((m) => ({ ...m, subscription: subscriptions.data.find((s) => s.school_id === m.school_id) ?? null }));
    context.queryClient.setQueryData(['memberships', data.user.id], verified);
    if (verified.some((m) => m.status === 'active' && m.schools && m.subscription?.status === 'active' && Date.parse(m.subscription.subscription_ends_at) > Date.now())) await saveOfflineAccess(data.user, verified);
    await restoreOfflineViews(context.queryClient, data.user.id).catch(() => null);
    context.queryClient.setQueryData(['memberships', data.user.id], verified);
    return { user: data.user };
  },
  component: Layout,
});

function Layout() {
  const { user } = Route.useRouteContext();
  return (
    <SchoolProvider userId={user.id} email={user.email ?? ""}>
      <Outlet />
    </SchoolProvider>
  );
}
