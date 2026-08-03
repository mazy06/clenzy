-- Constellation métiers Phase 5 — natures d'étiquette du feed (grammaire de la
-- projection) : GUARDRAIL (plafond/enveloppe a retenu une action), LEARNED
-- (règle d'automatisation suggérée par les approbations répétées), DEFERRED
-- (réservé). NULL = exécution autonome ordinaire, sans étiquette.
ALTER TABLE supervision_activity ADD COLUMN IF NOT EXISTS tag VARCHAR(20);
