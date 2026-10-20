import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Empty } from "@/components/page";

export const Route = createFileRoute("/_authenticated/app/reports")({
  head: () => ({ meta: [{ title: "Reports — SchoolSys Pro" }] }),
  component: () => (
    <>
      <PageHeader title="Reports" />
      <Empty>This section is coming next.</Empty>
    </>
  ),
});
