-- ============================================================================
-- 0203 : Commissions d'activités affiliées (activity_commissions)
-- ============================================================================
-- Clenzy = affilié officiel ; chaque commission est répartie part hôte / part
-- plateforme (cf. ActivityCommissionConfig, défaut 70/30). Alimentée par le
-- reporting fournisseur (Viator…) quand il sera branché. La part hôte est créditée
-- au ledger interne (LedgerReferenceType.COMMISSION) → versée par le payout.
-- Idempotent (IF NOT EXISTS).
-- ============================================================================

CREATE TABLE IF NOT EXISTS activity_commissions (
    id                  BIGSERIAL    PRIMARY KEY,
    organization_id     BIGINT       NOT NULL,
    reservation_id      BIGINT,
    guide_id            BIGINT,
    provider            VARCHAR(30)  NOT NULL,
    external_booking_id VARCHAR(255),
    gross_commission    NUMERIC(12,2) NOT NULL,
    host_share          NUMERIC(12,2) NOT NULL,
    platform_share      NUMERIC(12,2) NOT NULL,
    currency            VARCHAR(3)   NOT NULL DEFAULT 'EUR',
    status              VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    created_at          TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_commissions_org         ON activity_commissions (organization_id);
CREATE INDEX IF NOT EXISTS idx_activity_commissions_reservation ON activity_commissions (reservation_id);
