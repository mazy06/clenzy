-- ============================================================================
-- 0083 : Extend owner_payouts for automated generation
-- ============================================================================
-- Ajoute les colonnes necessaires a l'automatisation des reversements :
--   - generation_type : MANUAL (defaut, retro-compat) ou AUTO
--   - failure_reason  : motif d'echec d'execution
--   - retry_count     : nombre de tentatives d'execution

-- Elargir la colonne status pour les nouveaux statuts (PROCESSING, FAILED)
ALTER TABLE owner_payouts ALTER COLUMN status TYPE VARCHAR(20);

-- Nouvelles colonnes
ALTER TABLE owner_payouts ADD COLUMN IF NOT EXISTS generation_type VARCHAR(10) NOT NULL DEFAULT 'MANUAL';
ALTER TABLE owner_payouts ADD COLUMN IF NOT EXISTS failure_reason  TEXT;
ALTER TABLE owner_payouts ADD COLUMN IF NOT EXISTS retry_count     INTEGER NOT NULL DEFAULT 0;
