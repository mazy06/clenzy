-- Baitly : une personne, un calendrier, indépendamment des organisations clientes.
SELECT set_config('app.calendar_migration_previous_bypass', COALESCE(current_setting('app.bypass_rls', true), ''), true);
SET LOCAL app.bypass_rls = 'on';

CREATE TABLE public.individual_calendars (
    user_id bigint PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    weekly_restricted boolean NOT NULL DEFAULT false
);
CREATE TABLE public.individual_weekly_availability (
    id bigserial PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES public.individual_calendars(user_id) ON DELETE CASCADE,
    day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    start_time time NOT NULL,
    end_time time NOT NULL CHECK (end_time > start_time),
    UNIQUE (user_id, day_of_week, start_time, end_time)
);
CREATE TABLE public.individual_absences (
    id bigserial PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES public.individual_calendars(user_id) ON DELETE CASCADE,
    start_date date NOT NULL,
    end_date date NOT NULL CHECK (end_date >= start_date),
    reason varchar(200)
);
CREATE INDEX idx_individual_absences_dates ON public.individual_absences(user_id, start_date, end_date);

-- La priorité historique est conservée : si une équipe personnelle existe,
-- les anciens horaires de candidature ne doivent pas ressusciter.
CREATE TEMP TABLE baitly_calendar_sources ON COMMIT DROP AS
SELECT t.personal_user_id AS user_id, 'team:' || t.id AS source,
       w.day_of_week, w.start_time, w.end_time
FROM public.teams t JOIN public.team_weekly_availability w ON w.team_id = t.id
WHERE t.personal_user_id IS NOT NULL
UNION ALL
SELECT p.user_id, 'candidate:' || p.id, w.day_of_week, w.start_time, w.end_time
FROM public.marketplace_providers p JOIN public.marketplace_provider_availability w ON w.provider_id = p.id
WHERE p.user_id IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM public.teams t WHERE t.personal_user_id = p.user_id);
CREATE INDEX ON baitly_calendar_sources(user_id, source, day_of_week, start_time, end_time);

INSERT INTO public.individual_calendars(user_id, weekly_restricted)
SELECT u.id, EXISTS (SELECT 1 FROM baitly_calendar_sources s WHERE s.user_id = u.id)
FROM public.users u WHERE EXISTS (SELECT 1 FROM public.teams t WHERE t.personal_user_id = u.id)
OR EXISTS (SELECT 1 FROM public.marketplace_providers p WHERE p.user_id = u.id);

-- Toute intersection maximale commence et finit sur une borne existante.
-- Ne pas fusionner les plages adjacentes : l'ancien moteur exigeait qu'une
-- plage unique couvre la mission entière. Une intersection vide reste restrictive.
WITH candidates AS (
    SELECT DISTINCT a.user_id, a.day_of_week, a.start_time, b.end_time
    FROM baitly_calendar_sources a JOIN baitly_calendar_sources b
      ON b.user_id = a.user_id AND b.day_of_week = a.day_of_week AND b.end_time > a.start_time
    WHERE NOT EXISTS (
        SELECT 1 FROM baitly_calendar_sources source WHERE source.user_id = a.user_id
        AND NOT EXISTS (SELECT 1 FROM baitly_calendar_sources cover
            WHERE cover.user_id = a.user_id AND cover.source = source.source
            AND cover.day_of_week = a.day_of_week
            AND cover.start_time <= a.start_time AND cover.end_time >= b.end_time)
    )
)
INSERT INTO public.individual_weekly_availability(user_id, day_of_week, start_time, end_time)
SELECT c.user_id, c.day_of_week, c.start_time, c.end_time FROM candidates c
WHERE NOT EXISTS (SELECT 1 FROM candidates outer_slot
    WHERE outer_slot.user_id = c.user_id AND outer_slot.day_of_week = c.day_of_week
    AND outer_slot.start_time <= c.start_time AND outer_slot.end_time >= c.end_time
    AND (outer_slot.start_time < c.start_time OR outer_slot.end_time > c.end_time));

INSERT INTO public.individual_absences(user_id, start_date, end_date, reason)
SELECT DISTINCT t.personal_user_id, a.start_date, a.end_date, a.reason
FROM public.team_absences a JOIN public.teams t ON t.id = a.team_id
WHERE t.personal_user_id IS NOT NULL;

DELETE FROM public.team_weekly_availability w USING public.teams t
WHERE w.team_id = t.id AND t.personal_user_id IS NOT NULL;
DELETE FROM public.team_absences a USING public.teams t
WHERE a.team_id = t.id AND t.personal_user_id IS NOT NULL;
DELETE FROM public.marketplace_provider_availability w USING public.marketplace_providers p
WHERE w.provider_id = p.id AND p.user_id IS NOT NULL;

-- Une candidature devient un calendrier une seule fois au rattachement.
-- Un compte qui possède déjà son calendrier le conserve, même s'il est vide.
CREATE FUNCTION public.baitly_promote_candidate_calendar() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public SET app.bypass_rls = 'on'
AS $function$
DECLARE inserted integer;
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.user_id IS NOT NULL AND OLD.user_id IS DISTINCT FROM NEW.user_id THEN
        RAISE EXCEPTION 'Un calendrier lié ne peut pas changer de propriétaire';
    END IF;
    IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('baitly:assignment:user:' || NEW.user_id, 0));
    INSERT INTO public.individual_calendars(user_id, weekly_restricted)
    VALUES (NEW.user_id, EXISTS (SELECT 1 FROM public.marketplace_provider_availability WHERE provider_id = NEW.id))
    ON CONFLICT (user_id) DO NOTHING;
    GET DIAGNOSTICS inserted = ROW_COUNT;
    IF inserted = 1 THEN
        INSERT INTO public.individual_weekly_availability(user_id, day_of_week, start_time, end_time)
        SELECT DISTINCT NEW.user_id, day_of_week, start_time, end_time
        FROM public.marketplace_provider_availability WHERE provider_id = NEW.id;
    END IF;
    DELETE FROM public.marketplace_provider_availability WHERE provider_id = NEW.id;
    RETURN NEW;
END
$function$;
CREATE TRIGGER trg_promote_candidate_calendar AFTER INSERT OR UPDATE OF user_id ON public.marketplace_providers
FOR EACH ROW EXECUTE FUNCTION public.baitly_promote_candidate_calendar();

-- Échec explicite pour un ancien écrivain : pas de synchronisation silencieuse.
CREATE FUNCTION public.baitly_reject_shadow_calendar() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public SET app.bypass_rls = 'on'
AS $function$
DECLARE owner_id bigint;
BEGIN
    IF TG_TABLE_NAME = 'marketplace_provider_availability' THEN
        -- Sérialise aussi avec le rattachement : une écriture de brouillon
        -- commencée avant l'activation ne doit pas survivre au transfert.
        SELECT user_id INTO owner_id FROM public.marketplace_providers WHERE id = NEW.provider_id FOR UPDATE;
    ELSE
        SELECT personal_user_id INTO owner_id FROM public.teams WHERE id = NEW.team_id FOR UPDATE;
    END IF;
    IF owner_id IS NOT NULL THEN RAISE EXCEPTION 'Utiliser le calendrier individuel canonique'; END IF;
    RETURN NEW;
END
$function$;
CREATE TRIGGER trg_no_personal_weekly BEFORE INSERT OR UPDATE ON public.team_weekly_availability
FOR EACH ROW EXECUTE FUNCTION public.baitly_reject_shadow_calendar();
CREATE TRIGGER trg_no_personal_absence BEFORE INSERT OR UPDATE ON public.team_absences
FOR EACH ROW EXECUTE FUNCTION public.baitly_reject_shadow_calendar();
CREATE TRIGGER trg_no_linked_candidate_weekly BEFORE INSERT OR UPDATE ON public.marketplace_provider_availability
FOR EACH ROW EXECUTE FUNCTION public.baitly_reject_shadow_calendar();

ALTER TABLE public.individual_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.individual_calendars FORCE ROW LEVEL SECURITY;
CREATE POLICY individual_calendar_owner ON public.individual_calendars
USING (user_id = NULLIF(current_setting('app.calendar_user', true), '')::bigint OR current_setting('app.bypass_rls', true) = 'on');
ALTER TABLE public.individual_weekly_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.individual_weekly_availability FORCE ROW LEVEL SECURITY;
CREATE POLICY individual_weekly_owner ON public.individual_weekly_availability
USING (user_id = NULLIF(current_setting('app.calendar_user', true), '')::bigint OR current_setting('app.bypass_rls', true) = 'on');
ALTER TABLE public.individual_absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.individual_absences FORCE ROW LEVEL SECURITY;
CREATE POLICY individual_absence_owner ON public.individual_absences
USING (user_id = NULLIF(current_setting('app.calendar_user', true), '')::bigint OR current_setting('app.bypass_rls', true) = 'on');

CREATE OR REPLACE FUNCTION public.baitly_user_weekly_available(p_user_id bigint, p_start timestamp, p_finish timestamp)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public SET app.bypass_rls = 'on'
AS $function$
    SELECT p_user_id IS NOT NULL AND p_user_id > 0 AND p_start IS NOT NULL AND p_finish IS NOT NULL AND p_finish > p_start
    AND (NOT EXISTS (SELECT 1 FROM public.individual_calendars c WHERE c.user_id = p_user_id AND c.weekly_restricted)
    OR (p_start::date = p_finish::date AND EXISTS (
        SELECT 1 FROM public.individual_weekly_availability w WHERE w.user_id = p_user_id
        AND w.day_of_week = EXTRACT(ISODOW FROM p_start)
        AND w.start_time <= p_start::time AND w.end_time >= p_finish::time)))
$function$;
CREATE OR REPLACE FUNCTION public.baitly_user_declared_available(p_user_id bigint, p_start timestamp, p_finish timestamp)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public SET app.bypass_rls = 'on'
AS $function$
    SELECT public.baitly_user_weekly_available(p_user_id, p_start, p_finish)
    AND NOT EXISTS (SELECT 1 FROM public.individual_absences a WHERE a.user_id = p_user_id
        AND a.start_date <= CASE WHEN p_finish::time = TIME '00:00' THEN p_finish::date - 1 ELSE p_finish::date END
        AND a.end_date >= p_start::date)
$function$;
CREATE OR REPLACE FUNCTION public.baitly_team_declared_available(p_team_id bigint, p_start timestamp, p_finish timestamp)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public SET app.bypass_rls = 'on'
AS $function$
    SELECT p_team_id IS NOT NULL AND p_start IS NOT NULL AND p_finish IS NOT NULL AND p_finish > p_start
    AND CASE WHEN EXISTS (SELECT 1 FROM public.teams WHERE id = p_team_id AND personal_user_id IS NOT NULL)
    THEN public.baitly_user_declared_available((SELECT personal_user_id FROM public.teams WHERE id = p_team_id), p_start, p_finish)
    ELSE NOT EXISTS (SELECT 1 FROM public.team_members m WHERE m.team_id = p_team_id
        AND NOT public.baitly_user_declared_available(m.user_id, p_start, p_finish))
    AND NOT EXISTS (SELECT 1 FROM public.team_absences a WHERE a.team_id = p_team_id
        AND a.start_date <= CASE WHEN p_finish::time = TIME '00:00' THEN p_finish::date - 1 ELSE p_finish::date END
        AND a.end_date >= p_start::date)
    AND (NOT EXISTS (SELECT 1 FROM public.team_weekly_availability w WHERE w.team_id = p_team_id)
        OR (p_start::date = p_finish::date AND EXISTS (
            SELECT 1 FROM public.team_weekly_availability w WHERE w.team_id = p_team_id
            AND w.day_of_week = EXTRACT(ISODOW FROM p_start)
            AND w.start_time <= p_start::time AND w.end_time >= p_finish::time))) END
$function$;
CREATE OR REPLACE FUNCTION public.baitly_provider_available_on_day(p_provider_id bigint, p_day integer)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public SET app.bypass_rls = 'on'
AS $function$
    SELECT p_day IS NOT NULL AND p_day BETWEEN 1 AND 7 AND EXISTS (SELECT 1 FROM public.marketplace_providers p WHERE p.id = p_provider_id
    AND CASE WHEN p.user_id IS NULL THEN
        NOT EXISTS (SELECT 1 FROM public.marketplace_provider_availability w WHERE w.provider_id = p.id)
        OR EXISTS (SELECT 1 FROM public.marketplace_provider_availability w WHERE w.provider_id = p.id AND w.day_of_week = p_day)
    ELSE NOT EXISTS (SELECT 1 FROM public.individual_calendars c WHERE c.user_id = p.user_id AND c.weekly_restricted)
        OR EXISTS (SELECT 1 FROM public.individual_weekly_availability w WHERE w.user_id = p.user_id AND w.day_of_week = p_day)
    END)
$function$;

CREATE FUNCTION public.baitly_provider_weekly_restricted(p_provider_id bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public SET app.bypass_rls = 'on'
AS $function$
    SELECT EXISTS (SELECT 1 FROM public.marketplace_providers p WHERE p.id = p_provider_id
        AND CASE WHEN p.user_id IS NULL THEN
            EXISTS (SELECT 1 FROM public.marketplace_provider_availability w WHERE w.provider_id = p.id)
        ELSE EXISTS (SELECT 1 FROM public.individual_calendars c WHERE c.user_id = p.user_id AND c.weekly_restricted) END)
$function$;

-- Projection publique des horaires, jamais des motifs d'absence.
CREATE FUNCTION public.baitly_provider_weekly(p_provider_ids bigint[])
RETURNS TABLE(id bigint, provider_id bigint, day_of_week smallint, start_time time, end_time time)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog, public SET app.bypass_rls = 'on'
AS $function$
    SELECT w.id, p.id, w.day_of_week, w.start_time, w.end_time
    FROM public.marketplace_providers p JOIN public.individual_weekly_availability w ON w.user_id = p.user_id
    WHERE p.id = ANY(p_provider_ids)
    UNION ALL
    SELECT w.id, p.id, w.day_of_week, w.start_time, w.end_time
    FROM public.marketplace_providers p JOIN public.marketplace_provider_availability w ON w.provider_id = p.id
    WHERE p.id = ANY(p_provider_ids) AND p.user_id IS NULL
$function$;
SELECT set_config('app.bypass_rls', current_setting('app.calendar_migration_previous_bypass'), true);
