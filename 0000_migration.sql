
create type public.school_role as enum ('head','bursar','deputy_head','admin','teacher');

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  address text, phone text, email text, slogan text, logo_url text,
  bank_details text,
  currency text not null default 'USD',
  current_year int not null default extract(year from now())::int,
  current_term int not null default 1 check (current_term between 1 and 3),
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create table public.school_members (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid not null,
  email text,
  full_name text,
  role public.school_role not null,
  status text not null default 'active' check (status in ('pending','active','revoked')),
  created_at timestamptz not null default now(),
  unique (school_id, user_id)
);
create index on public.school_members(user_id);

-- permission helpers
create or replace function public.member_role(_school uuid)
returns public.school_role language sql stable security definer set search_path=public as $$
  select role from public.school_members where school_id=_school and user_id=auth.uid() and status='active' limit 1
$$;

create or replace function public.has_perm(_school uuid, _perm text)
returns boolean language sql stable security definer set search_path=public as $$
  select case public.member_role(_school)
    when 'head' then true
    when 'admin' then _perm in ('view','students','attendance','settings','users','reports','fees_setup')
    when 'bursar' then _perm in ('view','students','finance','reports','fees_setup')
    when 'deputy_head' then _perm in ('view','students','attendance')
    when 'teacher' then _perm in ('view','attendance')
    else false end
$$;

create table public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  reg_number text not null,
  first_name text not null,
  last_name text not null,
  gender text check (gender in ('M','F')),
  grade text not null,
  class_name text,
  boarding boolean not null default false,
  guardian_name text, guardian_phone text,
  status text not null default 'active' check (status in ('active','transferred','graduated','left')),
  opening_balance numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (school_id, reg_number),
  unique (school_id, id)
);
create index on public.students(school_id, last_name);
create index on public.students(school_id, grade);

create table public.student_academic_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  student_id uuid not null,
  year int not null, term int not null,
  grade text not null,
  note text,
  recorded_by uuid,
  created_at timestamptz not null default now(),
  foreign key (school_id, student_id) references public.students(school_id, id) on delete cascade
);

create table public.fee_types (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  description text,
  account text not null default 'General Levy',
  year int not null, term int not null check (term between 1 and 3),
  amount numeric(12,2) not null check (amount >= 0),
  applies_to text[] not null default '{}',
  boarding_only boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (school_id, id)
);

create table public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  student_id uuid not null,
  receipt_number text not null,
  paid_on date not null default current_date,
  year int not null, term int not null,
  method text not null,
  reference text,
  total numeric(12,2) not null check (total > 0),
  notes text,
  received_by uuid not null,
  received_by_name text,
  voided boolean not null default false,
  void_reason text, voided_at timestamptz, voided_by uuid,
  created_at timestamptz not null default now(),
  unique (school_id, receipt_number),
  foreign key (school_id, student_id) references public.students(school_id, id)
);
create index on public.payment_receipts(school_id, paid_on);

create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  receipt_id uuid not null references public.payment_receipts(id) on delete cascade,
  student_id uuid not null,
  fee_type_id uuid not null,
  amount numeric(12,2) not null check (amount > 0),
  foreign key (school_id, fee_type_id) references public.fee_types(school_id, id),
  foreign key (school_id, student_id) references public.students(school_id, id)
);
create index on public.payment_allocations(school_id, student_id);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  spent_on date not null default current_date,
  category text not null,
  account text not null default 'General Levy',
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  method text not null default 'Cash',
  recorded_by uuid not null,
  created_at timestamptz not null default now()
);
create index on public.expenses(school_id, spent_on);

create table public.teachers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  full_name text not null,
  ec_number text,
  phone text, email text, subject text, notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (school_id, id)
);

create table public.teacher_attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  teacher_id uuid not null,
  day date not null default current_date,
  status text not null check (status in ('present','absent','late','leave')),
  check_in time, check_out time,
  notes text,
  recorded_by uuid not null,
  created_at timestamptz not null default now(),
  unique (teacher_id, day),
  foreign key (school_id, teacher_id) references public.teachers(school_id, id) on delete cascade
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  user_id uuid,
  action text not null,
  record_type text, record_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

-- grants
grant select, insert, update, delete on public.schools, public.school_members, public.students, public.student_academic_records, public.fee_types, public.payment_receipts, public.payment_allocations, public.expenses, public.teachers, public.teacher_attendance to authenticated;
grant select on public.audit_logs to authenticated;
grant all on public.schools, public.school_members, public.students, public.student_academic_records, public.fee_types, public.payment_receipts, public.payment_allocations, public.expenses, public.teachers, public.teacher_attendance, public.audit_logs to service_role;

alter table public.schools enable row level security;
alter table public.school_members enable row level security;
alter table public.students enable row level security;
alter table public.student_academic_records enable row level security;
alter table public.fee_types enable row level security;
alter table public.payment_receipts enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.expenses enable row level security;
alter table public.teachers enable row level security;
alter table public.teacher_attendance enable row level security;
alter table public.audit_logs enable row level security;

create policy "members read school" on public.schools for select to authenticated using (public.has_perm(id,'view'));
create policy "settings update school" on public.schools for update to authenticated using (public.has_perm(id,'settings')) with check (public.has_perm(id,'settings'));

create policy "own membership read" on public.school_members for select to authenticated using (user_id = auth.uid() or public.has_perm(school_id,'users'));
create policy "users mgr update" on public.school_members for update to authenticated using (public.has_perm(school_id,'users') and user_id <> auth.uid()) with check (public.has_perm(school_id,'users') and (role <> 'head' or public.member_role(school_id)='head'));
create policy "users mgr delete" on public.school_members for delete to authenticated using (public.has_perm(school_id,'users') and user_id <> auth.uid());

create policy "view students" on public.students for select to authenticated using (public.has_perm(school_id,'view'));
create policy "ins students" on public.students for insert to authenticated with check (public.has_perm(school_id,'students'));
create policy "upd students" on public.students for update to authenticated using (public.has_perm(school_id,'students')) with check (public.has_perm(school_id,'students'));

create policy "view records" on public.student_academic_records for select to authenticated using (public.has_perm(school_id,'view'));
create policy "ins records" on public.student_academic_records for insert to authenticated with check (public.has_perm(school_id,'students'));

create policy "view fees" on public.fee_types for select to authenticated using (public.has_perm(school_id,'view'));
create policy "ins fees" on public.fee_types for insert to authenticated with check (public.has_perm(school_id,'fees_setup'));
create policy "upd fees" on public.fee_types for update to authenticated using (public.has_perm(school_id,'fees_setup')) with check (public.has_perm(school_id,'fees_setup'));

create policy "view receipts" on public.payment_receipts for select to authenticated using (public.has_perm(school_id,'finance') or public.has_perm(school_id,'reports'));
create policy "view allocs" on public.payment_allocations for select to authenticated using (public.has_perm(school_id,'finance') or public.has_perm(school_id,'reports'));

create policy "view expenses" on public.expenses for select to authenticated using (public.has_perm(school_id,'finance') or public.has_perm(school_id,'reports'));
create policy "ins expenses" on public.expenses for insert to authenticated with check (public.has_perm(school_id,'finance') and recorded_by = auth.uid());

create policy "view teachers" on public.teachers for select to authenticated using (public.has_perm(school_id,'view'));
create policy "ins teachers" on public.teachers for insert to authenticated with check (public.has_perm(school_id,'attendance'));
create policy "upd teachers" on public.teachers for update to authenticated using (public.has_perm(school_id,'attendance')) with check (public.has_perm(school_id,'attendance'));

create policy "view att" on public.teacher_attendance for select to authenticated using (public.has_perm(school_id,'view'));
create policy "ins att" on public.teacher_attendance for insert to authenticated with check (public.has_perm(school_id,'attendance') and recorded_by = auth.uid());
create policy "upd att" on public.teacher_attendance for update to authenticated using (public.has_perm(school_id,'attendance')) with check (public.has_perm(school_id,'attendance'));

create policy "view audit" on public.audit_logs for select to authenticated using (public.has_perm(school_id,'users') or public.has_perm(school_id,'reports'));

-- create school
create or replace function public.create_school(_name text, _address text, _phone text, _email text, _currency text, _year int, _term int, _full_name text)
returns uuid language plpgsql security definer set search_path=public as $$
declare _code text; _id uuid; _uid uuid := auth.uid(); _chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
begin
  if _uid is null then raise exception 'Not signed in'; end if;
  if coalesce(trim(_name),'') = '' then raise exception 'School name required'; end if;
  loop
    _code := 'SCH-' || (select string_agg(substr(_chars, 1 + floor(random()*length(_chars))::int, 1), '') from generate_series(1,6));
    exit when not exists (select 1 from schools where code=_code);
  end loop;
  insert into schools(code,name,address,phone,email,currency,current_year,current_term,created_by)
  values (_code,_name,_address,_phone,_email,coalesce(_currency,'USD'),_year,_term,_uid) returning id into _id;
  insert into school_members(school_id,user_id,email,full_name,role,status)
  values (_id,_uid,(select email from auth.users where id=_uid),_full_name,'head','active');
  insert into audit_logs(school_id,user_id,action,record_type,record_id) values (_id,_uid,'school.created','school',_id);
  return _id;
end $$;

-- request to join by code (pending; code grants nothing)
create or replace function public.request_membership(_code text, _role public.school_role, _full_name text)
returns text language plpgsql security definer set search_path=public as $$
declare _sid uuid; _uid uuid := auth.uid();
begin
  if _uid is null then raise exception 'Not signed in'; end if;
  if _role = 'head' then raise exception 'Head role cannot be requested'; end if;
  select id into _sid from schools where code = upper(trim(_code));
  if _sid is null then return 'submitted'; end if; -- do not reveal existence
  insert into school_members(school_id,user_id,email,full_name,role,status)
  values (_sid,_uid,(select email from auth.users where id=_uid),_full_name,_role,'pending')
  on conflict (school_id,user_id) do nothing;
  return 'submitted';
end $$;

-- student balances per fee type for current term
create or replace function public.student_balances(_student uuid)
returns table(fee_type_id uuid, name text, account text, due numeric, paid numeric, balance numeric)
language sql stable security definer set search_path=public as $$
  select f.id, f.name, f.account, f.amount,
    coalesce((select sum(a.amount) from payment_allocations a join payment_receipts r on r.id=a.receipt_id
      where a.fee_type_id=f.id and a.student_id=s.id and not r.voided),0) as paid,
    f.amount - coalesce((select sum(a.amount) from payment_allocations a join payment_receipts r on r.id=a.receipt_id
      where a.fee_type_id=f.id and a.student_id=s.id and not r.voided),0)
  from students s join schools sc on sc.id=s.school_id
  join fee_types f on f.school_id=s.school_id and f.active and f.year=sc.current_year and f.term=sc.current_term
    and (cardinality(f.applies_to)=0 or s.grade = any(f.applies_to))
    and (not f.boarding_only or s.boarding)
  where s.id=_student and public.has_perm(s.school_id,'view')
  order by f.name
$$;

-- debtors list
create or replace function public.debtors(_school uuid)
returns table(student_id uuid, reg_number text, full_name text, grade text, guardian_phone text, due numeric, paid numeric, balance numeric)
language sql stable security definer set search_path=public as $$
  with sc as (select * from schools where id=_school),
  d as (
    select s.id, s.reg_number, s.first_name||' '||s.last_name fn, s.grade, s.guardian_phone, s.opening_balance,
      coalesce((select sum(f.amount) from fee_types f, sc where f.school_id=s.school_id and f.active and f.year=sc.current_year and f.term=sc.current_term
        and (cardinality(f.applies_to)=0 or s.grade=any(f.applies_to)) and (not f.boarding_only or s.boarding)),0) due,
      coalesce((select sum(a.amount) from payment_allocations a join payment_receipts r on r.id=a.receipt_id, sc
        join fee_types f2 on true
        where a.student_id=s.id and not r.voided and f2.id=a.fee_type_id and f2.year=sc.current_year and f2.term=sc.current_term),0) paid
    from students s where s.school_id=_school and s.status='active'
  )
  select id, reg_number, fn, grade, guardian_phone, due + opening_balance, paid, due + opening_balance - paid
  from d where public.has_perm(_school,'finance') or public.has_perm(_school,'reports')
  order by 8 desc
$$;

-- transactional multi-fee payment
create or replace function public.collect_payment(_student uuid, _method text, _reference text, _notes text, _paid_on date, _items jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare _s students; _sc schools; _total numeric := 0; _rid uuid; _num text; _item jsonb; _amt numeric; _fid uuid; _name text;
begin
  select * into _s from students where id=_student;
  if _s.id is null then raise exception 'Student not found'; end if;
  if not public.has_perm(_s.school_id,'finance') then raise exception 'Not permitted'; end if;
  select * into _sc from schools where id=_s.school_id for update;
  if jsonb_array_length(_items)=0 then raise exception 'No fee items'; end if;
  for _item in select * from jsonb_array_elements(_items) loop
    _amt := (_item->>'amount')::numeric; _fid := (_item->>'fee_type_id')::uuid;
    if _amt is null or _amt <= 0 then raise exception 'Invalid amount'; end if;
    if not exists (select 1 from fee_types where id=_fid and school_id=_s.school_id) then raise exception 'Invalid fee type'; end if;
    _total := _total + _amt;
  end loop;
  _num := 'RCT-' || _sc.current_year || '-' || lpad((select count(*)+1 from payment_receipts where school_id=_s.school_id)::text, 6, '0');
  select full_name into _name from school_members where school_id=_s.school_id and user_id=auth.uid();
  insert into payment_receipts(school_id,student_id,receipt_number,paid_on,year,term,method,reference,total,notes,received_by,received_by_name)
  values (_s.school_id,_s.id,_num,coalesce(_paid_on,current_date),_sc.current_year,_sc.current_term,_method,_reference,_total,_notes,auth.uid(),_name)
  returning id into _rid;
  insert into payment_allocations(school_id,receipt_id,student_id,fee_type_id,amount)
  select _s.school_id,_rid,_s.id,(e->>'fee_type_id')::uuid,(e->>'amount')::numeric from jsonb_array_elements(_items) e;
  insert into audit_logs(school_id,user_id,action,record_type,record_id,details)
  values (_s.school_id,auth.uid(),'receipt.created','payment_receipt',_rid,jsonb_build_object('total',_total,'number',_num));
  return _rid;
end $$;

create or replace function public.void_receipt(_receipt uuid, _reason text)
returns void language plpgsql security definer set search_path=public as $$
declare _r payment_receipts;
begin
  select * into _r from payment_receipts where id=_receipt;
  if _r.id is null then raise exception 'Not found'; end if;
  if public.member_role(_r.school_id) not in ('head','bursar') then raise exception 'Not permitted'; end if;
  if coalesce(trim(_reason),'')='' then raise exception 'Reason required'; end if;
  if _r.voided then raise exception 'Already voided'; end if;
  update payment_receipts set voided=true, void_reason=_reason, voided_at=now(), voided_by=auth.uid() where id=_receipt;
  insert into audit_logs(school_id,user_id,action,record_type,record_id,details)
  values (_r.school_id,auth.uid(),'receipt.voided','payment_receipt',_receipt,jsonb_build_object('reason',_reason));
end $$;

-- explicit promotion; Grade 7 never auto-promoted to Form 1
create or replace function public.promote_students(_school uuid, _from text, _to text)
returns int language plpgsql security definer set search_path=public as $$
declare _n int; _sc schools;
begin
  if not public.has_perm(_school,'students') or public.member_role(_school) not in ('head','admin','deputy_head') then raise exception 'Not permitted'; end if;
  if _from ilike 'grade 7' and _to ilike 'form 1' then raise exception 'Grade 7 students must be enrolled into Form 1 individually, not bulk-promoted'; end if;
  if _from ilike 'grade 7' or _from ilike 'form 4' or _from ilike 'form 6' then raise exception 'Exit classes cannot be bulk-promoted'; end if;
  select * into _sc from schools where id=_school;
  insert into student_academic_records(school_id,student_id,year,term,grade,note,recorded_by)
    select school_id,id,_sc.current_year,_sc.current_term,grade,'promoted to '||_to,auth.uid() from students where school_id=_school and grade=_from and status='active';
  update students set grade=_to where school_id=_school and grade=_from and status='active';
  get diagnostics _n = row_count;
  insert into audit_logs(school_id,user_id,action,details) values (_school,auth.uid(),'students.promoted',jsonb_build_object('from',_from,'to',_to,'count',_n));
  return _n;
end $$;

revoke execute on function public.create_school, public.request_membership, public.student_balances, public.debtors, public.collect_payment, public.void_receipt, public.promote_students, public.has_perm, public.member_role from anon, public;
grant execute on function public.create_school, public.request_membership, public.student_balances, public.debtors, public.collect_payment, public.void_receipt, public.promote_students, public.has_perm, public.member_role to authenticated;
