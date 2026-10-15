-- Baitly: relation privée, aucune modification de publication du catalogue.
CREATE TABLE baitly_network_links (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    provider_id BIGINT NOT NULL REFERENCES marketplace_providers(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('INVITED','ACTIVE','REVOKED')),
    token_hash VARCHAR(64) UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    UNIQUE (organization_id,provider_id),
    CHECK ((status='INVITED' AND token_hash IS NOT NULL AND expires_at IS NOT NULL)
        OR (status<>'INVITED' AND token_hash IS NULL AND expires_at IS NULL))
);
CREATE INDEX baitly_network_recipient_idx ON baitly_network_links(provider_id,updated_at DESC);
