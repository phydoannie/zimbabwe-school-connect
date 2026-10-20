import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set new password — SchoolSys Pro" },
      { name: "description", content: "Choose a new password for SchoolSys Pro." },
      { property: "og:title", content: "Set new password — SchoolSys Pro" },
      { property: "og:description", content: "Choose a new password." },
    ],
  }),
  component: Reset,
});

function Reset() {
  const [pw, setPw] = useState("");
  const nav = useNavigate();
  return (
    <div className="flex min-h-screen items-center justify-center bg-hero p-4">
      <form
        className="w-full max-w-sm space-y-3 rounded-2xl bg-card p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          const { error } = await supabase.auth.updateUser({ password: pw });
          if (error) return toast.error(error.message);
          toast.success("Password updated");
          nav({ to: "/app" });
        }}
      >
        <h1 className="text-xl font-bold">New password</h1>
        <Input type="password" minLength={6} required value={pw} onChange={(e) => setPw(e.target.value)} className="h-11" />
        <Button className="h-11 w-full">Save</Button>
      </form>
    </div>
  );
}
