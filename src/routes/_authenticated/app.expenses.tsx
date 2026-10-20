import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Empty } from "@/components/page";

export const Route = createFileRoute("/_authenticated/app/expenses")({
  head: () => ({ meta: [{ title: "Expenses — SchoolSys Pro" }] }),
  component: () => (
    <>
      <PageHeader title="Expenses" />
      <Empty>This section is coming next.</Empty>
    </>
  ),
});
