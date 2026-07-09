-- Associe un système de design à un template (DS-3, dernier maillon) : un template porte une direction,
-- et le site instancié en hérite (design_system_id copié) → la retouche IA reste on-brand. NULL = aucun.
ALTER TABLE site_templates ADD COLUMN IF NOT EXISTS design_system_id BIGINT;
