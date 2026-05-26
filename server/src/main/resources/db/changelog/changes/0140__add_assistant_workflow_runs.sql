-- ============================================================================
-- 0140 : Workflow runs de l'assistant IA (procedures multi-etapes)
-- ----------------------------------------------------------------------------
-- Contexte : l'assistant peut piloter des procedures guidees (onboarding
-- propriete, cloture mensuelle, preparation haute saison) decrites en YAML.
-- Chaque execution active est un "run" persiste pour resister aux deconnexions
-- et garder la trace des donnees collectees a chaque etape.
--
-- Multi-tenant : organization_id obligatoire, filtre Hibernate organizationFilter.
-- Ownership user-level via keycloak_id (defense en profondeur).
--
-- Statuts :
--   ACTIVE     : run en cours, l'user repond aux prompts step apres step.
--   COMPLETED  : toutes les etapes traversees, l'action finale (si presente)
--                a ete suggeree au LLM.
--   ABANDONED  : run laisse en plan (TTL applicatif ou action explicite).
-- ============================================================================

CREATE TABLE IF NOT EXISTS assistant_workflow_run (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    keycloak_id VARCHAR(255) NOT NULL,
    conversation_id BIGINT REFERENCES assistant_conversation(id) ON DELETE SET NULL,
    workflow_id VARCHAR(120) NOT NULL,
    current_step_idx INT NOT NULL DEFAULT 0,
    collected_data JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE','COMPLETED','ABANDONED')),
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assistant_wf_user_status
    ON assistant_workflow_run (keycloak_id, status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_assistant_wf_org
    ON assistant_workflow_run (organization_id);

CREATE INDEX IF NOT EXISTS idx_assistant_wf_conv
    ON assistant_workflow_run (conversation_id)
    WHERE conversation_id IS NOT NULL;

COMMENT ON TABLE assistant_workflow_run IS
    'Executions de workflows guides par l''assistant IA. Une ligne = un parcours
    utilisateur d''une procedure declaree en YAML (onboarding, cloture, etc.).';
COMMENT ON COLUMN assistant_workflow_run.workflow_id IS
    'Reference la cle id du fichier YAML dans resources/workflows/.';
COMMENT ON COLUMN assistant_workflow_run.current_step_idx IS
    'Index 0-based de l''etape courante dans le tableau steps du YAML.';
COMMENT ON COLUMN assistant_workflow_run.collected_data IS
    'JSON object accumulant les reponses utilisateur par step.id. Cle = step id,
    valeur = reponse texte ou objet structure.';
COMMENT ON COLUMN assistant_workflow_run.status IS
    'ACTIVE en cours ; COMPLETED terminee ; ABANDONED interrompue.';
