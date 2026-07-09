-- Mémorise le système de design utilisé par un site (DS-3) : permet à la retouche IA de réinjecter la
-- direction (prose DESIGN.md + tokens --bt-*) pour rester on-brand. NULL = aucun système imposé.
ALTER TABLE sites ADD COLUMN IF NOT EXISTS design_system_id BIGINT;
