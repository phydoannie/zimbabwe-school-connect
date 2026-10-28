import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usernameEmail } from "@/lib/accounts";
import { pageHead } from "@/lib/metadata";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => pageHead("Sign in or register — SchoolSys Pro", "Register your school or sign in to SchoolSys Pro."),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "register") {
        if (password.length < 8) throw new Error("Use a password with at least 8 characters.");
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        if (data.session) {
          toast.success("Account created. Now register your school.");
          nav({ to: "/onboarding" });
        } else {
          toast.success("Account created. Check your email to confirm it, then sign in.");
          setMode("signin");
          setUsername(email.trim());
        }
      } else {
        const identity = username.trim();
        const loginEmail = identity.includes("@") ? identity : usernameEmail(identity);
        const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
        if (error) throw error;
        nav({ to: "/app" });
      }
    } catch (err) {
      toast.error((err as Error).message || "Unable to continue.");
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
          <h1 className="mt-4 text-2xl font-bold">{mode === "signin" ? "Staff sign in" : "Create your account"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{mode === "signin" ? "Use your staff username or account email." : "Create an account first, then register your school."}</p>
          <form onSubmit={submit} className="mt-5 space-y-3">
            {mode === "signin" ? (
              <div><Label htmlFor="identity">Username or email</Label><Input id="identity" autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} className="h-11" /></div>
            ) : (
              <div><Label htmlFor="email">Email address</Label><Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" /></div>
            )}
            <div><Label htmlFor="password">Password</Label><Input id="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={mode === "register" ? 8 : undefined} required value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" /></div>
            <Button type="submit" disabled={busy} className="h-11 w-full">{busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}</Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "New to SchoolSys? " : "Already have an account? "}
            <button type="button" className="font-semibold text-primary underline-offset-4 hover:underline" onClick={() => setMode(mode === "signin" ? "register" : "signin")}>
              {mode === "signin" ? "Create account" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
