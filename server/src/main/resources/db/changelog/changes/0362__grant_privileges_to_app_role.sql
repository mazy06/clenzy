-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ 0362 — Privilèges du rôle applicatif non-superuser                       │
-- │ Audit sécurité 2026-07-26, constat P4-03 / plan REM-T-02                  │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- POURQUOI
-- L'application, Liquibase, Keycloak, pgbouncer, l'exporter et la réplication
-- partagent aujourd'hui UN SEUL compte, qui est le superuser créé par l'image
-- PostgreSQL. Or `RlsEnforcementIT#superuserBypassesRls_documentsPrerequisite`
-- démontre qu'un superuser contourne la RLS *même* posée et FORCÉE : activer le
-- contexte Liquibase `rls` dans cette configuration n'apporterait donc AUCUNE
-- protection — seulement le risque d'indisponibilité du défaut R1.
--
-- Ce changeset accorde à un rôle applicatif dédié les privilèges DML dont
-- l'application a besoin, sans lui donner la propriété des tables ni le statut
-- superuser. La RLS s'applique alors réellement à lui.
--
-- CE QUE CE CHANGESET NE FAIT PAS, ET POURQUOI
-- Il ne CRÉE pas le rôle. Un `CREATE ROLE ... LOGIN PASSWORD '...'` mettrait un
-- secret dans un fichier versionné — interdit (règle projet n°12). La création du
-- rôle et son mot de passe relèvent de l'infrastructure (`clenzy-infra`, à partir
-- d'une variable du `.env`).
--
-- Conséquence assumée : tant que le rôle n'existe pas, ce changeset est un NO-OP
-- silencieux. Il ne bloque aucun boot et peut donc être déployé AVANT que
-- l'infrastructure ne soit prête. C'est ce qui permet le rollout en trois temps
-- décrit ci-dessous.
--
-- ROLLOUT EN TROIS TEMPS (aucune étape n'est irréversible seule)
--   1. Déployer ce changeset. Le rôle n'existe pas encore → no-op. L'application
--      continue de tourner en superuser. Aucun changement de comportement.
--   2. Créer le rôle côté infrastructure :
--        CREATE ROLE clenzy_app LOGIN PASSWORD '<secret du .env>';
--      puis rejouer ce changeset (Liquibase Bootstrap) pour poser les privilèges.
--   3. Basculer SPRING_DATASOURCE_USERNAME/PASSWORD sur clenzy_app, en laissant
--      SPRING_LIQUIBASE_USERNAME sur le compte propriétaire (le DDL des futurs
--      changesets exige la propriété des tables). Redéployer.
--   Ensuite seulement : activer le contexte `rls` et strict-context.
--
-- ROLLBACK : repasser SPRING_DATASOURCE_USERNAME sur le compte d'origine. Les
-- privilèges accordés ici sont additifs et ne retirent rien à personne.

DO $$
DECLARE
    app_role  CONSTANT text := 'clenzy_app';
    role_oid  oid;
BEGIN
    SELECT oid INTO role_oid FROM pg_roles WHERE rolname = app_role;

    IF role_oid IS NULL THEN
        RAISE NOTICE
            'Changeset 0362 : le role % n''existe pas encore — aucun privilege accorde. '
            'Creer le role cote infrastructure (avec un mot de passe issu du .env), puis '
            'rejouer ce changeset. Voir REMEDIATION-PLAN.md, REM-T-02.', app_role;
        RETURN;
    END IF;

    -- Garde-fou : accorder des privilèges DML à un superuser n'aurait aucun sens,
    -- et signalerait une erreur de configuration (la RLS resterait contournée).
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role AND rolsuper) THEN
        RAISE EXCEPTION
            'Changeset 0362 : le role % est SUPERUSER. Un superuser contourne la RLS '
            '(cf. RlsEnforcementIT) : le retirer du role avant de continuer — '
            'ALTER ROLE % NOSUPERUSER.', app_role, app_role;
    END IF;

    EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), app_role);
    EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', app_role);

    -- DML sur l'existant. Pas de DDL, pas de TRUNCATE, pas de propriété : le rôle
    -- ne peut ni modifier le schéma ni désactiver une policy RLS sur une table.
    EXECUTE format(
        'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %I', app_role);
    EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO %I', app_role);

    -- Mêmes privilèges sur les objets créés PAR LA SUITE par le propriétaire courant
    -- (chaque futur changeset Liquibase) : sans cela, toute nouvelle table serait
    -- invisible au rôle applicatif jusqu'à un GRANT manuel.
    EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public '
        'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I', app_role);
    EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public '
        'GRANT USAGE, SELECT ON SEQUENCES TO %I', app_role);

    RAISE NOTICE 'Changeset 0362 : privileges DML accordes au role % (non-superuser, '
                 'non-proprietaire) — la RLS lui sera opposable.', app_role;
END $$;
