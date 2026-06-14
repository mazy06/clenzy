-- CLZ Domaine 1 / Item 1 (mapping) : support multi-rate-plan.
-- channex_rate_plan_ids = rate plans additionnels (au-dela du defaut) cibles par la sync, en CSV.
-- Permet de mapper une propriete a plusieurs rate plans Channex (ex : remboursable + non-remboursable).

ALTER TABLE channex_property_mapping ADD COLUMN IF NOT EXISTS channex_rate_plan_ids VARCHAR(512);
