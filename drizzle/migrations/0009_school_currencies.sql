CREATE TABLE public.school_currencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  code text NOT NULL CHECK (char_length(code) BETWEEN 2 AND 8),
  rate numeric NOT NULL CHECK (rate > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_currencies TO authenticated;
GRANT ALL ON public.school_currencies TO service_role;
ALTER TABLE public.school_currencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view currencies" ON public.school_currencies FOR SELECT TO authenticated USING (public.has_perm(school_id,'view'));
CREATE POLICY "add currencies" ON public.school_currencies FOR INSERT TO authenticated WITH CHECK (public.has_perm(school_id,'settings'));
CREATE POLICY "edit currencies" ON public.school_currencies FOR UPDATE TO authenticated USING (public.has_perm(school_id,'settings')) WITH CHECK (public.has_perm(school_id,'settings'));
CREATE POLICY "remove currencies" ON public.school_currencies FOR DELETE TO authenticated USING (public.has_perm(school_id,'settings'));