-- Pieces jointes des messages de contact : stockage objet (OVH) au lieu de PostgreSQL.
-- Les nouvelles pieces jointes n'enregistrent plus que leur cle de stockage ; les octets (data)
-- deviennent facultatifs et ne subsistent que pour les pieces jointes anterieures, reprises
-- ensuite par la migration automatique vers le stockage objet.
ALTER TABLE contact_attachment_files ADD COLUMN IF NOT EXISTS storage_key VARCHAR(500);
ALTER TABLE contact_attachment_files ALTER COLUMN data DROP NOT NULL;
