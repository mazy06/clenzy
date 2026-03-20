-- Migre l'ancienne table intervention_photos (Hibernate auto-DDL) vers la nouvelle structure.
-- Ajoute : organization_id, storage_key, original_filename, file_size, phase (enum), uploaded_by_id
-- Renomme : photo_data -> data, file_name -> original_filename, photo_type -> phase

-- 1. Ajouter les nouvelles colonnes
ALTER TABLE intervention_photos ADD COLUMN IF NOT EXISTS organization_id BIGINT;
ALTER TABLE intervention_photos ADD COLUMN IF NOT EXISTS storage_key VARCHAR(500);
ALTER TABLE intervention_photos ADD COLUMN IF NOT EXISTS original_filename VARCHAR(255);
ALTER TABLE intervention_photos ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE intervention_photos ADD COLUMN IF NOT EXISTS data BYTEA;
ALTER TABLE intervention_photos ADD COLUMN IF NOT EXISTS phase VARCHAR(20);
ALTER TABLE intervention_photos ADD COLUMN IF NOT EXISTS uploaded_by_id BIGINT REFERENCES users(id);

-- 2. Migrer les donnees existantes
UPDATE intervention_photos SET data = photo_data WHERE data IS NULL AND photo_data IS NOT NULL;
UPDATE intervention_photos SET original_filename = file_name WHERE original_filename IS NULL AND file_name IS NOT NULL;
UPDATE intervention_photos SET phase = COALESCE(UPPER(photo_type), 'BEFORE') WHERE phase IS NULL;
UPDATE intervention_photos SET organization_id = (
    SELECT i.organization_id FROM interventions i WHERE i.id = intervention_photos.intervention_id
) WHERE organization_id IS NULL;

-- 3. Rendre organization_id NOT NULL et phase NOT NULL avec default
ALTER TABLE intervention_photos ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE intervention_photos ALTER COLUMN phase SET NOT NULL;
ALTER TABLE intervention_photos ALTER COLUMN phase SET DEFAULT 'BEFORE';
ALTER TABLE intervention_photos ALTER COLUMN content_type SET DEFAULT 'image/jpeg';

-- 4. Supprimer les anciennes colonnes
ALTER TABLE intervention_photos DROP COLUMN IF EXISTS photo_data;
ALTER TABLE intervention_photos DROP COLUMN IF EXISTS file_name;
ALTER TABLE intervention_photos DROP COLUMN IF EXISTS photo_type;

-- 5. Rendre photo_data nullable (data remplace photo_data, peut etre null si stocke en S3)
ALTER TABLE intervention_photos ALTER COLUMN data DROP NOT NULL;

-- 6. Ajouter la FK ON DELETE CASCADE si pas encore la
ALTER TABLE intervention_photos DROP CONSTRAINT IF EXISTS fkdrny96hrmir0g2qc353debueo;
ALTER TABLE intervention_photos ADD CONSTRAINT fk_intervention_photos_intervention
    FOREIGN KEY (intervention_id) REFERENCES interventions(id) ON DELETE CASCADE;

-- 7. Index
CREATE INDEX IF NOT EXISTS idx_intervention_photos_intervention ON intervention_photos(intervention_id);
CREATE INDEX IF NOT EXISTS idx_intervention_photos_org ON intervention_photos(organization_id);
CREATE INDEX IF NOT EXISTS idx_intervention_photos_phase ON intervention_photos(intervention_id, phase);
