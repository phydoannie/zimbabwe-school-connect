import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usernameEmail } from '@/lib/accounts';
import { pageHead } from '@/lib/metadata';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => pageHead('Staff sign in', 'Sign in to SchoolSys Pro with your assigned staff username.'),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [code, setCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
        const { error } = await supabase.auth.signInWithPassword({ email: usernameEmail(username), password });
        if (error) throw error;
        const { data: rows } = await supabase.from("school_members").select("school_id, status, schools!inner(code)").eq("schools.code", code.trim().toUpperCase());
        const m = (rows ?? []).find((r) => r.status === "active");
        if (!m) { await supabase.auth.signOut(); throw new Error(rows?.length ? "Your access to this school is awaiting approval." : "Wrong school code, or you are not a member of that school."); }
        localStorage.setItem("schoolsys.currentSchool", m.school_id);
        nav({ to: "/app" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-hero">
      <div className="zim-stripe h-1.5" />
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-card">
          <Link to="/" className="font-display text-lg font-bold">SchoolSys<span className="text-primary"> Pro</span></Link>
          <h1 className="mt-4 text-2xl font-bold">
            Staff sign in
          </h1>
          <form onSubmit={submit} className="mt-5 space-y-3">
            <div><Label htmlFor="code">School code</Label><Input id="code" required placeholder="SCH-XXXXXX" value={code} onChange={(e) => setCode(e.target.value)} className="h-11 uppercase" /></div>
            <div><Label htmlFor="username">Username</Label><Input id="username" autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} className="h-11" /></div>
            <div><Label htmlFor="password">Password</Label><Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" /></div>
            <Button type="submit" disabled={busy} className="h-11 w-full">
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm">New school? <Link to="/register" className="text-primary underline">Register your school</Link></p>
        </div>
      </div>
    </div>
  );
}
