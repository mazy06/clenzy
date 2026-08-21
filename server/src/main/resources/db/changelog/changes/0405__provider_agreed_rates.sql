-- Tarif CONVENU entre un intervenant et l'organisation, pour un logement donne.
--
-- A distinguer du tarif DECLARE (`housekeeper_rates`, prestations travaux), qui
-- n'engage que l'intervenant : celui-ci est le prix qu'un gestionnaire a
-- APPROUVE via un devis. Tant que l'intervenant ne change pas son tarif, les
-- missions suivantes sur ce logement n'ont plus besoin de repasser par un devis.
CREATE TABLE IF NOT EXISTS provider_agreed_rates (
    id                BIGSERIAL PRIMARY KEY,
    organization_id   BIGINT       NOT NULL,
    provider_user_id  BIGINT       NOT NULL,
    property_id       BIGINT       NOT NULL,
    amount            NUMERIC(10,2) NOT NULL,
    currency          VARCHAR(8)   NOT NULL DEFAULT 'EUR',
    -- Devis qui a scelle l'accord : la trace de QUI a approuve QUOI.
    quote_id          BIGINT,
    agreed_at         TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP
);

-- Un seul tarif convenu par couple (intervenant, logement) dans une org : une
-- nouvelle approbation remplace la precedente.
CREATE UNIQUE INDEX IF NOT EXISTS ux_provider_agreed_rate
    ON provider_agreed_rates (organization_id, provider_user_id, property_id);
