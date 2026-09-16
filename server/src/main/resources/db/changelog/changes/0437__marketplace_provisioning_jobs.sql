-- Reprise durable de l'ouverture des comptes Baitly après modération.
CREATE TABLE marketplace_provisioning_jobs (
    provider_id BIGINT PRIMARY KEY REFERENCES marketplace_providers(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'RUNNING', 'RETRY', 'SUCCEEDED', 'FAILED')),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    next_attempt_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_outcome VARCHAR(40)
);
CREATE INDEX idx_marketplace_provisioning_due ON marketplace_provisioning_jobs(next_attempt_at)
    WHERE status IN ('PENDING', 'RETRY');

-- Reprendre uniquement les fiches déjà modérées et confirmées, encore sans compte.
INSERT INTO marketplace_provisioning_jobs(provider_id)
SELECT id FROM marketplace_providers
WHERE status = 'ACTIVE' AND user_id IS NULL
  AND email_confirmed_at IS NOT NULL AND verified_at IS NOT NULL;
