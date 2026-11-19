import { createFileRoute, Link } from '@tanstack/react-router';
import { pageHead } from '@/lib/metadata';
import { Button } from '@/components/ui/button';
export const Route = createFileRoute('/register')({ head: () => pageHead('School registration', 'SchoolSys Pro school accounts are registered by the platform administrator.'), component: Registration });
function Registration() { return <main className="mx-auto max-w-lg space-y-5 px-5 py-16"><h1 className="text-3xl font-bold">School registration</h1><p className="text-muted-foreground">Contact the SchoolSys administrator to register your school and receive your school code and administrator login.</p><Button asChild><Link to="/auth">Staff sign in</Link></Button></main>; }
