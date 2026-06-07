-- ============================================================================
-- 0204 : Taux de monétisation par org (org_monetization_config) — 2 niveaux
-- ============================================================================
-- Deux niveaux d'accès :
--   • Commission PLATEFORME (staff-only) : upsell_platform_fee_pct,
--     activity_platform_commission_pct.
--   • Commission ORG/conciergerie (éditable par l'org) sur le reste après
--     plateforme : upsell_org_commission_pct, activity_org_commission_pct.
-- Valeurs NULL = défaut global. L'hôte reçoit le solde après plateforme + org.
-- Idempotent (IF NOT EXISTS). 0204 jamais déployé → schéma final ici.
-- ============================================================================

CREATE TABLE IF NOT EXISTS org_monetization_config (
    id                               BIGSERIAL    PRIMARY KEY,
    organization_id                  BIGINT       NOT NULL,
    upsell_platform_fee_pct          NUMERIC(5,2),
    activity_platform_commission_pct NUMERIC(5,2),
    upsell_org_commission_pct        NUMERIC(5,2),
    activity_org_commission_pct      NUMERIC(5,2),
    created_at                       TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at                       TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_monetization_org ON org_monetization_config (organization_id);

-- Colonnes ajoutées au cas où la table aurait été auto-créée en dev avec un schéma antérieur.
ALTER TABLE org_monetization_config ADD COLUMN IF NOT EXISTS upsell_platform_fee_pct          NUMERIC(5,2);
ALTER TABLE org_monetization_config ADD COLUMN IF NOT EXISTS activity_platform_commission_pct NUMERIC(5,2);
ALTER TABLE org_monetization_config ADD COLUMN IF NOT EXISTS upsell_org_commission_pct        NUMERIC(5,2);
ALTER TABLE org_monetization_config ADD COLUMN IF NOT EXISTS activity_org_commission_pct      NUMERIC(5,2);
