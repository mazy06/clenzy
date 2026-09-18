-- Invitation Baitly enregistrée avec le compte ; aucun jeton en clair en base.
CREATE TABLE marketplace_activation_deliveries (
    provider_id BIGINT PRIMARY KEY REFERENCES marketplace_providers(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL,
    email_hash VARCHAR(64) NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    encrypted_token TEXT,
    expires_at TIMESTAMP NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'RUNNING', 'SENT', 'CANCELLED', 'EXPIRED')),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    claim_token UUID,
    next_attempt_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP,
    CHECK ((status IN ('PENDING', 'RUNNING')) = (encrypted_token IS NOT NULL))
);
CREATE INDEX idx_marketplace_activation_deliveries_due
    ON marketplace_activation_deliveries (next_attempt_at, provider_id)
    WHERE status IN ('PENDING', 'RUNNING');
