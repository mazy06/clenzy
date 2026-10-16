-- Baitly : secteurs administratifs OU rayon depuis la base géolocalisée.
-- Les signatures historiques restent disponibles aux clients sans coordonnées.
CREATE OR REPLACE FUNCTION public.baitly_within_radius(
 base_lat double precision, base_lon double precision, radius_km integer,
 target_lat double precision, target_lon double precision)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $fn$
 SELECT COALESCE(base_lat BETWEEN -90 AND 90 AND base_lon BETWEEN -180 AND 180
 AND target_lat BETWEEN -90 AND 90 AND target_lon BETWEEN -180 AND 180
 AND radius_km BETWEEN 0 AND 1000
 AND 6371.0088 * 2 * asin(sqrt(least(1.0, greatest(0.0,
   power(sin(radians(target_lat - base_lat) / 2), 2)
   + cos(radians(base_lat)) * cos(radians(target_lat))
   * power(sin(radians(target_lon - base_lon) / 2), 2))))) <= radius_km, false)
$fn$;

CREATE OR REPLACE FUNCTION public.baitly_provider_covers(
 p_provider_id bigint, p_country text, p_department text, p_arrondissement text, p_city text,
 p_lat double precision, p_lon double precision)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public SET app.bypass_rls = 'on'
AS $fn$
 SELECT public.baitly_provider_covers(p_provider_id,p_country,p_department,p_arrondissement,p_city)
 OR EXISTS (SELECT 1 FROM public.marketplace_providers p WHERE p.id=p_provider_id
   AND public.baitly_within_radius(p.latitude::double precision,p.longitude::double precision,
     p.travel_radius_km,p_lat,p_lon))
$fn$;

CREATE OR REPLACE FUNCTION public.baitly_team_covers(
 p_team_id bigint, p_country text, p_department text, p_arrondissement text, p_city text,
 p_lat double precision, p_lon double precision)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public SET app.bypass_rls = 'on'
AS $fn$
 SELECT public.baitly_team_covers(p_team_id,p_country,p_department,p_arrondissement,p_city)
 OR EXISTS (SELECT 1 FROM public.teams t JOIN public.marketplace_providers p ON p.user_id=t.personal_user_id
   WHERE t.id=p_team_id
   AND public.baitly_within_radius(p.latitude::double precision,p.longitude::double precision,
     p.travel_radius_km,p_lat,p_lon))
$fn$;
