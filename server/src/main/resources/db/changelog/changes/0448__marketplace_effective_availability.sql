-- Baitly : la semaine PMS remplace la candidature dès qu'une équipe personnelle existe.
-- Les fonctions ne rendent qu'un verdict ; le contexte RLS élargi reste local à l'appel.
CREATE INDEX IF NOT EXISTS idx_teams_personal_availability ON public.teams(personal_user_id)
    WHERE personal_user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.baitly_user_weekly_available(
    p_user_id bigint, p_start timestamp, p_finish timestamp
) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public
SET app.bypass_rls = 'on'
AS $function$
    SELECT CASE WHEN p_user_id IS NULL OR p_user_id <= 0 OR p_start IS NULL
        OR p_finish IS NULL OR p_finish <= p_start THEN false
    WHEN EXISTS (SELECT 1 FROM public.teams WHERE personal_user_id = p_user_id) THEN
        NOT EXISTS (
            SELECT 1 FROM public.teams t WHERE t.personal_user_id = p_user_id
            AND EXISTS (SELECT 1 FROM public.team_weekly_availability w WHERE w.team_id = t.id)
            AND NOT (p_start::date = p_finish::date AND EXISTS (
                SELECT 1 FROM public.team_weekly_availability w WHERE w.team_id = t.id
                AND w.day_of_week = EXTRACT(ISODOW FROM p_start)
                AND w.start_time <= p_start::time AND w.end_time >= p_finish::time
            ))
        )
    ELSE NOT EXISTS (
        SELECT 1 FROM public.marketplace_providers p WHERE p.user_id = p_user_id
        AND EXISTS (SELECT 1 FROM public.marketplace_provider_availability w WHERE w.provider_id = p.id)
        AND NOT (p_start::date = p_finish::date AND EXISTS (
            SELECT 1 FROM public.marketplace_provider_availability w WHERE w.provider_id = p.id
            AND w.day_of_week = EXTRACT(ISODOW FROM p_start)
            AND w.start_time <= p_start::time AND w.end_time >= p_finish::time
        ))
    ) END
$function$;

-- Une équipe personnelle réserve la même personne que l'attribution individuelle.
CREATE OR REPLACE FUNCTION public.baitly_team_declared_available(
    p_team_id bigint, p_start timestamp, p_finish timestamp
) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public
SET app.bypass_rls = 'on'
AS $function$
    SELECT CASE WHEN p_team_id IS NULL OR p_start IS NULL OR p_finish IS NULL OR p_finish <= p_start THEN false
    ELSE NOT EXISTS (
        SELECT 1 FROM public.team_absences a
        WHERE (a.team_id = p_team_id OR a.team_id IN (
            SELECT other.id FROM public.teams own JOIN public.teams other ON other.personal_user_id = own.personal_user_id
            WHERE own.id = p_team_id AND own.personal_user_id IS NOT NULL
        ))
        AND a.start_date <= CASE WHEN p_finish::time = TIME '00:00' THEN p_finish::date - 1 ELSE p_finish::date END
        AND a.end_date >= p_start::date
    ) AND CASE WHEN EXISTS (SELECT 1 FROM public.teams WHERE id = p_team_id AND personal_user_id IS NOT NULL)
        THEN public.baitly_user_weekly_available((SELECT personal_user_id FROM public.teams WHERE id = p_team_id), p_start, p_finish)
        ELSE NOT EXISTS (SELECT 1 FROM public.team_weekly_availability w WHERE w.team_id = p_team_id)
            OR (p_start::date = p_finish::date AND EXISTS (
                SELECT 1 FROM public.team_weekly_availability w WHERE w.team_id = p_team_id
                AND w.day_of_week = EXTRACT(ISODOW FROM p_start)
                AND w.start_time <= p_start::time AND w.end_time >= p_finish::time
            ))
        END
    END
$function$;

CREATE OR REPLACE FUNCTION public.baitly_user_declared_available(
    p_user_id bigint, p_start timestamp, p_finish timestamp
) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public
SET app.bypass_rls = 'on'
AS $function$
    SELECT public.baitly_user_weekly_available(p_user_id, p_start, p_finish)
        AND NOT EXISTS (
            SELECT 1 FROM public.teams t WHERE t.personal_user_id = p_user_id
            AND NOT public.baitly_team_declared_available(t.id, p_start, p_finish)
        )
$function$;

CREATE OR REPLACE FUNCTION public.baitly_provider_available_on_day(p_provider_id bigint, p_day integer)
RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public
SET app.bypass_rls = 'on'
AS $function$
    SELECT CASE WHEN p_day IS NULL OR p_day NOT BETWEEN 1 AND 7 THEN false ELSE EXISTS (
        SELECT 1 FROM public.marketplace_providers p WHERE p.id = p_provider_id AND (
            CASE WHEN p.user_id IS NULL THEN
                NOT EXISTS (SELECT 1 FROM public.marketplace_provider_availability w WHERE w.provider_id = p.id)
                OR EXISTS (SELECT 1 FROM public.marketplace_provider_availability w WHERE w.provider_id = p.id AND w.day_of_week = p_day)
            ELSE EXISTS (
                -- Toute intersection non vide commence au début d'un des créneaux.
                -- Le lundi de référence sert uniquement au jour ISO : pas d'absence datée ici.
                SELECT 1 FROM (
                    SELECT TIME '00:00' AS start_time
                    UNION SELECT w.start_time FROM public.team_weekly_availability w
                        JOIN public.teams t ON t.id = w.team_id
                        WHERE t.personal_user_id = p.user_id AND w.day_of_week = p_day
                    UNION SELECT w.start_time FROM public.marketplace_provider_availability w
                        JOIN public.marketplace_providers source ON source.id = w.provider_id
                        WHERE source.user_id = p.user_id AND w.day_of_week = p_day
                ) candidate
                WHERE public.baitly_user_weekly_available(p.user_id,
                    (DATE '2000-01-03' + (p_day - 1)) + candidate.start_time,
                    (DATE '2000-01-03' + (p_day - 1)) + candidate.start_time + INTERVAL '1 microsecond')
            ) END
        )
    ) END
$function$;
