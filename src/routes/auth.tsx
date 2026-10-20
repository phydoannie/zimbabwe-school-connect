import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — SchoolSys Pro" },
      { name: "description", content: "Sign in or create your SchoolSys Pro account." },
      { property: "og:title", content: "Sign in — SchoolSys Pro" },
      { property: "og:description", content: "Access your school's fees, receipts and records." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"in" | "up" | "forgot">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        nav({ to: "/app" });
      } else if (mode === "up") {
        const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/app" } });
        if (error) throw error;
        toast.success("Check your email to confirm your account.");
        setMode("in");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/reset-password" });
        if (error) throw error;
        toast.success("Password reset link sent.");
        setMode("in");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) return toast.error(r.error.message);
    if (r.redirected) return;
    nav({ to: "/app" });
  }

  return (
    <div className="flex min-h-screen flex-col bg-hero">
      <div className="zim-stripe h-1.5" />
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-card">
          <Link to="/" className="font-display text-lg font-bold">SchoolSys<span className="text-primary"> Pro</span></Link>
          <h1 className="mt-4 text-2xl font-bold">
            {mode === "in" ? "Welcome back" : mode === "up" ? "Create account" : "Reset password"}
          </h1>
          <form onSubmit={submit} className="mt-5 space-y-3">
            <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" /></div>
            {mode !== "forgot" && (
              <div><Label>Password</Label><Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" /></div>
            )}
            <Button type="submit" disabled={busy} className="h-11 w-full">
              {mode === "in" ? "Sign in" : mode === "up" ? "Sign up" : "Send reset link"}
            </Button>
          </form>
          {mode !== "forgot" && (
            <Button variant="outline" className="mt-3 h-11 w-full" onClick={google}>Continue with Google</Button>
          )}
          <div className="mt-4 flex justify-between text-sm">
            <button className="text-primary" onClick={() => setMode(mode === "in" ? "up" : "in")}>
              {mode === "in" ? "Create an account" : "Have an account? Sign in"}
            </button>
            {mode === "in" && <button className="text-muted-foreground" onClick={() => setMode("forgot")}>Forgot?</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
