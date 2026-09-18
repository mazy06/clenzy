-- Baitly : les propositions expirées ne réservent plus de créneau, même avant le passage du scheduler.
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
                  AND (assignment_phase IS NULL OR EXISTS (
                    SELECT 1 FROM public.service_assignment_proposals proposal
                    WHERE proposal.request_id=service_requests.id AND proposal.status='PENDING'
                      AND proposal.expires_at>CURRENT_TIMESTAMP))
                  -- Dès qu'une exécution existe, elle seule réserve les ressources.
                  AND NOT EXISTS (SELECT 1 FROM public.interventions execution WHERE execution.service_request_id=service_requests.id)
                  AND NOT EXISTS (SELECT 1 FROM public.marketplace_service_items item WHERE item.code=service_requests.service_item_code AND NOT item.slot_required)
                  AND desired_date < p_finish
                  AND desired_date + make_interval(hours => CASE WHEN estimated_duration_hours > 0
                      THEN estimated_duration_hours ELSE 4 END) > p_start
                UNION ALL
                SELECT 'team', team_id FROM public.interventions
                WHERE id <> p_intervention_id AND team_id IS NOT NULL AND (service_request_id IS NULL OR service_request_id <> p_request_id)
                  AND status IN ('PENDING', 'AWAITING_VALIDATION', 'AWAITING_PAYMENT', 'IN_PROGRESS')
                  AND NOT EXISTS (SELECT 1 FROM public.marketplace_service_items item WHERE item.code=interventions.service_item_code AND NOT item.slot_required)
                  AND scheduled_date < p_finish
                  AND scheduled_date + make_interval(hours => CASE WHEN estimated_duration_hours > 0
                      THEN estimated_duration_hours ELSE 4 END) > p_start
                UNION ALL
                SELECT 'user', assigned_user_id FROM public.interventions
                WHERE id <> p_intervention_id AND assigned_user_id IS NOT NULL AND (service_request_id IS NULL OR service_request_id <> p_request_id)
                  AND status IN ('PENDING', 'AWAITING_VALIDATION', 'AWAITING_PAYMENT', 'IN_PROGRESS')
                  AND NOT EXISTS (SELECT 1 FROM public.marketplace_service_items item WHERE item.code=interventions.service_item_code AND NOT item.slot_required)
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
