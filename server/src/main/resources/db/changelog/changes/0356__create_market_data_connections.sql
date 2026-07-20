-- Roadmap market data : connexions fournisseurs (Airbtics, AirROI) — cle API
-- saisie dans Reglages -> Integrations -> Intelligence de marche, chiffree au
-- repos (Jasypt). Portee PLATEFORME (pas d'organization_id) : l'abonnement est
-- celui de Baitly, l'ingestion est globale.
CREATE TABLE market_data_connections (
    id                BIGSERIAL    PRIMARY KEY,
    provider          VARCHAR(24)  NOT NULL,
    api_key_encrypted TEXT         NOT NULL,
    base_url          VARCHAR(500),
    enabled           BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMP    NOT NULL DEFAULT now(),
    updated_at        TIMESTAMP,
    CONSTRAINT uq_market_data_connections_provider UNIQUE (provider)
);
