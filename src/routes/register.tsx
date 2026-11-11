import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { usernameEmail } from "@/lib/accounts";
import { registerSchoolAccount } from "@/lib/register.functions";
import { pageHead } from "@/lib/metadata";
import { CURRENCIES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/register")({
  head: () => pageHead("Register your school", "Register a new school on SchoolSys Pro and get a unique school code for your staff."),
  component: RegisterPage,
});

function RegisterPage() {
  const nav = useNavigate();
  const register = useServerFn(registerSchoolAccount);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const username = String(f.get("username"));
    const password = String(f.get("password"));
    if (password !== String(f.get("confirm"))) { toast.error("Passwords do not match"); return; }
    setBusy(true);
    try {
      await register({ data: { username, password } });
      const { error: se } = await supabase.auth.signInWithPassword({ email: usernameEmail(username), password });
      if (se) throw se;
      const { data: id, error } = await supabase.rpc("create_school", {
        _name: String(f.get("name")), _address: String(f.get("address") || ""), _phone: String(f.get("phone") || ""),
        _email: String(f.get("email") || ""), _currency: String(f.get("currency")), _year: Number(f.get("year")),
        _term: Number(f.get("term")), _full_name: String(f.get("full_name")),
      });
      if (error) throw error;
      const { data: s } = await supabase.from("schools").select("code").eq("id", id as string).single();
      localStorage.setItem("schoolsys.currentSchool", id as string);
      setCode(s?.code ?? "");
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusy(false); }
  }

  const sel = "h-11 w-full rounded-md border border-input bg-background px-3 text-sm";
  return (
    <div className="flex min-h-screen flex-col bg-hero">
      <div className="zim-stripe h-1.5" />
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-2xl bg-card p-6 shadow-card">
          <Link to="/" className="font-display text-lg font-bold">SchoolSys<span className="text-primary"> Pro</span></Link>
          {code ? (
            <div className="mt-4 space-y-4">
              <h1 className="text-2xl font-bold">School registered</h1>
              <p className="text-muted-foreground">Your school code is below. Staff will need it, with their username and password, to sign in.</p>
              <div className="rounded-xl border-2 border-dashed border-primary p-4 text-center font-mono text-3xl font-bold tracking-widest">{code}</div>
              <Button className="h-11 w-full" onClick={() => nav({ to: "/app" })}>Open my school</Button>
            </div>
          ) : (
            <>
              <h1 className="mt-4 text-2xl font-bold">Register your school</h1>
              <p className="text-sm text-muted-foreground">You'll be the School Head and get a unique school code.</p>
              <form onSubmit={submit} className="mt-5 space-y-3">
                <div><Label>School name</Label><Input name="name" required placeholder="e.g. Mabvuku High School" className="h-11" /></div>
                <div><Label>Address</Label><Input name="address" className="h-11" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Phone</Label><Input name="phone" placeholder="+263…" className="h-11" /></div>
                  <div><Label>School email (optional)</Label><Input name="email" type="email" className="h-11" /></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Currency</Label><select name="currency" className={sel}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></div>
                  <div><Label>Year</Label><Input name="year" type="number" defaultValue={new Date().getFullYear()} className="h-11" /></div>
                  <div><Label>Term</Label><select name="term" className={sel}><option>1</option><option>2</option><option>3</option></select></div>
                </div>
                <hr />
                <div><Label>Your full name</Label><Input name="full_name" required className="h-11" /></div>
                <div><Label>Choose a username</Label><Input name="username" required autoComplete="username" className="h-11" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Password</Label><Input name="password" type="password" minLength={8} required autoComplete="new-password" className="h-11" /></div>
                  <div><Label>Confirm password</Label><Input name="confirm" type="password" minLength={8} required autoComplete="new-password" className="h-11" /></div>
                </div>
                <Button disabled={busy} className="h-11 w-full">{busy ? "Registering…" : "Register school"}</Button>
                <p className="text-center text-sm">Already registered? <Link to="/auth" className="text-primary underline">Sign in</Link></p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
