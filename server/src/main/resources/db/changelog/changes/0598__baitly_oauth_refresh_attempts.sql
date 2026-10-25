-- Intentions de rotation Baitly : aucun jeton, identité, URL ou contenu fournisseur.
CREATE TABLE baitly_oauth_refresh_attempts (
    scope_hash VARCHAR(64) PRIMARY KEY CHECK (scope_hash ~ '^[a-f0-9]{64}$'),
    attempt UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
