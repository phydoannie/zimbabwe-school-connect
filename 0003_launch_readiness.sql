-- SchoolSys launch update: per-fee opening arrears and atomic student creation.
create table if not exists public.student_fee_arrears (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  student_id uuid not null,
  fee_type_id uuid not null,
  amount numeric(12,2) not null check (amount > 0),
  note text,
  recorded_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (student_id, fee_type_id),
  foreign key (school_id, student_id) references public.students(school_id, id) on delete cascade,
  foreign key (school_id, fee_type_id) references public.fee_types(school_id, id) on delete cascade
);
create index if not exists student_fee_arrears_school_student_idx on public.student_fee_arrears(school_id, student_id);
alter table public.student_fee_arrears enable row level security;

drop policy if exists "view student fee arrears" on public.student_fee_arrears;
drop policy if exists "manage student fee arrears" on public.student_fee_arrears;
create policy "view student fee arrears" on public.student_fee_arrears for select to authenticated
  using (public.has_perm(school_id, 'view'));
create policy "manage student fee arrears" on public.student_fee_arrears for all to authenticated
  using (public.has_perm(school_id, 'students')) with check (public.has_perm(school_id, 'students'));
grant select, insert, update, delete on public.student_fee_arrears to authenticated;
grant all on public.student_fee_arrears to service_role;

create or replace function public.create_student_with_arrears(_student jsonb, _arrears jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  _school uuid := nullif(_student->>'school_id','')::uuid;
  _student_id uuid;
  _item jsonb;
  _fee uuid;
  _amount numeric;
  _total numeric := 0;
  _grade text := nullif(_student->>'grade','');
  _boarding boolean := coalesce((_student->>'boarding')::boolean, false);
  _sc schools;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if _school is null or not public.has_perm(_school,'students') then raise exception 'Not permitted to add students to this school'; end if;
  if coalesce(trim(_student->>'reg_number'),'') = '' or coalesce(trim(_student->>'first_name'),'') = '' or coalesce(trim(_student->>'last_name'),'') = '' then
    raise exception 'Registration number, first name and surname are required';
  end if;
  select * into _sc from schools where id=_school;
  if _sc.id is null then raise exception 'School not found'; end if;
  if jsonb_typeof(coalesce(_arrears,'[]'::jsonb)) <> 'array' then raise exception 'Arrears must be a list'; end if;

  insert into students(school_id,reg_number,first_name,last_name,gender,grade,class_name,boarding,guardian_name,guardian_phone,opening_balance)
  values (_school,trim(_student->>'reg_number'),trim(_student->>'first_name'),trim(_student->>'last_name'),
    nullif(_student->>'gender',''),_grade,nullif(trim(_student->>'class_name'),''),_boarding,
    nullif(trim(_student->>'guardian_name'),''),nullif(trim(_student->>'guardian_phone'),''),0)
  returning id into _student_id;

  for _item in select * from jsonb_array_elements(coalesce(_arrears,'[]'::jsonb)) loop
    _fee := nullif(_item->>'fee_type_id','')::uuid;
    _amount := nullif(_item->>'amount','')::numeric;
    if _fee is null or _amount is null or _amount <= 0 then raise exception 'Each selected arrears item needs a fee type and a positive amount'; end if;
    if not exists (
      select 1 from fee_types f where f.id=_fee and f.school_id=_school and f.active
        and f.year=_sc.current_year and f.term=_sc.current_term
        and (cardinality(f.applies_to)=0 or _grade=any(f.applies_to))
        and (not f.boarding_only or _boarding)
    ) then raise exception 'An arrears fee type is invalid or does not apply to this student'; end if;
    insert into student_fee_arrears(school_id,student_id,fee_type_id,amount,recorded_by)
      values (_school,_student_id,_fee,_amount,auth.uid());
    _total := _total + _amount;
  end loop;
  update students set opening_balance=_total where id=_student_id;
  insert into audit_logs(school_id,user_id,action,record_type,record_id,details)
    values (_school,auth.uid(),'student.created','students',_student_id,jsonb_build_object('opening_arrears',_total,'fee_types',jsonb_array_length(coalesce(_arrears,'[]'::jsonb))));
  return _student_id;
end $$;
grant execute on function public.create_student_with_arrears(jsonb,jsonb) to authenticated;

create or replace function public.student_balances(_student uuid)
returns table(fee_type_id uuid, name text, account text, due numeric, paid numeric, balance numeric)
language sql stable security definer set search_path=public as $$
  select f.id, f.name, f.account,
    f.amount + coalesce((select a.amount from student_fee_arrears a where a.student_id=s.id and a.fee_type_id=f.id),0) as due,
    coalesce((select sum(a.amount) from payment_allocations a join payment_receipts r on r.id=a.receipt_id
      where a.fee_type_id=f.id and a.student_id=s.id and not r.voided),0) as paid,
    f.amount + coalesce((select a.amount from student_fee_arrears a where a.student_id=s.id and a.fee_type_id=f.id),0)
      - coalesce((select sum(a.amount) from payment_allocations a join payment_receipts r on r.id=a.receipt_id
      where a.fee_type_id=f.id and a.student_id=s.id and not r.voided),0) as balance
  from students s join schools sc on sc.id=s.school_id
  join fee_types f on f.school_id=s.school_id and f.active and f.year=sc.current_year and f.term=sc.current_term
    and (cardinality(f.applies_to)=0 or s.grade = any(f.applies_to))
    and (not f.boarding_only or s.boarding)
  where s.id=_student and public.has_perm(s.school_id,'view')
  order by f.name
$$;

create or replace function public.debtors_by_fee(_school uuid)
returns table(student_id uuid, reg_number text, full_name text, grade text, guardian_phone text, fee_type_id uuid, fee_name text, account text, due numeric, paid numeric, balance numeric)
language sql stable security definer set search_path=public as $$
  select s.id, s.reg_number, s.first_name||' '||s.last_name, s.grade, s.guardian_phone, f.id, f.name, f.account,
    f.amount + coalesce((select ar.amount from student_fee_arrears ar where ar.student_id=s.id and ar.fee_type_id=f.id),0),
    coalesce((select sum(a.amount) from payment_allocations a join payment_receipts r on r.id=a.receipt_id
      where a.fee_type_id=f.id and a.student_id=s.id and not r.voided),0),
    f.amount + coalesce((select ar.amount from student_fee_arrears ar where ar.student_id=s.id and ar.fee_type_id=f.id),0)
      - coalesce((select sum(a.amount) from payment_allocations a join payment_receipts r on r.id=a.receipt_id
      where a.fee_type_id=f.id and a.student_id=s.id and not r.voided),0)
  from students s join schools sc on sc.id=s.school_id
  join fee_types f on f.school_id=s.school_id and f.active and f.year=sc.current_year and f.term=sc.current_term
    and (cardinality(f.applies_to)=0 or s.grade = any(f.applies_to)) and (not f.boarding_only or s.boarding)
  where s.school_id=_school and s.status='active'
    and (public.has_perm(_school,'finance') or public.has_perm(_school,'reports'))
$$;

grant execute on function public.student_balances(uuid) to authenticated;
grant execute on function public.debtors_by_fee(uuid) to authenticated;

create or replace function public.debtors(_school uuid)
returns table(student_id uuid, reg_number text, full_name text, grade text, guardian_phone text, due numeric, paid numeric, balance numeric)
language sql stable security definer set search_path=public as $$
  with sc as (select * from schools where id=_school),
  d as (
    select s.id, s.reg_number, s.first_name||' '||s.last_name fn, s.grade, s.guardian_phone,
      coalesce((select sum(f.amount + coalesce((select ar.amount from student_fee_arrears ar where ar.student_id=s.id and ar.fee_type_id=f.id),0))
        from fee_types f, sc where f.school_id=s.school_id and f.active and f.year=sc.current_year and f.term=sc.current_term
          and (cardinality(f.applies_to)=0 or s.grade=any(f.applies_to)) and (not f.boarding_only or s.boarding)),0)
      + case when exists(select 1 from student_fee_arrears ar where ar.student_id=s.id) then 0 else s.opening_balance end as due,
      coalesce((select sum(a.amount) from payment_allocations a join payment_receipts r on r.id=a.receipt_id, sc
        join fee_types f2 on true where a.student_id=s.id and not r.voided and f2.id=a.fee_type_id
          and f2.year=sc.current_year and f2.term=sc.current_term),0) paid
    from students s where s.school_id=_school and s.status='active'
  )
  select id,reg_number,fn,grade,guardian_phone,due,paid,due-paid
  from d where public.has_perm(_school,'finance') or public.has_perm(_school,'reports') order by 8 desc
$$;
grant execute on function public.debtors(uuid) to authenticated;
