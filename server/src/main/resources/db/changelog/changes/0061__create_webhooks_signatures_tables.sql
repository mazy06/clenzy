-- =============================================================================
-- 0061 : Create webhook subscriptions and signature requests tables
-- Tables pour le systeme de webhooks (Zapier/n8n) et la signature electronique
-- =============================================================================

-- 1. Table des abonnements webhook
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
    id              BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    event_type      VARCHAR(100) NOT NULL,
    target_url      VARCHAR(500) NOT NULL,
    secret_encrypted VARCHAR(500),
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index pour la recherche par organisation et statut actif
CREATE INDEX IF NOT EXISTS idx_webhook_subs_org_active
    ON webhook_subscriptions(organization_id, active);

-- Index pour la recherche par type d'evenement et statut actif
CREATE INDEX IF NOT EXISTS idx_webhook_subs_event_active
    ON webhook_subscriptions(event_type, active);

-- 2. Table des demandes de signature electronique
CREATE TABLE IF NOT EXISTS signature_requests (
    id              BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    document_id     BIGINT,
    provider_type   VARCHAR(50) NOT NULL,
    external_id     VARCHAR(255),
    status          VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    signers_json    TEXT,
    signing_url     VARCHAR(500),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMP
);

-- Index pour la recherche par organisation
CREATE INDEX IF NOT EXISTS idx_signature_req_org
    ON signature_requests(organization_id);

-- Index pour la recherche par identifiant externe
CREATE INDEX IF NOT EXISTS idx_signature_req_external
    ON signature_requests(external_id)
    WHERE external_id IS NOT NULL;

-- Index pour la recherche par statut
CREATE INDEX IF NOT EXISTS idx_signature_req_status
    ON signature_requests(status);
