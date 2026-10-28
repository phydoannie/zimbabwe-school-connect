create or replace function public.debtors_by_fee(_school uuid)
returns table(student_id uuid, reg_number text, full_name text, grade text, guardian_phone text, fee_type_id uuid, fee_name text, account text, due numeric, paid numeric, balance numeric)
language sql stable security definer set search_path=public as $$
  select s.id, s.reg_number, s.first_name||' '||s.last_name, s.grade, s.guardian_phone, f.id, f.name, f.account, f.amount,
    coalesce((select sum(a.amount) from payment_allocations a join payment_receipts r on r.id=a.receipt_id
      where a.fee_type_id=f.id and a.student_id=s.id and not r.voided),0),
    f.amount - coalesce((select sum(a.amount) from payment_allocations a join payment_receipts r on r.id=a.receipt_id
      where a.fee_type_id=f.id and a.student_id=s.id and not r.voided),0)
  from students s join schools sc on sc.id=s.school_id
  join fee_types f on f.school_id=s.school_id and f.active and f.year=sc.current_year and f.term=sc.current_term
    and (cardinality(f.applies_to)=0 or s.grade = any(f.applies_to))
    and (not f.boarding_only or s.boarding)
  where s.school_id=_school and s.status='active'
    and (public.has_perm(_school,'finance') or public.has_perm(_school,'reports'))
$$;
grant execute on function public.debtors_by_fee(uuid) to authenticated;