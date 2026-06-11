-- 0227 : lead time sur les rate plans (audit Z5-BUGS-05).
--
-- Contexte : les types LAST_MINUTE (« booking proche check-in ») et EARLY_BIRD
-- (« reservation X jours a l'avance ») etaient resolus par le PriceEngine sans
-- aucune condition de delai entre la date de resolution et la date du sejour :
-- un plan LAST_MINUTE (prix brade) s'appliquait a TOUTES les dates, meme
-- reservees 6 mois a l'avance.
--
-- Nouvelles colonnes (nullables, aucune donnee migree) :
--   - min_lead_days : delai minimum (jours) entre aujourd'hui et le sejour
--                     pour que le plan s'applique (semantique EARLY_BIRD).
--   - max_lead_days : delai maximum (jours) entre aujourd'hui et le sejour
--                     pour que le plan s'applique (semantique LAST_MINUTE).
--
-- Si les deux bornes sont NULL, le PriceEngine applique une fenetre par defaut
-- documentee : LAST_MINUTE <= 7 jours, EARLY_BIRD >= 30 jours
-- (constantes DEFAULT_LAST_MINUTE_MAX_LEAD_DAYS / DEFAULT_EARLY_BIRD_MIN_LEAD_DAYS).
--
-- Nota « source » : la tracabilite de la source des prix (overrides MANUAL crees
-- par CalendarEngine.updateManualPrice — audit Z5-BUGS-04 — et exposition de la
-- source via PriceEngine.resolvePriceRangeWithSource — audit T-ARCH-04) s'appuie
-- sur la colonne rate_overrides.source DEJA existante : aucun changement de
-- schema supplementaire n'est requis.
--
-- Changeset idempotent : ADD COLUMN IF NOT EXISTS.

ALTER TABLE rate_plans ADD COLUMN IF NOT EXISTS min_lead_days INTEGER;
ALTER TABLE rate_plans ADD COLUMN IF NOT EXISTS max_lead_days INTEGER;

COMMENT ON COLUMN rate_plans.min_lead_days IS
    'Delai minimum (jours) entre la date de resolution et la date du sejour pour que le plan s''applique (EARLY_BIRD). NULL = fenetre par defaut du PriceEngine.';
COMMENT ON COLUMN rate_plans.max_lead_days IS
    'Delai maximum (jours) entre la date de resolution et la date du sejour pour que le plan s''applique (LAST_MINUTE). NULL = fenetre par defaut du PriceEngine.';
