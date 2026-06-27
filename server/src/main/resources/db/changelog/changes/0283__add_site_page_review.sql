-- Auto-traduction IA + relecture manuelle des pages de site (P1 booking engine multi-langue).
-- Mêmes colonnes que blog_posts (0264) : `ai_generated` flague une page issue d'une auto-traduction
-- IA (relecture d'autant plus requise) ; `reviewed_at`/`reviewed_by` tracent la validation manuelle.
-- Les variantes localisées créées par auto-traduction restent en DRAFT — jamais publiées sans relecture.
ALTER TABLE site_pages ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE site_pages ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;
ALTER TABLE site_pages ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(255);
