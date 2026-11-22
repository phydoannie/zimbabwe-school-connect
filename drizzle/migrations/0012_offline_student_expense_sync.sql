CREATE TABLE public.offline_entry_receipts(id uuid PRIMARY KEY, school_id uuid NOT NULL REFERENCES public.schools(id), user_id uuid NOT NULL, kind text NOT NULL CHECK(kind IN ('student','expense')), payload jsonb NOT NULL, record_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.offline_entry_receipts TO authenticated;
GRANT ALL ON public.offline_entry_receipts TO service_role;
ALTER TABLE public.offline_entry_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_entry_receipts ON public.offline_entry_receipts FOR SELECT TO authenticated USING(user_id=auth.uid() AND public.has_perm(school_id,'view'));
CREATE OR REPLACE FUNCTION public.sync_offline_entry(_school uuid,_reference uuid,_kind text,_payload jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE old public.offline_entry_receipts; s jsonb; arrears jsonb; amount numeric; rec uuid; BEGIN
IF auth.uid() IS NULL OR _reference IS NULL OR _kind NOT IN ('student','expense') OR _kind IS NULL OR jsonb_typeof(_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid offline entry'; END IF;
IF NOT coalesce(public.has_perm(_school,CASE WHEN _kind='student' THEN 'students' ELSE 'finance' END),false) THEN RAISE EXCEPTION 'Not permitted'; END IF;
PERFORM 1 FROM public.schools WHERE id=_school FOR UPDATE;
SELECT * INTO old FROM public.offline_entry_receipts WHERE id=_reference;
IF FOUND THEN IF old.school_id<>_school OR old.user_id<>auth.uid() OR old.kind<>_kind OR old.payload IS DISTINCT FROM _payload THEN RAISE EXCEPTION 'Reference already used with different details'; END IF; RETURN old.record_id; END IF;
IF _kind='student' THEN
s:=_payload->'student'; arrears:=coalesce(_payload->'arrears','[]'::jsonb);
IF jsonb_typeof(s) IS DISTINCT FROM 'object' OR jsonb_typeof(arrears) IS DISTINCT FROM 'array' OR coalesce(trim(s->>'reg_number'),'')='' OR coalesce(trim(s->>'first_name'),'')='' OR coalesce(trim(s->>'last_name'),'')='' OR coalesce(trim(s->>'grade'),'')='' THEN RAISE EXCEPTION 'Student details required'; END IF;
IF jsonb_array_length(arrears)>0 AND NOT coalesce(public.has_perm(_school,'finance'),false) THEN RAISE EXCEPTION 'Not permitted to set arrears'; END IF;
INSERT INTO public.students(id,school_id,reg_number,first_name,last_name,grade,class_name,gender,boarding,guardian_name,guardian_phone,opening_balance) VALUES(_reference,_school,trim(s->>'reg_number'),trim(s->>'first_name'),trim(s->>'last_name'),s->>'grade',nullif(s->>'class_name',''),nullif(s->>'gender',''),coalesce((s->>'boarding')::boolean,false),nullif(s->>'guardian_name',''),nullif(s->>'guardian_phone',''),0) RETURNING id INTO rec;
IF jsonb_array_length(arrears)>0 THEN PERFORM public.save_student_arrears(rec,arrears); END IF;
INSERT INTO public.audit_logs(school_id,user_id,action,record_type,record_id) VALUES(_school,auth.uid(),'student.enrolled.offline','student',rec);
ELSE
amount:=(_payload->>'amount')::numeric;
IF amount IS NULL OR amount<=0 OR amount::text IN ('NaN','Infinity','-Infinity') OR amount<>round(amount,2) OR coalesce(trim(_payload->>'description'),'')='' OR coalesce(trim(_payload->>'account'),'')='' OR coalesce(trim(_payload->>'category'),'')='' OR coalesce(trim(_payload->>'method'),'')='' OR (_payload->>'spent_on') IS NULL THEN RAISE EXCEPTION 'Invalid expense'; END IF;
INSERT INTO public.expenses(id,school_id,spent_on,category,account,description,amount,method,recorded_by,voucher_reference) VALUES(_reference,_school,(_payload->>'spent_on')::date,_payload->>'category',_payload->>'account',trim(_payload->>'description'),amount,_payload->>'method',auth.uid(),nullif(_payload->>'voucher_reference','')) RETURNING id INTO rec;
END IF;
INSERT INTO public.offline_entry_receipts(id,school_id,user_id,kind,payload,record_id) VALUES(_reference,_school,auth.uid(),_kind,_payload,rec);
RETURN rec; END $$;
REVOKE EXECUTE ON FUNCTION public.sync_offline_entry(uuid,uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sync_offline_entry(uuid,uuid,text,jsonb) TO authenticated;