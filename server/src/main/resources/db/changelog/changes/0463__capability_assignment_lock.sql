-- Baitly : une capacité personnelle ne peut disparaître pendant une mission affectée à l'utilisateur.
CREATE OR REPLACE FUNCTION public.baitly_team_has_active_assignments(p_team_id bigint)
RETURNS boolean
LANGUAGE sql VOLATILE SECURITY INVOKER
SET search_path = pg_catalog, public
SET app.bypass_rls = 'on'
AS $function$
    WITH affected_teams AS (
        SELECT id FROM public.teams WHERE id=p_team_id OR personal_user_id=
            (SELECT personal_user_id FROM public.teams WHERE id=p_team_id)
    )
    SELECT EXISTS (
        SELECT 1 FROM public.service_requests r
        WHERE (r.assigned_to_type='team' AND r.assigned_to_id IN (SELECT id FROM affected_teams)
          OR r.assigned_to_type='user' AND r.assigned_to_id IN
              (SELECT personal_user_id FROM public.teams WHERE id=p_team_id))
          AND r.status IN ('PENDING','ASSIGNED','AWAITING_PAYMENT','IN_PROGRESS')
          AND NOT EXISTS (SELECT 1 FROM public.interventions execution WHERE execution.service_request_id=r.id)
        UNION ALL
        SELECT 1 FROM public.interventions i
        WHERE (i.team_id IN (SELECT id FROM affected_teams) OR i.assigned_user_id IN
              (SELECT personal_user_id FROM public.teams WHERE id=p_team_id))
          AND i.status IN ('PENDING','AWAITING_VALIDATION','AWAITING_PAYMENT','IN_PROGRESS')
    )
$function$;
