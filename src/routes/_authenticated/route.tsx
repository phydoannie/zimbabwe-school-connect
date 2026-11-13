import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SchoolProvider } from "@/lib/school-context";
import { restoreOfflineViews } from '@/lib/offline-cache';

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ context }) => {
    if (!navigator.onLine) {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session?.expires_at || session.expires_at * 1000 <= Date.now()) throw redirect({ to: '/auth' });
      const restored = await restoreOfflineViews(context.queryClient, session.user.id).catch(() => null);
      const memberships = context.queryClient.getQueryData<{ status: string }[]>(['memberships', session.user.id]);
      if (!restored || !memberships?.some((m) => m.status === 'active')) throw redirect({ to: '/auth' });
      return { user: session.user };
    }
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
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
