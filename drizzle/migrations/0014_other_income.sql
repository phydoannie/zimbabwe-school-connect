create table public.other_income (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  received_on date not null default current_date,
  source text not null,
  description text not null default '',
  amount numeric(12,2) not null check (amount > 0),
  method text not null default 'Cash (USD)',
  reference text,
  recorded_by uuid not null,
  created_at timestamptz not null default now()
);
create index on public.other_income(school_id, received_on);
grant select, insert on public.other_income to authenticated;
grant all on public.other_income to service_role;
alter table public.other_income enable row level security;
create policy "view other income" on public.other_income for select to authenticated using (public.has_perm(school_id,'finance') or public.has_perm(school_id,'reports'));
create policy "ins other income" on public.other_income for insert to authenticated with check (public.has_perm(school_id,'finance') and recorded_by = auth.uid());