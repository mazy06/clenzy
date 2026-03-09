-- =============================================
-- V93: Payment System Foundation
-- Tables: payment_transactions, wallets, ledger_entries, escrow_holds, split_configurations, payment_method_configs
-- =============================================

-- 1. Payment Transactions (universal tracking across providers)
CREATE TABLE payment_transactions (
    id                  BIGSERIAL PRIMARY KEY,
    organization_id     BIGINT NOT NULL,
    transaction_ref     VARCHAR(64) NOT NULL,
    provider_type       VARCHAR(30) NOT NULL,
    provider_tx_id      VARCHAR(255),
    payment_type        VARCHAR(30) NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    amount              DECIMAL(12,2) NOT NULL,
    currency            VARCHAR(3) NOT NULL DEFAULT 'EUR',
    metadata            JSONB,
    error_message       TEXT,
    idempotency_key     VARCHAR(100),
    source_type         VARCHAR(30),
    source_id           BIGINT,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW(),
    UNIQUE(organization_id, transaction_ref)
);
CREATE INDEX idx_payment_tx_org ON payment_transactions(organization_id);
CREATE INDEX idx_payment_tx_status ON payment_transactions(status);
CREATE INDEX idx_payment_tx_provider ON payment_transactions(provider_type);
CREATE INDEX idx_payment_tx_source ON payment_transactions(source_type, source_id);
CREATE INDEX idx_payment_tx_idempotency ON payment_transactions(idempotency_key);

-- 2. Wallets
CREATE TABLE wallets (
    id                  BIGSERIAL PRIMARY KEY,
    organization_id     BIGINT NOT NULL,
    wallet_type         VARCHAR(30) NOT NULL,
    owner_id            BIGINT,
    currency            VARCHAR(3) NOT NULL DEFAULT 'EUR',
    status              VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW(),
    UNIQUE(organization_id, wallet_type, COALESCE(owner_id, 0), currency)
);
CREATE INDEX idx_wallet_org ON wallets(organization_id);
CREATE INDEX idx_wallet_owner ON wallets(owner_id);

-- 3. Ledger Entries (immutable double-entry)
CREATE TABLE ledger_entries (
    id                   BIGSERIAL PRIMARY KEY,
    organization_id      BIGINT NOT NULL,
    wallet_id            BIGINT NOT NULL REFERENCES wallets(id),
    entry_type           VARCHAR(10) NOT NULL,
    amount               DECIMAL(12,2) NOT NULL,
    currency             VARCHAR(3) NOT NULL DEFAULT 'EUR',
    balance_after        DECIMAL(12,2) NOT NULL,
    reference_type       VARCHAR(30) NOT NULL,
    reference_id         VARCHAR(100) NOT NULL,
    counterpart_entry_id BIGINT,
    description          VARCHAR(500),
    created_at           TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_ledger_org ON ledger_entries(organization_id);
CREATE INDEX idx_ledger_wallet ON ledger_entries(wallet_id);
CREATE INDEX idx_ledger_ref ON ledger_entries(reference_type, reference_id);
CREATE INDEX idx_ledger_created ON ledger_entries(created_at);

-- 4. Escrow Holds
CREATE TABLE escrow_holds (
    id                  BIGSERIAL PRIMARY KEY,
    organization_id     BIGINT NOT NULL,
    reservation_id      BIGINT,
    transaction_id      BIGINT REFERENCES payment_transactions(id),
    amount              DECIMAL(12,2) NOT NULL,
    currency            VARCHAR(3) NOT NULL DEFAULT 'EUR',
    status              VARCHAR(20) NOT NULL DEFAULT 'HELD',
    held_at             TIMESTAMP DEFAULT NOW(),
    release_at          TIMESTAMP,
    released_at         TIMESTAMP,
    release_trigger     VARCHAR(30),
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_escrow_org ON escrow_holds(organization_id);
CREATE INDEX idx_escrow_reservation ON escrow_holds(reservation_id);
CREATE INDEX idx_escrow_status ON escrow_holds(status);

-- 5. Split Configurations
CREATE TABLE split_configurations (
    id                  BIGSERIAL PRIMARY KEY,
    organization_id     BIGINT NOT NULL,
    name                VARCHAR(100) NOT NULL,
    owner_share         DECIMAL(5,4) NOT NULL DEFAULT 0.8000,
    platform_share      DECIMAL(5,4) NOT NULL DEFAULT 0.0500,
    concierge_share     DECIMAL(5,4) NOT NULL DEFAULT 0.1500,
    is_default          BOOLEAN DEFAULT FALSE,
    active              BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_split_config_org ON split_configurations(organization_id);

-- 6. Payment Method Configurations
CREATE TABLE payment_method_configs (
    id                       BIGSERIAL PRIMARY KEY,
    organization_id          BIGINT NOT NULL,
    provider_type            VARCHAR(30) NOT NULL,
    enabled                  BOOLEAN NOT NULL DEFAULT FALSE,
    country_codes            VARCHAR(100),
    api_key_encrypted        TEXT,
    api_secret_encrypted     TEXT,
    webhook_secret_encrypted TEXT,
    sandbox_mode             BOOLEAN DEFAULT TRUE,
    config_json              JSONB,
    created_at               TIMESTAMP DEFAULT NOW(),
    updated_at               TIMESTAMP DEFAULT NOW(),
    UNIQUE(organization_id, provider_type)
);
CREATE INDEX idx_pmc_org ON payment_method_configs(organization_id);
