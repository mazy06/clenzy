-- ============================================================================
-- 0138 : Memoire long-terme de l'assistant IA
-- ----------------------------------------------------------------------------
-- Contexte : permettre a l'assistant de personnaliser ses reponses au fil du
-- temps en stockant des faits, preferences, objectifs et projets de l'user.
-- Ces entrees sont re-injectees dans le system prompt a chaque conversation.
--
-- Multi-tenant : organization_id obligatoire, indexe. Filtre Hibernate
-- `organizationFilter` pour isoler les memoires entre orgs.
--
-- Scope (enum applicatif, stocke en VARCHAR + CHECK) :
--   - preference : preference d'usage (timezone, briefing_time, currency, ...)
--   - fact       : fait persistant (proprietaire X est difficile, villa Y bruit recurrent, ...)
--   - goal       : objectif (Q3_target_80_occupancy, ...)
--   - project    : projet en cours (renovation_appt_paris_juin, ...)
--
-- Cle d'upsert : (keycloak_id, memory_key) unique → le tool remember_fact
-- ecrase une entree existante quand l'user redonne la meme cle.
-- ============================================================================

CREATE TABLE IF NOT EXISTS assistant_memory (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    keycloak_id VARCHAR(255) NOT NULL,
    memory_key VARCHAR(120) NOT NULL,
    memory_value TEXT NOT NULL,
    scope VARCHAR(20) NOT NULL CHECK (scope IN ('preference','fact','goal','project')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_assistant_memory_user_key UNIQUE (keycloak_id, memory_key)
);

CREATE INDEX IF NOT EXISTS idx_assistant_memory_user_scope
    ON assistant_memory (keycloak_id, scope);

CREATE INDEX IF NOT EXISTS idx_assistant_memory_org
    ON assistant_memory (organization_id);

COMMENT ON TABLE assistant_memory IS
    'Memoire long-terme de l''assistant IA. Faits, preferences, objectifs et projets de l''user re-injectes dans le system prompt.';
COMMENT ON COLUMN assistant_memory.memory_key IS
    'Cle stable d''identification (ex: user_prefers_metric, briefing_time, owner_42_difficile). Unique par user.';
COMMENT ON COLUMN assistant_memory.memory_value IS
    'Valeur associee a la cle. Format libre (texte ou valeur typee). Visible par le LLM.';
COMMENT ON COLUMN assistant_memory.scope IS
    'Categorisation : preference | fact | goal | project. Pilote le regroupement dans le system prompt.';
