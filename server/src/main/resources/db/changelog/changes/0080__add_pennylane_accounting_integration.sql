-- Pennylane accounting integration
-- Adds tracking columns for Pennylane sync on invoices and provider_expenses,
-- and creates the pennylane_connections table for OAuth2 per-org connections.

-- Tracking columns on invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS pennylane_invoice_id VARCHAR(50);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS pennylane_synced_at TIMESTAMP WITH TIME ZONE;

-- Tracking columns on provider_expenses
ALTER TABLE provider_expenses ADD COLUMN IF NOT EXISTS pennylane_invoice_id VARCHAR(50);
ALTER TABLE provider_expenses ADD COLUMN IF NOT EXISTS pennylane_synced_at TIMESTAMP WITH TIME ZONE;

-- OAuth2 connection per organization (one connection per org)
CREATE TABLE IF NOT EXISTS pennylane_connections (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL UNIQUE,
    user_id BIGINT NOT NULL,
    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    refresh_token_expires_at TIMESTAMP WITH TIME ZONE,
    scopes VARCHAR(500),
    pennylane_company_id VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    error_message TEXT,
    connected_at TIMESTAMP WITH TIME ZONE,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pennylane_connections_org ON pennylane_connections(organization_id);
CREATE INDEX IF NOT EXISTS idx_pennylane_connections_status ON pennylane_connections(organization_id, status);
