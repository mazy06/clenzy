-- Baitly : même règle territoriale pour le PMS et les devis marketplace.
CREATE OR REPLACE FUNCTION public.baitly_zone_covers(
 z_country text, z_department text, z_arrondissement text, z_city text,
 p_country text, p_department text, p_arrondissement text, p_city text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $fn$
 SELECT COALESCE(
 upper(trim(z_country)) = upper(trim(p_country)) AND
 CASE WHEN upper(trim(p_country)) = 'FR'
 THEN NULLIF(trim(z_department), '') = NULLIF(trim(p_department), '')
   AND (NULLIF(trim(z_arrondissement), '') IS NULL OR trim(z_arrondissement) = NULLIF(trim(p_arrondissement), ''))
 ELSE NULLIF(lower(trim(z_city)), '') = NULLIF(lower(trim(p_city)), '') END, false)
$fn$;

CREATE OR REPLACE FUNCTION public.baitly_team_covers(p_team_id bigint, p_country text, p_department text, p_arrondissement text, p_city text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public SET app.bypass_rls = 'on'
AS $fn$
 SELECT EXISTS (SELECT 1 FROM (
  SELECT z.country_code AS country, z.department, z.arrondissement, z.city
  FROM public.teams t JOIN public.marketplace_provider_zones z ON z.user_id=t.personal_user_id WHERE t.id=p_team_id
  UNION ALL
  SELECT z.country,z.department,z.arrondissement,z.city
  FROM public.teams t JOIN public.team_coverage_zones z ON z.team_id=t.id
  WHERE t.id=p_team_id AND t.personal_user_id IS NULL
 ) z WHERE public.baitly_zone_covers(z.country,z.department,z.arrondissement,z.city,p_country,p_department,p_arrondissement,p_city))
$fn$;

CREATE OR REPLACE FUNCTION public.baitly_provider_covers(p_provider_id bigint, p_country text, p_department text, p_arrondissement text, p_city text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public SET app.bypass_rls = 'on'
AS $fn$
 SELECT EXISTS (
 SELECT 1 FROM public.marketplace_providers p JOIN public.marketplace_provider_zones z
 ON (z.user_id=p.user_id OR (p.user_id IS NULL AND z.provider_id=p.id))
 WHERE p.id=p_provider_id AND public.baitly_zone_covers(z.country_code,z.department,z.arrondissement,z.city,p_country,p_department,p_arrondissement,p_city))
$fn$;
