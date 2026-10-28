alter table public.payment_receipts add column if not exists sync_key text;
create unique index if not exists payment_receipts_school_sync_key_uidx on public.payment_receipts(school_id, sync_key) where sync_key is not null;
alter table public.expenses add column if not exists sync_key text;
create unique index if not exists expenses_school_sync_key_uidx on public.expenses(school_id, sync_key) where sync_key is not null;

create or replace function public.sync_offline_payment(_sync_key text,_student uuid,_receipt_number text,_paid_on date,_year integer,_term integer,_method text,_reference text,_notes text,_items jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare _s public.students; _rid uuid; _total numeric:=0; _item jsonb; _fee uuid; _amt numeric; _school uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if coalesce(trim(_sync_key),'')='' then raise exception 'Sync key required'; end if;
 select * into _s from public.students where id=_student;
 if _s.id is null then raise exception 'Student not found'; end if;
 _school:=_s.school_id;
 if not public.has_perm(_school,'finance') then raise exception 'Not permitted'; end if;
 select id into _rid from public.payment_receipts where school_id=_school and sync_key=_sync_key;
 if _rid is not null then return _rid; end if;
 if _items is null or jsonb_typeof(_items)<>'array' or jsonb_array_length(_items)=0 then raise exception 'At least one fee allocation is required'; end if;
 if _term<1 or _term>3 then raise exception 'Invalid term'; end if;
 for _item in select * from jsonb_array_elements(_items) loop
  _fee:=nullif(_item->>'fee_type_id','')::uuid; _amt:=nullif(_item->>'amount','')::numeric;
  if _fee is null or _amt is null or _amt<=0 then raise exception 'Invalid fee allocation'; end if;
  if not exists(select 1 from public.fee_types where id=_fee and school_id=_school) then raise exception 'Fee type does not belong to this school'; end if;
  _total:=_total+_amt;
 end loop;
 insert into public.payment_receipts(school_id,student_id,receipt_number,paid_on,year,term,method,reference,total,notes,received_by,received_by_name,sync_key)
 values(_school,_student,coalesce(nullif(trim(_receipt_number),''),'OFFLINE-'||left(replace(_sync_key,'-',''),12)),coalesce(_paid_on,current_date),coalesce(_year,extract(year from coalesce(_paid_on,current_date))::integer),_term,coalesce(nullif(trim(_method),''),'Cash'),_reference,_total,_notes,auth.uid(),(select full_name from public.school_members where school_id=_school and user_id=auth.uid() and status='active' limit 1),_sync_key) returning id into _rid;
 insert into public.payment_allocations(school_id,receipt_id,student_id,fee_type_id,amount) select _school,_rid,_student,(e->>'fee_type_id')::uuid,(e->>'amount')::numeric from jsonb_array_elements(_items) e;
 insert into public.audit_logs(school_id,user_id,action,record_type,record_id,details) values(_school,auth.uid(),'receipt.synced','payment_receipt',_rid,jsonb_build_object('sync_key',_sync_key,'total',_total,'offline',true));
 return _rid;
exception when unique_violation then select id into _rid from public.payment_receipts where school_id=_school and sync_key=_sync_key; if _rid is not null then return _rid; end if; raise;
end; $$;
revoke all on function public.sync_offline_payment(text,uuid,text,date,integer,integer,text,text,text,jsonb) from public,anon;
grant execute on function public.sync_offline_payment(text,uuid,text,date,integer,integer,text,text,text,jsonb) to authenticated;

create or replace function public.sync_offline_expense(_school uuid,_sync_key text,_spent_on date,_category text,_account text,_description text,_amount numeric,_method text,_voucher_reference text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare _id uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if coalesce(trim(_sync_key),'')='' then raise exception 'Sync key required'; end if;
 if _school is null or not public.has_perm(_school,'finance') then raise exception 'Not permitted'; end if;
 select id into _id from public.expenses where school_id=_school and sync_key=_sync_key; if _id is not null then return _id; end if;
 if _amount is null or _amount<=0 then raise exception 'Expense amount must be positive'; end if;
 insert into public.expenses(school_id,spent_on,category,account,description,amount,method,voucher_reference,recorded_by,sync_key)
 values(_school,coalesce(_spent_on,current_date),coalesce(nullif(trim(_category),''),'Other'),coalesce(nullif(trim(_account),''),'General Levy'),coalesce(nullif(trim(_description),''),'Offline expense'),_amount,coalesce(nullif(trim(_method),''),'Cash'),_voucher_reference,auth.uid(),_sync_key) returning id into _id;
 insert into public.audit_logs(school_id,user_id,action,record_type,record_id,details) values(_school,auth.uid(),'expense.synced','expense',_id,jsonb_build_object('sync_key',_sync_key,'amount',_amount,'offline',true));
 return _id;
exception when unique_violation then select id into _id from public.expenses where school_id=_school and sync_key=_sync_key; if _id is not null then return _id; end if; raise;
end; $$;
revoke all on function public.sync_offline_expense(uuid,text,date,text,text,text,numeric,text,text) from public,anon;
grant execute on function public.sync_offline_expense(uuid,text,date,text,text,text,numeric,text,text) to authenticated;
