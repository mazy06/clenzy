-- Config WhatsApp : passage d'une config PAR ORGANISATION a une config GLOBALE unique
-- (singleton plateforme). La config globale = la ligne avec organization_id IS NULL.
-- Les eventuelles lignes par-org existantes restent en base mais sont ignorees par
-- le resolver global. Aucune FK entrante vers whatsapp_configs (migration sure).

ALTER TABLE whatsapp_configs ALTER COLUMN organization_id DROP NOT NULL;

-- Garantit AU PLUS une config globale (une seule ligne ou organization_id IS NULL).
CREATE UNIQUE INDEX IF NOT EXISTS uq_whatsapp_config_global
    ON whatsapp_configs ((organization_id IS NULL))
    WHERE organization_id IS NULL;
