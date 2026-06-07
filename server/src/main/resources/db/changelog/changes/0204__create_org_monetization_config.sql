-- ============================================================================
-- 0204 : Taux de monétisation par org (org_monetization_config)
-- ============================================================================
-- Permet de configurer par organisation (Paramètres › Paiement) la part plateforme
-- sur les upsells et la part hôte sur les commissions d'activités. Valeurs NULL =
-- on retombe sur les défauts globaux (clenzy.upsell.platform-fee-pct /
-- clenzy.activity-commission.host-share-pct). Idempotent (IF NOT EXISTS).
-- ============================================================================

CREATE TABLE IF NOT EXISTS org_monetization_config (
    id                      BIGSERIAL    PRIMARY KEY,
    organization_id         BIGINT       NOT NULL,
    upsell_platform_fee_pct NUMERIC(5,2),
    activity_host_share_pct NUMERIC(5,2),
    created_at              TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_monetization_org ON org_monetization_config (organization_id);
