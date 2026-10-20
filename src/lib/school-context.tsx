import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_PERMS, type Perm } from "./constants";

export type School = {
  id: string; code: string; name: string; address: string | null; phone: string | null; email: string | null;
  slogan: string | null; logo_url: string | null; bank_details: string | null; currency: string;
  current_year: number; current_term: number;
};
export type Membership = { school_id: string; role: string; status: string; full_name: string | null; schools: School | null };

type Ctx = {
  userId: string;
  email: string;
  memberships: Membership[];
  school: School | null;
  role: string | null;
  can: (p: Perm) => boolean;
  switchSchool: (id: string) => void;
  loading: boolean;
};

const SchoolCtx = createContext<Ctx | null>(null);
const KEY = "schoolsys.currentSchool";

export function SchoolProvider({ userId, email, children }: { userId: string; email: string; children: ReactNode }) {
  const qc = useQueryClient();
  const [currentId, setCurrentId] = useState<string | null>(null);
  useEffect(() => setCurrentId(localStorage.getItem(KEY)), []);

  const { data, isLoading } = useQuery({
    queryKey: ["memberships", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_members")
        .select("school_id, role, status, full_name, schools(*)")
        .eq("user_id", userId);
      if (error) throw error;
      return (data ?? []) as unknown as Membership[];
    },
  });

  const memberships = data ?? [];
  const active = memberships.filter((m) => m.status === "active" && m.schools);
  const current = active.find((m) => m.school_id === currentId) ?? active[0] ?? null;

  const value = useMemo<Ctx>(
    () => ({
      userId,
      email,
      memberships,
      school: current?.schools ?? null,
      role: current?.role ?? null,
      can: (p) => !!current && (ROLE_PERMS[current.role] ?? []).includes(p),
      switchSchool: (id) => {
        localStorage.setItem(KEY, id);
        setCurrentId(id);
        qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "memberships" });
      },
      loading: isLoading,
    }),
    [userId, email, memberships, current, isLoading, qc],
  );
  return <SchoolCtx.Provider value={value}>{children}</SchoolCtx.Provider>;
}

export function useSchool() {
  const c = useContext(SchoolCtx);
  if (!c) throw new Error("useSchool outside provider");
  return c;
}

export function useCurrentSchool() {
  const c = useSchool();
  if (!c.school) throw new Error("No school selected");
  return { ...c, school: c.school };
}
