-- 0302 : Constellation Proprietaire (campagne X9 v1) — lien public en lecture seule
-- que la conciergerie partage a SES proprietaires (pattern welcome_guide_tokens).
CREATE TABLE IF NOT EXISTS owner_portal_token (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    owner_id BIGINT NOT NULL REFERENCES users(id),
    token UUID NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_owner_portal_token_org_owner
    ON owner_portal_token (organization_id, owner_id);
