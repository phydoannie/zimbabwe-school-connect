REVOKE EXECUTE ON FUNCTION public.debtors_by_fee(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.student_balances(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.debtors(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.debtors_by_fee(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.student_balances(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.debtors(uuid) TO authenticated, service_role;