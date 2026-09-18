-- Baitly : restriction par personne, commune à toutes ses conciergeries.
CREATE TABLE provider_property_preferences (
 user_id bigint PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 allowed_types text[] NOT NULL,
 CHECK (array_position(allowed_types,NULL) IS NULL)
);
CREATE FUNCTION public.baitly_user_accepts_property(p_user bigint,p_type text)
RETURNS boolean LANGUAGE sql STABLE AS $fn$
 SELECT COALESCE((SELECT p_type IS NOT NULL AND p_type=ANY(allowed_types)
   FROM public.provider_property_preferences WHERE user_id=p_user),true)
$fn$;
CREATE FUNCTION public.baitly_provider_accepts_property(p_provider bigint,p_type text)
RETURNS boolean LANGUAGE sql STABLE AS $fn$
 SELECT COALESCE((SELECT public.baitly_user_accepts_property(user_id,p_type)
   FROM public.marketplace_providers WHERE id=p_provider),false)
$fn$;
CREATE FUNCTION public.baitly_assignee_property_users(p_kind text,p_id bigint)
RETURNS TABLE(user_id bigint) LANGUAGE sql STABLE SECURITY INVOKER
SET search_path=pg_catalog,public SET app.bypass_rls='on'
AS $fn$
 SELECT p_id WHERE p_kind='user'
 UNION
 SELECT t.personal_user_id FROM public.teams t WHERE p_kind='team' AND t.id=p_id AND t.personal_user_id IS NOT NULL
 UNION
 SELECT m.user_id FROM public.team_members m JOIN public.teams t ON t.id=m.team_id
   WHERE p_kind='team' AND t.id=p_id AND t.personal_user_id IS NULL
$fn$;
CREATE FUNCTION public.baitly_assignee_accepts_property(p_kind text,p_id bigint,p_type text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER
SET search_path=pg_catalog,public SET app.bypass_rls='on'
AS $fn$
 SELECT NOT EXISTS (SELECT 1 FROM public.baitly_assignee_property_users(p_kind,p_id) u
   WHERE NOT public.baitly_user_accepts_property(u.user_id,p_type))
$fn$;
CREATE FUNCTION public.baitly_lock_property_preferences(p_kind text,p_id bigint)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public SET app.bypass_rls='on'
AS $fn$
DECLARE uid bigint;
BEGIN
 FOR uid IN SELECT user_id FROM public.baitly_assignee_property_users(p_kind,p_id) ORDER BY user_id LOOP
   PERFORM pg_advisory_xact_lock(hashtextextended('baitly:coverage:user:'||uid::text,0));
 END LOOP;
 RETURN 1;
END
$fn$;
