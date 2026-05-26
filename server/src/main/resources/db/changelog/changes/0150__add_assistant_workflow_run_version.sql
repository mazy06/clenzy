-- ============================================================================
-- 0150 : Version JPA sur assistant_workflow_run pour optimistic locking
-- ----------------------------------------------------------------------------
-- Contexte : un double-submit cote frontend (bouton clique 2x) peut envoyer
-- 2 advanceWorkflow simultanes. Sans optimistic locking, les 2 transactions
-- lisent currentStepIdx=N et ecrivent N+1 → le step N est collecte 2 fois et
-- le step N+1 est skippe silencieusement.
--
-- Ajout d'une colonne version BIGINT geree par Hibernate via @Version :
-- chaque save fait un UPDATE WHERE id=:id AND version=:expected. Si 0 lignes
-- touchees, OptimisticLockingFailureException est levee et le second commit
-- est rollback. Le caller doit retenter ou afficher un message a l'user.
-- ============================================================================

ALTER TABLE assistant_workflow_run
    ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;

COMMENT ON COLUMN assistant_workflow_run.version IS
    'Optimistic locking JPA : incrementee a chaque UPDATE. Hibernate verifie egalite avant save → empeche le step skip sur double-submit.';
