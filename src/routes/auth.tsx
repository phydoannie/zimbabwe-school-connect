import { createFileRoute } from "@tanstack/react-router";
import { StaffSignIn } from '@/components/staff-sign-in';
import { pageHead } from '@/lib/metadata';

export const Route = createFileRoute("/auth")({
  head: () => pageHead('Staff sign in', 'Sign in to SchoolSys Pro with your assigned staff username.'),
  component: StaffSignIn,
});

