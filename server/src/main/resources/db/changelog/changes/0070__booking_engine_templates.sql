-- 0070 : Passage de 1:1 (org -> config) a 1:N (org -> templates)
-- Ajout des champs name, custom_css, custom_js, component_config

-- Supprimer la contrainte UNIQUE sur organization_id (si elle existe)
ALTER TABLE booking_engine_configs
  DROP CONSTRAINT IF EXISTS booking_engine_configs_organization_id_key;

-- Nouveaux champs
ALTER TABLE booking_engine_configs ADD COLUMN IF NOT EXISTS name VARCHAR(100) NOT NULL DEFAULT 'Default';
ALTER TABLE booking_engine_configs ADD COLUMN IF NOT EXISTS custom_css TEXT;
ALTER TABLE booking_engine_configs ADD COLUMN IF NOT EXISTS custom_js TEXT;
ALTER TABLE booking_engine_configs ADD COLUMN IF NOT EXISTS component_config TEXT;

-- Index non-unique sur organization_id
CREATE INDEX IF NOT EXISTS idx_bec_org_id ON booking_engine_configs(organization_id);

-- Contrainte unique (organization_id, name)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_bec_org_name'
    ) THEN
        ALTER TABLE booking_engine_configs
          ADD CONSTRAINT uq_bec_org_name UNIQUE (organization_id, name);
    END IF;
END$$;
