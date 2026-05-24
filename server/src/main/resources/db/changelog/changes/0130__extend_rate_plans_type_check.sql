-- ============================================================================
-- 0130 : Extension du CHECK constraint rate_plans.type aux 9 valeurs de l'enum
-- ----------------------------------------------------------------------------
-- Contexte : la table rate_plans a ete creee en migration 0047 avec un CHECK
-- limite a 4 valeurs ('BASE','SEASONAL','PROMOTIONAL','LAST_MINUTE'), alors
-- que l'enum Java {@code RatePlanType} en defini 9 :
--
--   BASE, SEASONAL, PROMOTIONAL, LAST_MINUTE,
--   EARLY_BIRD, WEEKEND, LONG_STAY, OCCUPANCY_BASED, EVENT
--
-- Toute tentative d'insertion d'une des 5 dernieres valeurs cause un crash
-- {@code constraint violation} au runtime (latent bug pre-existant).
--
-- Cette migration etend le CHECK pour matcher l'enum Java. Cas d'usage immediat
-- (Phase 1 OTA pricing) : creation automatique de RatePlan(type=WEEKEND) a
-- l'import Channex pour le prix vendredi-dimanche.
-- ============================================================================

ALTER TABLE rate_plans DROP CONSTRAINT IF EXISTS rate_plans_type_check;

ALTER TABLE rate_plans ADD CONSTRAINT rate_plans_type_check
    CHECK (type IN (
        'BASE',
        'SEASONAL',
        'PROMOTIONAL',
        'LAST_MINUTE',
        'EARLY_BIRD',
        'WEEKEND',
        'LONG_STAY',
        'OCCUPANCY_BASED',
        'EVENT'
    ));

COMMENT ON COLUMN rate_plans.type IS
    'Type de plan tarifaire : BASE | SEASONAL | PROMOTIONAL | LAST_MINUTE | '
    'EARLY_BIRD | WEEKEND | LONG_STAY | OCCUPANCY_BASED | EVENT. '
    'Ordre de priorite resolution PriceEngine : PROMOTIONAL > SEASONAL > '
    'LAST_MINUTE > BASE > Property.nightlyPrice.';
