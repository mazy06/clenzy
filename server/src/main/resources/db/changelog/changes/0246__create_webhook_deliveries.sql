-- File de livraison + journal des webhooks sortants (CLZ Domaine 10).
-- Livraison asynchrone hors transaction metier (#2) avec retry/backoff et observabilite.

CREATE TABLE webhook_deliveries (
    id              BIGSERIAL    PRIMARY KEY,
    organization_id BIGINT       NOT NULL,
    webhook_id      BIGINT       NOT NULL,
    event_type      VARCHAR(80)  NOT NULL,
    payload         TEXT         NOT NULL,
    status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    attempts        INTEGER      NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ,
    response_status INTEGER,
    last_error      VARCHAR(500),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    delivered_at    TIMESTAMPTZ
);

-- Selection des livraisons dues (scheduler de retry).
CREATE INDEX idx_webhook_deliveries_due ON webhook_deliveries (status, next_attempt_at);
-- Journal par abonne (UI).
CREATE INDEX idx_webhook_deliveries_webhook ON webhook_deliveries (webhook_id, organization_id, created_at DESC);
