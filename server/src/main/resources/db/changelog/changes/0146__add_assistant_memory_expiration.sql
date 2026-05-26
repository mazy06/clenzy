-- ============================================================================
-- 0146 : Colonnes d'expiration pour assistant_memory
-- ----------------------------------------------------------------------------
-- Contexte : sans politique de nettoyage, les memoires s'accumulent
-- indefiniment et finissent par contenir des infos obsoletes (anciens
-- projets, preferences periees, faits dates). Deux colonnes :
--
--   - last_accessed_at : bump a chaque lecture (listForUser / listMostRelevant).
--     Le AssistantMemoryCleanupScheduler hebdo supprime les entrees non
--     accedees depuis 6 mois — purge naturelle de la memoire morte.
--
--   - expires_at : echeance explicite (nullable). Quand l'assistant retient un
--     fait avec une date limite (ex: "promo Noel 2026"), il peut poser une
--     expires_at pour auto-cleanup. NULL = pas d'expiration explicite.
--
-- Index partiel sur expires_at NOT NULL pour accelerer le scan du scheduler.
-- ============================================================================

ALTER TABLE assistant_memory
    ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE assistant_memory
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP NULL;

CREATE INDEX IF NOT EXISTS idx_assistant_memory_last_accessed
    ON assistant_memory (last_accessed_at);

CREATE INDEX IF NOT EXISTS idx_assistant_memory_expires_at
    ON assistant_memory (expires_at)
    WHERE expires_at IS NOT NULL;

COMMENT ON COLUMN assistant_memory.last_accessed_at IS
    'Timestamp de la derniere lecture (bump batch dans le service). Sert au scheduler de nettoyage : entrees non lues depuis 6 mois supprimees.';
COMMENT ON COLUMN assistant_memory.expires_at IS
    'Echeance explicite (nullable). Si renseigne, l''entree est supprimee par le scheduler des que NOW() depasse cette valeur.';
