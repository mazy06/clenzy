-- ============================================================================
-- 0273 : Drop de la contrainte CHECK Hibernate sur audit_log.action
-- ============================================================================
-- La table `audit_log` a ete creee par Hibernate ddl-auto (avant Liquibase).
-- Hibernate genere une contrainte CHECK `audit_log_action_check` enumerant les
-- valeurs de l'enum com.clenzy.model.AuditAction a l'instant de la creation.
-- Toute NOUVELLE valeur (ici COMPLIANCE_CHECK, emise a chaque verification de
-- conformite NF 525 lors d'une generation de document) est REJETEE en prod :
--   new row for relation "audit_log" violates check constraint "audit_log_action_check"
-- -> insert avorte -> AssertionFailure Hibernate -> l'audit de conformite est PERDU.
-- En dev/test (ddl-auto regenere la contrainte) le bug est invisible -> prod-only.
-- 3e occurrence du meme pattern (cf. 0164 document_generations, 0272 notifications).
--
-- On SUPPRIME la contrainte : AuditAction est un enum qui grossit, et la validite
-- est deja garantie par l'app (@Enumerated(EnumType.STRING) n'ecrit que des noms
-- d'enum valides). Idempotent et robuste au nom de table (via pg_constraint).
-- ============================================================================

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conrelid::regclass AS tbl, conname
    FROM pg_constraint
    WHERE conname = 'audit_log_action_check'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;
END $$;
