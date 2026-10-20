import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Empty } from "@/components/page";

export const Route = createFileRoute("/_authenticated/app/attendance")({
  head: () => ({ meta: [{ title: "Attendance — SchoolSys Pro" }] }),
  component: () => (
    <>
      <PageHeader title="Attendance" />
      <Empty>This section is coming next.</Empty>
    </>
  ),
});
