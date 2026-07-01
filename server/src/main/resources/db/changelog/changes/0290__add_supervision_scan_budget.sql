-- Plafond configurable de la boucle autonome : nb max de scans automatiques / jour / org.
-- 0 = pas de scan automatique (la feature peut rester active pour le scan manuel).
ALTER TABLE supervision_settings
    ADD COLUMN IF NOT EXISTS daily_scan_budget INTEGER NOT NULL DEFAULT 20;
