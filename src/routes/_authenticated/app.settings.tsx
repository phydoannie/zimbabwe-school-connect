import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Empty } from "@/components/page";

export const Route = createFileRoute("/_authenticated/app/settings")({
  head: () => ({ meta: [{ title: "Settings — SchoolSys Pro" }] }),
  component: () => (
    <>
      <PageHeader title="Settings" />
      <Empty>This section is coming next.</Empty>
    </>
  ),
});
