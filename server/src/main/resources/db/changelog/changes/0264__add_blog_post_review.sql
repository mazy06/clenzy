-- Validation/relecture manuelle obligatoire des articles avant publication (2.13).
-- Statut PENDING_REVIEW (en attente de validation) intercalé entre DRAFT et PUBLISHED ; la mise en
-- prod passe par une approbation explicite. `ai_generated` flague le contenu issu de l'IA (relecture
-- d'autant plus requise) ; `reviewed_at`/`reviewed_by` tracent la validation manuelle.
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(255);
