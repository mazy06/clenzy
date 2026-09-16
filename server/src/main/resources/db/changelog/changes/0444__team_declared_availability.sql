-- Baitly : verdict de disponibilité déclaré, commun aux organisations clientes.
-- Comme baitly_assignment_conflicts, le contexte élargi reste local à la fonction.
-- SECURITY INVOKER conserve les privilèges du rôle ; aucune donnée d'absence ne sort.
CREATE OR REPLACE FUNCTION public.baitly_team_declared_available(
    p_team_id bigint, p_start timestamp, p_finish timestamp
) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public
SET app.bypass_rls = 'on'
AS $function$
    SELECT CASE WHEN p_team_id IS NULL OR p_start IS NULL OR p_finish IS NULL OR p_finish <= p_start
        THEN false
        ELSE NOT EXISTS (
            SELECT 1 FROM public.team_absences a
            WHERE a.team_id = p_team_id
              AND a.start_date <= CASE WHEN p_finish::time = TIME '00:00'
                  THEN p_finish::date - 1 ELSE p_finish::date END
              AND a.end_date >= p_start::date
        ) AND (
            NOT EXISTS (SELECT 1 FROM public.team_weekly_availability w WHERE w.team_id = p_team_id)
            OR (p_start::date = p_finish::date AND EXISTS (
                SELECT 1 FROM public.team_weekly_availability w
                WHERE w.team_id = p_team_id
                  AND w.day_of_week = EXTRACT(ISODOW FROM p_start)
                  AND w.start_time <= p_start::time AND w.end_time >= p_finish::time
            ))
        )
    END
$function$;
