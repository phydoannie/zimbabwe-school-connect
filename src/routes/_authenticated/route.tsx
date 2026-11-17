import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SchoolProvider } from "@/lib/school-context";
import { readOfflineAccess, restoreOfflineViews, saveOfflineAccess } from '@/lib/offline-cache';

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ context }) => {
    if (!navigator.onLine) {
      const access = await readOfflineAccess().catch(() => null);
      if (!access) throw redirect({ to: '/auth' });
      await restoreOfflineViews(context.queryClient, access.userId);
      return { user: access.user };
    }
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const result = await supabase.from('school_members').select('school_id, role, status, full_name, schools(*)').eq('user_id', data.user.id);
    if (result.error) throw result.error;
    const memberships = result.data ?? [];
    context.queryClient.setQueryData(['memberships', data.user.id], memberships);
    if (memberships.some((m) => m.status === 'active' && m.schools)) await saveOfflineAccess(data.user, memberships);
    await restoreOfflineViews(context.queryClient, data.user.id).catch(() => null);
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
