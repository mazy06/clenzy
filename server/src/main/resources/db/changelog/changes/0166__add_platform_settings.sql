-- Réglages plateforme Baitly (singleton : une seule ligne id=1).
-- Toggles opérationnels gérés par les SUPER_ADMIN / SUPER_MANAGER depuis les
-- Settings du PMS. Premier flag : envoi (ou non) des emails de devis aux prospects
-- depuis la landing page — désactivable pendant la phase de pré-lancement.
CREATE TABLE IF NOT EXISTS platform_settings (
    id                          BIGINT       PRIMARY KEY,
    send_prospect_devis_emails  BOOLEAN      NOT NULL DEFAULT TRUE,
    updated_at                  TIMESTAMP    NOT NULL DEFAULT now(),
    updated_by                  VARCHAR(255),
    CONSTRAINT platform_settings_singleton CHECK (id = 1)
);

-- Seed de la ligne unique (idempotent).
INSERT INTO platform_settings (id, send_prospect_devis_emails)
VALUES (1, TRUE)
ON CONFLICT (id) DO NOTHING;
