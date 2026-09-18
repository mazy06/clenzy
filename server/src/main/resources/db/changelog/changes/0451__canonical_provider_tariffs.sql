-- Baitly : un prix public par personne et prestation. Aucun tarif propre à un client.
-- Les prix contractuels (devis/interventions) restent intacts.
SELECT set_config('baitly.pricing_previous_bypass', COALESCE(current_setting('app.bypass_rls', true), ''), true);
SELECT set_config('app.bypass_rls', 'on', true);

CREATE TABLE provider_tariffs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_key VARCHAR(200) NOT NULL,
    pricing_model VARCHAR(20) NOT NULL,
    amount NUMERIC(10,2),
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    unit_label VARCHAR(40),
    enabled BOOLEAN NOT NULL DEFAULT true,
    needs_review BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT uq_provider_tariff UNIQUE(user_id, service_key),
    CONSTRAINT ck_provider_tariff_price CHECK (
      (pricing_model='ON_QUOTE' AND amount IS NULL) OR
      (pricing_model IN ('HOURLY','FLAT','PER_UNIT','PER_SQM') AND amount IS NOT NULL AND amount BETWEEN 0 AND 1000000)),
    CONSTRAINT ck_provider_tariff_unit CHECK (pricing_model <> 'PER_UNIT' OR (unit_label IS NOT NULL AND btrim(unit_label)<>'')),
    CONSTRAINT ck_provider_tariff_currency CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT ck_provider_tariff_review CHECK (NOT needs_review OR (amount IS NULL AND pricing_model='ON_QUOTE'))
);

-- Archive privée de migration, jamais consultée pour déterminer un prix courant.
CREATE TABLE provider_tariff_migration_archive (
    id BIGSERIAL PRIMARY KEY, source_table TEXT NOT NULL, source_id BIGINT NOT NULL,
    payload JSONB NOT NULL, archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(source_table, source_id)
);
ALTER TABLE provider_tariff_migration_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_tariff_migration_archive FORCE ROW LEVEL SECURITY;
CREATE POLICY provider_tariff_archive_internal ON provider_tariff_migration_archive
    USING (current_setting('app.bypass_rls', true)='on');

INSERT INTO provider_tariff_migration_archive(source_table,source_id,payload)
SELECT 'technician_prestations', id, to_jsonb(t) FROM technician_prestations t;
INSERT INTO provider_tariff_migration_archive(source_table,source_id,payload)
SELECT 'housekeeper_rates', id, to_jsonb(t) FROM housekeeper_rates t;
INSERT INTO provider_tariff_migration_archive(source_table,source_id,payload)
SELECT 'marketplace_provider_services', s.id, to_jsonb(s)
FROM marketplace_provider_services s JOIN marketplace_providers p ON p.id=s.provider_id WHERE p.user_id IS NOT NULL;

CREATE FUNCTION public.baitly_tariff_key(p_type TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
SELECT CASE p_type
WHEN 'CLEANING' THEN 'cleaning-turnover'
WHEN 'DEEP_CLEANING' THEN 'cleaning-deep'
WHEN 'WINDOW_CLEANING' THEN 'cleaning-windows'
WHEN 'DISINFECTION' THEN 'cleaning-disinfection'
WHEN 'PLUMBING_REPAIR' THEN 'maintenance-plumbing'
WHEN 'ELECTRICAL_REPAIR' THEN 'maintenance-electrical'
WHEN 'HVAC_REPAIR' THEN 'maintenance-hvac'
WHEN 'APPLIANCE_REPAIR' THEN 'maintenance-appliance'
WHEN 'PREVENTIVE_MAINTENANCE' THEN 'maintenance-preventive'
WHEN 'EMERGENCY_REPAIR' THEN 'maintenance-emergency'
WHEN 'GARDENING' THEN 'exterior-garden'
WHEN 'EXTERIOR_CLEANING' THEN 'exterior-terrace'
WHEN 'PEST_CONTROL' THEN 'pest-insects'
WHEN 'RESTORATION' THEN 'renovation-painting'
ELSE 'type:' || p_type END
$$;

ALTER TABLE marketplace_provider_services ADD COLUMN tariff_id BIGINT REFERENCES provider_tariffs(id);
CREATE INDEX idx_mp_service_tariff ON marketplace_provider_services(tariff_id);

CREATE FUNCTION public.baitly_offer_tariff_key(p_item BIGINT, p_category BIGINT, p_label TEXT) RETURNS TEXT
LANGUAGE sql STABLE AS $$
SELECT COALESCE((SELECT code FROM marketplace_service_items WHERE id=p_item),
    'custom:' || p_category::text || ':' || lower(btrim(p_label)))
$$;

-- Pas de devise inventée pour les anciens prix PMS, qui n'en stockaient aucune.
-- Le prestataire devra confirmer le prix et sa devise dans le tarif unique.
WITH sources AS (
 SELECT user_id, public.baitly_tariff_key(intervention_type) AS service_key,
   'FLAT'::text AS model, base_price::numeric AS amount, NULL::text AS currency, NULL::text AS unit_label, enabled
 FROM technician_prestations
 UNION ALL
 SELECT user_id, 'cleaning-turnover', 'HOURLY', amount, NULL::text, NULL::text, true
 FROM housekeeper_rates WHERE property_id IS NULL AND unit='HOURLY'
 UNION ALL
 SELECT p.user_id, public.baitly_offer_tariff_key(s.service_item_id,s.category_id,s.label),
   s.pricing_model, s.amount, s.currency, s.unit_label, s.active
 FROM marketplace_provider_services s JOIN marketplace_providers p ON p.id=s.provider_id
 WHERE p.user_id IS NOT NULL
), grouped AS (
 SELECT user_id,service_key, min(model) model,min(amount) amount,min(currency) currency,min(unit_label) unit_label,
   bool_or(enabled) enabled,
   bool_or(currency IS NULL OR currency !~ '^[A-Z]{3}$'
     OR (model='PER_UNIT' AND (unit_label IS NULL OR btrim(unit_label)=''))
     -- Un montant absent est normal pour ON_QUOTE : ne pas propager NULL dans review.
     OR (amount IS NOT NULL AND (amount < 0 OR amount > 1000000)))
     OR count(DISTINCT ROW(model,amount,currency,unit_label)) > 1 AS review
 FROM sources GROUP BY user_id,service_key
)
INSERT INTO provider_tariffs(user_id,service_key,pricing_model,amount,currency,unit_label,enabled,needs_review)
SELECT user_id,service_key,
 CASE WHEN review OR amount IS NULL THEN 'ON_QUOTE' ELSE model END,
 CASE WHEN review OR model='ON_QUOTE' THEN NULL ELSE amount END,
 CASE WHEN currency ~ '^[A-Z]{3}$' THEN currency ELSE 'EUR' END,CASE WHEN review THEN NULL ELSE unit_label END,enabled,review
FROM grouped;

UPDATE marketplace_provider_services s SET tariff_id=t.id, amount=NULL,pricing_model='ON_QUOTE',currency='EUR',unit_label=NULL
FROM marketplace_providers p, provider_tariffs t
WHERE p.id=s.provider_id AND t.user_id=p.user_id
AND t.service_key=public.baitly_offer_tariff_key(s.service_item_id,s.category_id,s.label);

DELETE FROM technician_prestations;
DELETE FROM housekeeper_rates;

CREATE FUNCTION public.baitly_reject_legacy_tariff_write() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Use the unique provider tariff; client and property prices are retired' USING ERRCODE='23514';
END $$;
CREATE TRIGGER no_shadow_technician_tariff BEFORE INSERT OR UPDATE ON technician_prestations
FOR EACH ROW EXECUTE FUNCTION public.baitly_reject_legacy_tariff_write();
CREATE TRIGGER no_shadow_housekeeper_tariff BEFORE INSERT OR UPDATE ON housekeeper_rates
FOR EACH ROW EXECUTE FUNCTION public.baitly_reject_legacy_tariff_write();

-- Candidate drafts are transferred once. Existing canonical values always win.
CREATE FUNCTION public.baitly_attach_offer_tariff() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public AS $$
DECLARE owner_id BIGINT; target_id BIGINT; key TEXT;
BEGIN
 SELECT user_id INTO owner_id FROM public.marketplace_providers WHERE id=NEW.provider_id FOR UPDATE;
 IF owner_id IS NULL THEN
   IF NEW.tariff_id IS NOT NULL THEN RAISE EXCEPTION 'Candidate cannot reference a user tariff' USING ERRCODE='23514'; END IF;
   RETURN NEW;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('baitly:tariff:user:' || owner_id::text,0));
 key := public.baitly_offer_tariff_key(NEW.service_item_id,NEW.category_id,NEW.label);
 IF NEW.tariff_id IS NOT NULL THEN
   IF NOT EXISTS(SELECT 1 FROM public.provider_tariffs WHERE id=NEW.tariff_id AND user_id=owner_id) THEN
     RAISE EXCEPTION 'Tariff owner mismatch' USING ERRCODE='23514';
   END IF;
   target_id := NEW.tariff_id;
 ELSE
   INSERT INTO public.provider_tariffs(user_id,service_key,pricing_model,amount,currency,unit_label)
   VALUES(owner_id,key,CASE WHEN NEW.amount IS NULL THEN 'ON_QUOTE' ELSE NEW.pricing_model END,
          CASE WHEN NEW.pricing_model='ON_QUOTE' THEN NULL ELSE NEW.amount END,NEW.currency,NEW.unit_label)
   ON CONFLICT(user_id,service_key) DO NOTHING;
   SELECT id INTO target_id FROM public.provider_tariffs WHERE user_id=owner_id AND service_key=key;
 END IF;
 IF TG_OP='UPDATE' AND OLD.tariff_id IS NOT NULL AND
    (NEW.amount IS NOT NULL OR NEW.pricing_model<>'ON_QUOTE' OR NEW.currency<>'EUR' OR NEW.unit_label IS NOT NULL) THEN
   RAISE EXCEPTION 'Edit the unique tariff instead of an offer price' USING ERRCODE='23514';
 END IF;
 NEW.tariff_id:=target_id; NEW.amount:=NULL; NEW.pricing_model:='ON_QUOTE'; NEW.currency:='EUR'; NEW.unit_label:=NULL;
 RETURN NEW;
END $$;
CREATE TRIGGER attach_offer_tariff BEFORE INSERT OR UPDATE ON marketplace_provider_services
FOR EACH ROW EXECUTE FUNCTION public.baitly_attach_offer_tariff();

CREATE FUNCTION public.baitly_activate_provider_tariffs() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public AS $$
DECLARE previous_bypass TEXT := COALESCE(current_setting('app.bypass_rls',true),'');
BEGIN
 IF TG_OP='UPDATE' AND OLD.user_id IS NOT NULL AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
   RAISE EXCEPTION 'A linked provider cannot change identity' USING ERRCODE='23514';
 END IF;
 IF NEW.user_id IS NOT NULL THEN
   PERFORM pg_advisory_xact_lock(hashtextextended('baitly:tariff:user:' || NEW.user_id::text,0));
   -- Aggregate a whole candidacy before attaching individual rows: no arbitrary first price.
   PERFORM set_config('app.bypass_rls','on',true);
   INSERT INTO public.provider_tariff_migration_archive(source_table,source_id,payload)
   SELECT 'marketplace_provider_services',s.id,to_jsonb(s) FROM public.marketplace_provider_services s
   WHERE s.provider_id=NEW.id AND s.tariff_id IS NULL ON CONFLICT DO NOTHING;
   PERFORM set_config('app.bypass_rls',previous_bypass,true);
   WITH grouped AS (
     SELECT public.baitly_offer_tariff_key(service_item_id,category_id,label) service_key,
       min(pricing_model) model,min(amount) amount,min(currency) currency,min(unit_label) unit_label,
       bool_or(active) enabled,
       count(DISTINCT ROW(pricing_model,amount,currency,unit_label)) > 1
         OR bool_or(currency IS NULL OR currency !~ '^[A-Z]{3}$'
             OR (amount IS NOT NULL AND (amount<0 OR amount>1000000))
             OR (pricing_model='PER_UNIT' AND (unit_label IS NULL OR btrim(unit_label)=''))) review
     FROM public.marketplace_provider_services WHERE provider_id=NEW.id AND tariff_id IS NULL
     GROUP BY public.baitly_offer_tariff_key(service_item_id,category_id,label)
   )
   INSERT INTO public.provider_tariffs(user_id,service_key,pricing_model,amount,currency,unit_label,enabled,needs_review)
   SELECT NEW.user_id,service_key,CASE WHEN review OR amount IS NULL THEN 'ON_QUOTE' ELSE model END,
     CASE WHEN review OR model='ON_QUOTE' THEN NULL ELSE amount END,
     CASE WHEN currency ~ '^[A-Z]{3}$' THEN currency ELSE 'EUR' END,
     CASE WHEN review THEN NULL ELSE unit_label END,enabled,review FROM grouped
   ON CONFLICT(user_id,service_key) DO NOTHING;
   UPDATE public.marketplace_provider_services SET provider_id=NEW.id WHERE provider_id=NEW.id AND tariff_id IS NULL;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER activate_provider_tariffs AFTER INSERT OR UPDATE OF user_id ON marketplace_providers
FOR EACH ROW EXECUTE FUNCTION public.baitly_activate_provider_tariffs();

SELECT set_config('app.bypass_rls', current_setting('baitly.pricing_previous_bypass'), true);
