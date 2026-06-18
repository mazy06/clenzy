-- ============================================================================
-- 0272 : Drop des contraintes CHECK Hibernate sur notification_key
-- ============================================================================
-- Les tables `notifications` (et `notification_preferences`) ont ete creees par
-- Hibernate ddl-auto (avant l'activation de Liquibase). Hibernate 6 genere une
-- contrainte CHECK `<table>_notification_key_check` enumerant les valeurs de l'enum
-- com.clenzy.model.NotificationKey a l'instant de la creation. Toute NOUVELLE valeur
-- (ici OPS_ALERT, ajoutee pour l'alerting ops) est REJETEE en prod :
--   new row for relation "notifications" violates check constraint
--   "notifications_notification_key_check"
-- -> insert avorte -> transaction marquee rollback-only -> HTTP 500 sur
--    POST /api/ops/alerts (notifyAllPlatformStaff).
-- En dev/test (ddl-auto regenere la contrainte avec la valeur) le bug est invisible
-- -> bug PROD-ONLY. Meme classe d'incident que 0164 (document_generations.reference_type).
--
-- Choix : on SUPPRIME la contrainte plutot que de la recreer avec la liste complete.
-- NotificationKey compte ~90 valeurs et grossit regulierement : recreer la
-- re-casserait au prochain ajout de cle. La validite est deja garantie par l'app
-- (colonne @Enumerated(EnumType.STRING) : seuls des noms d'enum valides sont ecrits).
--
-- Idempotent et robuste au nom de table : on cible les contraintes via pg_constraint.
-- ============================================================================

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conrelid::regclass AS tbl, conname
    FROM pg_constraint
    WHERE conname IN (
      'notifications_notification_key_check',
      'notification_preferences_notification_key_check'
    )
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;
END $$;
