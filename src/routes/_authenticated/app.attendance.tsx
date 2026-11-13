import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Empty } from "@/components/page";
import { pageHead } from '@/lib/metadata';

export const Route = createFileRoute("/_authenticated/app/attendance")({
  head: () => pageHead('Attendance', 'Staff attendance register for your SchoolSys Pro school.'),
  component: () => (
    <>
      <PageHeader title="Attendance" />
      <Empty>This section is coming next.</Empty>
    </>
  ),
});
