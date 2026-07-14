-- Audit sécurité 2026-07 (F1-STRUCT) : Row-Level Security PostgreSQL comme FILET
-- d'isolation multi-tenant, en complément des gardes d'ownership applicatives.
-- Le filtre Hibernate `organizationFilter` étant inerte sur les flux HTTP
-- (open-in-view=false), la RLS est la seule défense qui rattrape aussi les
-- `findById`-par-PK et les requêtes natives non scopées.
--
-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ ⚠️  NON CÂBLÉ dans db.changelog-master.yaml : ROLLOUT STAGÉ.               │
-- │     Ce changeset ne s'applique PAS au boot tant qu'il n'est pas référencé  │
-- │     dans le master changelog. Procédure : docs/security/RLS-ROLLOUT-       │
-- │     RUNBOOK.md (flag clenzy.security.rls.enabled, GUC dans tous les        │
-- │     contextes, rôle de migration BYPASSRLS, validation staging).           │
-- │                                                                            │
-- │     Entrée YAML à ajouter (avec splitStatements:false ET stripComments:    │
-- │     false, obligatoires pour le bloc DO $$) au moment de l'activation :    │
-- │                                                                            │
-- │       - changeSet:                                                         │
-- │           id: "0345-enable-rls-priority-tables"                            │
-- │           author: clenzy-team                                             │
-- │           sqlFile:                                                         │
-- │             path: changes/0345__enable_rls_priority_tables.sql             │
-- │             relativeToChangelogFile: true                                  │
-- │             splitStatements: false                                         │
-- │             stripComments: false                                          │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- Politique : une ligne est visible/mutable SI le contexte est en bypass
-- (staff plateforme / org SYSTEM / thread background sans org — GUC posée par
-- com.clenzy.tenant.RlsGuc) OU si son organization_id == app.current_org.
-- FORCE ROW LEVEL SECURITY : la policy s'applique AUSSI au propriétaire de la
-- table (l'application se connecte en owner) — d'où le prérequis "migration en
-- rôle BYPASSRLS" pour ne pas bloquer les futurs changesets DML.

DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'reservations',
        'invoices',
        'document_generations',
        'service_requests',
        'payment_transactions'
    ]
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
        EXECUTE format($pol$
            CREATE POLICY tenant_isolation ON %I
            USING (
                current_setting('app.bypass_rls', true) = 'on'
                OR organization_id = NULLIF(current_setting('app.current_org', true), '')::bigint
            )
            WITH CHECK (
                current_setting('app.bypass_rls', true) = 'on'
                OR organization_id = NULLIF(current_setting('app.current_org', true), '')::bigint
            )
        $pol$, t);
    END LOOP;
END $$;
