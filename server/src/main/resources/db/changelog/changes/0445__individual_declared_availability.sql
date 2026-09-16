-- Baitly : une attribution individuelle respecte les déclarations de ses équipes personnelles.
-- Un booléen uniquement ; aucune donnée de mission ou d'absence n'est exposée.
CREATE OR REPLACE FUNCTION public.baitly_user_declared_available(
    p_user_id bigint, p_start timestamp, p_finish timestamp
) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public
SET app.bypass_rls = 'on'
AS $function$
    SELECT CASE WHEN p_user_id IS NULL OR p_user_id <= 0 OR p_start IS NULL
            OR p_finish IS NULL OR p_finish <= p_start THEN false
        ELSE NOT EXISTS (
            SELECT 1 FROM public.teams t
            WHERE t.personal_user_id = p_user_id
              AND NOT public.baitly_team_declared_available(t.id, p_start, p_finish)
        )
    END
$function$;
