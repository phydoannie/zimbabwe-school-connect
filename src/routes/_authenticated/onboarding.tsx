import { createFileRoute, Link } from '@tanstack/react-router';
import { pageHead } from '@/lib/metadata';
import { Button } from '@/components/ui/button';
export const Route = createFileRoute('/_authenticated/onboarding')({head:()=>pageHead('School access','SchoolSys Pro school membership and registration.'),component:Onboarding});
function Onboarding(){return <main className="mx-auto max-w-lg space-y-4 p-8"><h1 className="text-2xl font-bold">No school assigned</h1><p>Contact your school administrator for an assigned account and school code.</p><Button asChild><Link to="/auth">Back to sign in</Link></Button></main>;}
