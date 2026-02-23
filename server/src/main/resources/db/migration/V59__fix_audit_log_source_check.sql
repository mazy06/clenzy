-- ============================================================================
-- V59 : Fix audit_log_source_check constraint
-- ============================================================================
-- La contrainte audit_log_source_check a ete ajoutee manuellement en production
-- sans inclure toutes les valeurs de l'enum AuditSource.
-- On la supprime et on la recree avec toutes les valeurs valides.
-- ============================================================================

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_source_check;

ALTER TABLE audit_log ADD CONSTRAINT audit_log_source_check
    CHECK (source IN ('WEB', 'API', 'ADMIN', 'AIRBNB_SYNC', 'SYSTEM', 'WEBHOOK', 'CRON'));
