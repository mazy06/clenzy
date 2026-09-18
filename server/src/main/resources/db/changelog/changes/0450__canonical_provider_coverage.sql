-- Baitly : les zones suivent la personne, jamais ses organisations clientes.
SELECT set_config('app.coverage_previous_bypass', COALESCE(current_setting('app.bypass_rls', true), ''), true);
SET LOCAL app.bypass_rls = 'on';

CREATE TABLE public.individual_coverage_profiles (
    user_id bigint PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE
);
ALTER TABLE public.marketplace_provider_zones ALTER COLUMN provider_id DROP NOT NULL;
ALTER TABLE public.marketplace_provider_zones ADD COLUMN user_id bigint REFERENCES public.individual_coverage_profiles(user_id) ON DELETE CASCADE;
ALTER TABLE public.marketplace_provider_zones ADD COLUMN arrondissement varchar(5);
ALTER TABLE public.marketplace_provider_zones ALTER COLUMN city TYPE varchar(100);
ALTER TABLE public.marketplace_provider_zones ADD CONSTRAINT ck_coverage_single_owner CHECK (num_nonnulls(provider_id, user_id) = 1);
CREATE INDEX idx_provider_coverage_user ON public.marketplace_provider_zones(user_id) WHERE user_id IS NOT NULL;

INSERT INTO public.individual_coverage_profiles(user_id)
SELECT personal_user_id FROM public.teams WHERE personal_user_id IS NOT NULL
UNION SELECT user_id FROM public.marketplace_providers WHERE user_id IS NOT NULL;

-- Les déclarations PMS positives sont réunies, en conservant leur précision.
-- Si une équipe personnelle existe, ne pas ressusciter les zones d'une ancienne candidature.
DELETE FROM public.marketplace_provider_zones z USING public.marketplace_providers p
WHERE z.provider_id = p.id AND p.user_id IS NOT NULL
AND EXISTS (SELECT 1 FROM public.teams t WHERE t.personal_user_id = p.user_id);
UPDATE public.marketplace_provider_zones z SET user_id = p.user_id, provider_id = NULL
FROM public.marketplace_providers p WHERE z.provider_id = p.id AND p.user_id IS NOT NULL;
INSERT INTO public.marketplace_provider_zones(user_id, country_code, department, arrondissement, city, is_primary, created_at)
SELECT DISTINCT t.personal_user_id, upper(z.country), z.department, z.arrondissement, z.city, false, CURRENT_TIMESTAMP
FROM public.team_coverage_zones z JOIN public.teams t ON t.id = z.team_id WHERE t.personal_user_id IS NOT NULL;
DELETE FROM public.team_coverage_zones z USING public.teams t WHERE z.team_id = t.id AND t.personal_user_id IS NOT NULL;
DELETE FROM public.marketplace_provider_zones z USING (
    SELECT id, row_number() OVER (PARTITION BY user_id, country_code, department, arrondissement, city, postal_code, radius_km
        ORDER BY is_primary DESC, id) AS duplicate_number
    FROM public.marketplace_provider_zones WHERE user_id IS NOT NULL
) duplicate WHERE z.id = duplicate.id AND duplicate.duplicate_number > 1;

CREATE FUNCTION public.baitly_promote_candidate_coverage() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public SET app.bypass_rls = 'on'
AS $function$
DECLARE inserted integer;
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.user_id IS NOT NULL AND OLD.user_id IS DISTINCT FROM NEW.user_id THEN
        RAISE EXCEPTION 'Les zones liées ne peuvent pas changer de propriétaire';
    END IF;
    IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('baitly:coverage:user:' || NEW.user_id, 0));
    INSERT INTO public.individual_coverage_profiles(user_id) VALUES (NEW.user_id) ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS inserted = ROW_COUNT;
    IF inserted = 1 THEN
        UPDATE public.marketplace_provider_zones SET user_id = NEW.user_id, provider_id = NULL WHERE provider_id = NEW.id;
    ELSE
        DELETE FROM public.marketplace_provider_zones WHERE provider_id = NEW.id;
    END IF;
    RETURN NEW;
END
$function$;
CREATE TRIGGER trg_promote_candidate_coverage AFTER INSERT OR UPDATE OF user_id ON public.marketplace_providers
FOR EACH ROW EXECUTE FUNCTION public.baitly_promote_candidate_coverage();

CREATE FUNCTION public.baitly_reject_shadow_coverage() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public SET app.bypass_rls = 'on'
AS $function$
DECLARE owner_id bigint;
BEGIN
    IF TG_TABLE_NAME = 'marketplace_provider_zones' THEN
        IF NEW.provider_id IS NULL THEN RETURN NEW; END IF;
        SELECT user_id INTO owner_id FROM public.marketplace_providers WHERE id = NEW.provider_id FOR UPDATE;
    ELSE
        SELECT personal_user_id INTO owner_id FROM public.teams WHERE id = NEW.team_id FOR UPDATE;
    END IF;
    IF owner_id IS NOT NULL THEN RAISE EXCEPTION 'Utiliser les zones canoniques du prestataire'; END IF;
    RETURN NEW;
END
$function$;
CREATE TRIGGER trg_no_personal_coverage BEFORE INSERT OR UPDATE ON public.team_coverage_zones
FOR EACH ROW EXECUTE FUNCTION public.baitly_reject_shadow_coverage();
CREATE TRIGGER trg_no_linked_candidate_coverage BEFORE INSERT OR UPDATE ON public.marketplace_provider_zones
FOR EACH ROW EXECUTE FUNCTION public.baitly_reject_shadow_coverage();

-- Même zone pour l'attribution à une équipe personnelle et la fiche du catalogue.
-- Ne rend qu'un verdict, sans exposer la composition d'une équipe d'une autre organisation.
CREATE FUNCTION public.baitly_team_covers(p_team_id bigint, p_country text, p_department text, p_arrondissement text, p_city text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public SET app.bypass_rls = 'on'
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM (
            SELECT z.country_code AS country, z.department, z.arrondissement, z.city
            FROM public.teams t JOIN public.marketplace_provider_zones z ON z.user_id = t.personal_user_id WHERE t.id = p_team_id
            UNION ALL
            SELECT z.country, z.department, z.arrondissement, z.city
            FROM public.teams t JOIN public.team_coverage_zones z ON z.team_id = t.id
            WHERE t.id = p_team_id AND t.personal_user_id IS NULL
        ) zone
        WHERE upper(zone.country) = upper(p_country)
        AND CASE WHEN upper(p_country) = 'FR' THEN zone.department = p_department
            AND (zone.arrondissement IS NULL OR zone.arrondissement = p_arrondissement)
        ELSE lower(zone.city) = lower(p_city) END
    )
$function$;
COMMENT ON TABLE public.marketplace_provider_zones IS
    'Source unique des zones individuelles : user_id après activation, provider_id uniquement pour une candidature sans compte.';
SELECT set_config('app.bypass_rls', current_setting('app.coverage_previous_bypass'), true);
