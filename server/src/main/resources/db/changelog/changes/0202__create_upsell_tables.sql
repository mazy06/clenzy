-- ============================================================================
-- 0202 : Upsells payants du livret (upsell_offers + upsell_orders)
-- ============================================================================
-- L'hôte propose des services additionnels (early check-in, ménage, transfert…)
-- payables par le guest depuis le livret via Stripe. La répartition part hôte /
-- part plateforme est créditée via le ledger interne (LedgerReferenceType.UPSELL),
-- comme les paiements de réservation, puis versée à l'hôte par le payout existant.
-- Idempotent (IF NOT EXISTS) pour cohabiter avec des tables auto-créées en dev.
-- ============================================================================

CREATE TABLE IF NOT EXISTS upsell_offers (
    id              BIGSERIAL    PRIMARY KEY,
    organization_id BIGINT       NOT NULL,
    property_id     BIGINT,
    type            VARCHAR(30)  NOT NULL DEFAULT 'OTHER',
    title           VARCHAR(200) NOT NULL,
    description     VARCHAR(1000),
    price           NUMERIC(12,2) NOT NULL,
    currency        VARCHAR(3)   NOT NULL DEFAULT 'EUR',
    image_url       VARCHAR(1000),
    active          BOOLEAN      NOT NULL DEFAULT TRUE,
    sort_order      INTEGER      NOT NULL DEFAULT 0,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_upsell_offers_org      ON upsell_offers (organization_id);
CREATE INDEX IF NOT EXISTS idx_upsell_offers_property ON upsell_offers (property_id);

CREATE TABLE IF NOT EXISTS upsell_orders (
    id                  BIGSERIAL    PRIMARY KEY,
    organization_id     BIGINT       NOT NULL,
    reservation_id      BIGINT       NOT NULL,
    guide_id            BIGINT,
    offer_id            BIGINT,
    title               VARCHAR(200) NOT NULL,
    amount              NUMERIC(12,2) NOT NULL,
    currency            VARCHAR(3)   NOT NULL,
    platform_fee_amount NUMERIC(12,2),
    host_amount         NUMERIC(12,2),
    status              VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    stripe_session_id   VARCHAR(255),
    guest_email         VARCHAR(255),
    created_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
    paid_at             TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_upsell_orders_org         ON upsell_orders (organization_id);
CREATE INDEX IF NOT EXISTS idx_upsell_orders_reservation ON upsell_orders (reservation_id);
CREATE INDEX IF NOT EXISTS idx_upsell_orders_session     ON upsell_orders (stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_upsell_orders_status      ON upsell_orders (status);
