-- Baitly : disponibilité globale, sans renvoyer de données des autres organisations.
-- SECURITY INVOKER conserve les privilèges SQL du rôle appelant.
-- Le SET de fonction est local à son appel : le contexte RLS est restauré ensuite,
-- sans exécuter de flush Hibernate ni de SQL applicatif avec un contexte élargi.
CREATE OR REPLACE FUNCTION public.baitly_assignment_conflicts(
    p_request_id bigint, p_intervention_id bigint, p_target_type text,
    p_target_id bigint, p_start timestamp, p_finish timestamp
) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY INVOKER
SET search_path = pg_catalog, public
SET app.bypass_rls = 'on'
AS $function$

            WITH candidate_users AS (
                SELECT CAST(p_target_id AS bigint) AS user_id WHERE p_target_type = 'user'
                UNION SELECT user_id FROM public.team_members WHERE p_target_type = 'team' AND team_id = p_target_id
            ), occupied AS (
                SELECT assigned_to_type AS kind, assigned_to_id AS target
                FROM public.service_requests
                WHERE id <> p_request_id AND assigned_to_id IS NOT NULL
                  AND status IN ('PENDING', 'ASSIGNED', 'AWAITING_PAYMENT', 'IN_PROGRESS')
                  AND desired_date < p_finish
                  AND desired_date + make_interval(hours => CASE WHEN estimated_duration_hours > 0
                      THEN estimated_duration_hours ELSE 4 END) > p_start
                UNION ALL
                SELECT 'team', team_id FROM public.interventions
                WHERE id <> p_intervention_id AND team_id IS NOT NULL AND (service_request_id IS NULL OR service_request_id <> p_request_id)
                  AND status IN ('PENDING', 'AWAITING_VALIDATION', 'AWAITING_PAYMENT', 'IN_PROGRESS')
                  AND scheduled_date < p_finish
                  AND scheduled_date + make_interval(hours => CASE WHEN estimated_duration_hours > 0
                      THEN estimated_duration_hours ELSE 4 END) > p_start
                UNION ALL
                SELECT 'user', assigned_user_id FROM public.interventions
                WHERE id <> p_intervention_id AND assigned_user_id IS NOT NULL AND (service_request_id IS NULL OR service_request_id <> p_request_id)
                  AND status IN ('PENDING', 'AWAITING_VALIDATION', 'AWAITING_PAYMENT', 'IN_PROGRESS')
                  AND scheduled_date < p_finish
                  AND scheduled_date + make_interval(hours => CASE WHEN estimated_duration_hours > 0
                      THEN estimated_duration_hours ELSE 4 END) > p_start
            )
            SELECT EXISTS (
                SELECT 1 FROM occupied o WHERE
                    (o.kind = p_target_type AND o.target = p_target_id)
                    OR (o.kind = 'user' AND o.target IN (SELECT user_id FROM candidate_users))
                    OR (o.kind = 'team' AND EXISTS (
                        SELECT 1 FROM public.team_members m WHERE m.team_id = o.target
                        AND m.user_id IN (SELECT user_id FROM candidate_users)))
            )

$function$;

CREATE OR REPLACE FUNCTION public.baitly_team_has_active_assignments(p_team_id bigint)
RETURNS boolean
LANGUAGE sql VOLATILE SECURITY INVOKER
SET search_path = pg_catalog, public
SET app.bypass_rls = 'on'
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM public.service_requests
        WHERE assigned_to_type = 'team' AND assigned_to_id = p_team_id
          AND status IN ('PENDING', 'ASSIGNED', 'AWAITING_PAYMENT', 'IN_PROGRESS')
        UNION ALL
        SELECT 1 FROM public.interventions WHERE team_id = p_team_id
          AND status IN ('PENDING', 'AWAITING_VALIDATION', 'AWAITING_PAYMENT', 'IN_PROGRESS')
    )
$function$;
