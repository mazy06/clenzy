-- Extension du catalogue de templates de site (galerie Baitly, phase P2 authoring CLI).
-- Colonnes ajoutées pour le filtrage galerie (category / archetype) et l'état de publication
-- (status : seuls les PUBLISHED sont visibles des users org ; le staff plateforme voit tout).
-- Table réelle = site_templates (cf. @Table(name="site_templates"), changeset 0270).

ALTER TABLE site_templates ADD COLUMN IF NOT EXISTS category  VARCHAR(60);
ALTER TABLE site_templates ADD COLUMN IF NOT EXISTS archetype VARCHAR(60);
ALTER TABLE site_templates ADD COLUMN IF NOT EXISTS status    VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED';

CREATE INDEX IF NOT EXISTS idx_site_templates_status ON site_templates (status);
