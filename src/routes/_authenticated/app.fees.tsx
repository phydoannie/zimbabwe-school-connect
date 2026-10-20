import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Empty } from "@/components/page";

export const Route = createFileRoute("/_authenticated/app/fees")({
  head: () => ({ meta: [{ title: "Fees — SchoolSys Pro" }] }),
  component: () => (
    <>
      <PageHeader title="Fees" />
      <Empty>This section is coming next.</Empty>
    </>
  ),
});
