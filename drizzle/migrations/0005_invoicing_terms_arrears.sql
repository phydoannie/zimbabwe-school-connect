alter table public.schools add column if not exists billing_cycle text not null default 'termly';

create table public.school_terms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  year integer not null,
  term integer not null,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  unique (school_id, year, term)
);
grant select, insert, update, delete on public.school_terms to authenticated;
grant all on public.school_terms to service_role;
alter table public.school_terms enable row level security;
create policy "view terms" on public.school_terms for select to authenticated using (has_perm(school_id, 'view'));
create policy "manage terms" on public.school_terms for insert to authenticated with check (has_perm(school_id, 'finance') or has_perm(school_id, 'settings'));
create policy "update terms" on public.school_terms for update to authenticated using (has_perm(school_id, 'finance') or has_perm(school_id, 'settings')) with check (has_perm(school_id, 'finance') or has_perm(school_id, 'settings'));
create policy "delete terms" on public.school_terms for delete to authenticated using (has_perm(school_id, 'settings'));

create table public.student_fee_arrears (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  fee_type_id uuid not null references public.fee_types(id) on delete cascade,
  amount numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique (student_id, fee_type_id)
);
grant select, insert, update, delete on public.student_fee_arrears to authenticated;
grant all on public.student_fee_arrears to service_role;
alter table public.student_fee_arrears enable row level security;
create policy "view arrears" on public.student_fee_arrears for select to authenticated using (has_perm(school_id, 'view'));
create policy "manage arrears" on public.student_fee_arrears for insert to authenticated with check (has_perm(school_id, 'finance'));
create policy "update arrears" on public.student_fee_arrears for update to authenticated using (has_perm(school_id, 'finance')) with check (has_perm(school_id, 'finance'));
create policy "delete arrears" on public.student_fee_arrears for delete to authenticated using (has_perm(school_id, 'finance'));

create table public.student_invoices (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  fee_type_id uuid not null references public.fee_types(id) on delete cascade,
  year integer not null,
  term integer not null,
  amount numeric not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (student_id, fee_type_id, year, term)
);
grant select, insert on public.student_invoices to authenticated;
grant all on public.student_invoices to service_role;
alter table public.student_invoices enable row level security;
create policy "view invoices" on public.student_invoices for select to authenticated using (has_perm(school_id, 'finance') or has_perm(school_id, 'reports'));
create policy "insert invoices" on public.student_invoices for insert to authenticated with check (has_perm(school_id, 'finance'));

create or replace function public.active_term(_school uuid)
returns table(year integer, term integer, start_date date, end_date date)
language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  return query select t.year, t.term, t.start_date, t.end_date from school_terms t
    where t.school_id = _school and current_date between t.start_date and t.end_date limit 1;
  if not found then
    return query select s.current_year, s.current_term, null::date, null::date from schools s where s.id = _school;
  end if;
end
$function$;

create or replace function public.invoice_fee(_fee_type uuid, _grades text[] default null, _year integer default null, _term integer default null)
returns integer
language plpgsql security definer set search_path to 'public'
as $function$
declare _f fee_types; _sc schools; _y int; _t int; _n int;
begin
  select * into _f from fee_types where id = _fee_type;
  if _f.id is null then raise exception 'Fee type not found'; end if;
  if not public.has_perm(_f.school_id, 'finance') then raise exception 'Not permitted'; end if;
  select * into _sc from schools where id = _f.school_id;
  _y := coalesce(_year, _sc.current_year);
  _t := coalesce(_term, _sc.current_term);
  insert into student_invoices (school_id, student_id, fee_type_id, year, term, amount, created_by)
  select _f.school_id, s.id, _f.id, _y, _t, _f.amount, auth.uid()
  from students s
  where s.school_id = _f.school_id and s.status = 'active'
    and (_grades is null or cardinality(_grades) = 0 or s.grade = any(_grades))
    and (cardinality(_f.applies_to) = 0 or s.grade = any(_f.applies_to))
    and (not _f.boarding_only or s.boarding)
  on conflict (student_id, fee_type_id, year, term) do nothing;
  get diagnostics _n = row_count;
  insert into audit_logs (school_id, user_id, action, record_type, record_id, details)
  values (_f.school_id, auth.uid(), 'invoice.run', 'fee_type', _f.id, jsonb_build_object('year', _y, 'term', _t, 'invoiced', _n, 'amount', _f.amount));
  return _n;
end
$function$;

create or replace function public.student_balances(_student uuid)
returns table(fee_type_id uuid, name text, account text, due numeric, paid numeric, balance numeric)
language sql stable security definer set search_path to 'public'
as $function$
  select f.id, f.name, f.account,
    coalesce((select sum(i.amount) from student_invoices i
        where i.student_id = s.id and i.fee_type_id = f.id and i.year = sc.current_year and i.term = sc.current_term), f.amount)
      + coalesce((select a.amount from student_fee_arrears a where a.student_id = s.id and a.fee_type_id = f.id), 0) as due,
    coalesce((select sum(al.amount) from payment_allocations al join payment_receipts r on r.id = al.receipt_id
      where al.fee_type_id = f.id and al.student_id = s.id and not r.voided), 0) as paid,
    coalesce((select sum(i.amount) from student_invoices i
        where i.student_id = s.id and i.fee_type_id = f.id and i.year = sc.current_year and i.term = sc.current_term), f.amount)
      + coalesce((select a.amount from student_fee_arrears a where a.student_id = s.id and a.fee_type_id = f.id), 0)
      - coalesce((select sum(al.amount) from payment_allocations al join payment_receipts r on r.id = al.receipt_id
        where al.fee_type_id = f.id and al.student_id = s.id and not r.voided), 0) as balance
  from students s join schools sc on sc.id = s.school_id
  join fee_types f on f.school_id = s.school_id and f.active and f.year = sc.current_year and f.term = sc.current_term
    and (cardinality(f.applies_to) = 0 or s.grade = any(f.applies_to))
    and (not f.boarding_only or s.boarding)
  where s.id = _student and public.has_perm(s.school_id, 'view')
  order by f.name
$function$;

create or replace function public.debtors_by_fee(_school uuid)
returns table(student_id uuid, reg_number text, full_name text, grade text, guardian_phone text, fee_type_id uuid, fee_name text, account text, due numeric, paid numeric, balance numeric)
language sql stable security definer set search_path to 'public'
as $function$
  select s.id, s.reg_number, s.first_name || ' ' || s.last_name, s.grade, s.guardian_phone, f.id, f.name, f.account,
    coalesce((select sum(i.amount) from student_invoices i
        where i.student_id = s.id and i.fee_type_id = f.id and i.year = sc.current_year and i.term = sc.current_term), f.amount)
      + coalesce((select a.amount from student_fee_arrears a where a.student_id = s.id and a.fee_type_id = f.id), 0),
    coalesce((select sum(al.amount) from payment_allocations al join payment_receipts r on r.id = al.receipt_id
      where al.fee_type_id = f.id and al.student_id = s.id and not r.voided), 0),
    coalesce((select sum(i.amount) from student_invoices i
        where i.student_id = s.id and i.fee_type_id = f.id and i.year = sc.current_year and i.term = sc.current_term), f.amount)
      + coalesce((select a.amount from student_fee_arrears a where a.student_id = s.id and a.fee_type_id = f.id), 0)
      - coalesce((select sum(al.amount) from payment_allocations al join payment_receipts r on r.id = al.receipt_id
        where al.fee_type_id = f.id and al.student_id = s.id and not r.voided), 0)
  from students s join schools sc on sc.id = s.school_id
  join fee_types f on f.school_id = s.school_id and f.active and f.year = sc.current_year and f.term = sc.current_term
    and (cardinality(f.applies_to) = 0 or s.grade = any(f.applies_to))
    and (not f.boarding_only or s.boarding)
  where s.school_id = _school and s.status = 'active'
    and (public.has_perm(_school, 'finance') or public.has_perm(_school, 'reports'))
$function$;