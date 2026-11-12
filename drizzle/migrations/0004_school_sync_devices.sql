CREATE TABLE public.school_sync_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id),
  device_id text NOT NULL,
  device_name text,
  platform text NOT NULL DEFAULT 'android',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','revoked')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid,
  last_seen_at timestamptz,
  UNIQUE (school_id, device_id)
);
GRANT ALL ON public.school_sync_devices TO service_role;
ALTER TABLE public.school_sync_devices ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.list_sync_devices(_school uuid)
RETURNS SETOF public.school_sync_devices LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF coalesce(public.member_role(_school)::text NOT IN ('head','admin'), true) THEN RAISE EXCEPTION 'Not permitted'; END IF;
  RETURN QUERY SELECT * FROM school_sync_devices WHERE school_id=_school ORDER BY requested_at DESC;
END $$;

CREATE OR REPLACE FUNCTION public.set_sync_device_status(_school uuid, _device text, _status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF coalesce(public.member_role(_school)::text NOT IN ('head','admin'), true) THEN RAISE EXCEPTION 'Not permitted'; END IF;
  IF _status NOT IN ('approved','revoked') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  UPDATE school_sync_devices SET status=_status,
    approved_at = CASE WHEN _status='approved' THEN now() ELSE approved_at END,
    approved_by = CASE WHEN _status='approved' THEN auth.uid() ELSE approved_by END
  WHERE school_id=_school AND device_id=_device;
  IF NOT FOUND THEN RAISE EXCEPTION 'Device not found'; END IF;
  INSERT INTO audit_logs(school_id,user_id,action,record_type,details) VALUES (_school,auth.uid(),'device.'||_status,'sync_device',jsonb_build_object('device_id',_device));
END $$;

REVOKE ALL ON FUNCTION public.list_sync_devices(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.set_sync_device_status(uuid,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.list_sync_devices(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_sync_device_status(uuid,text,text) TO authenticated;