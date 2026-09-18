-- Baitly : projections calculées, aucune seconde écriture des indicateurs.
CREATE OR REPLACE FUNCTION public.baitly_provider_completed_missions(p_id bigint)
RETURNS integer LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public SET app.bypass_rls = 'on'
AS $fn$
 SELECT count(DISTINCT i.id)::integer
 FROM public.marketplace_quote_requests q
 JOIN public.marketplace_providers p ON p.id=q.marketplace_provider_id
 JOIN public.interventions i ON i.id=q.intervention_id AND i.organization_id=q.requester_organization_id
 WHERE p.id=p_id AND q.status='ACCEPTED' AND i.status='COMPLETED'
 AND ((q.provider_team_id IS NOT NULL AND i.assigned_user_id IS NULL AND i.team_id=q.provider_team_id)
   OR (q.provider_team_id IS NULL AND i.team_id IS NULL AND i.assigned_user_id=p.user_id))
$fn$;

CREATE OR REPLACE FUNCTION public.baitly_provider_response_metrics(p_ids bigint[])
RETURNS TABLE(provider_id bigint, positive_response_pct numeric, response_minutes integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog, public
AS $fn$
 SELECT q.marketplace_provider_id,
   round(100.0 * count(*) FILTER (WHERE q.quoted_at IS NOT NULL)
      / NULLIF(count(*) FILTER (WHERE q.quoted_at IS NOT NULL OR q.status='TURNED_DOWN'),0),2),
   round(avg(EXTRACT(epoch FROM (
     CASE WHEN q.quoted_at IS NOT NULL THEN q.quoted_at
          WHEN q.status='TURNED_DOWN' THEN q.decided_at END - q.created_at))/60)
     FILTER (WHERE COALESCE(q.quoted_at, CASE WHEN q.status='TURNED_DOWN' THEN q.decided_at END) >= q.created_at))::integer
 FROM public.marketplace_quote_requests q WHERE q.marketplace_provider_id=ANY(p_ids)
 GROUP BY q.marketplace_provider_id
$fn$;
