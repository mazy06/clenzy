-- Rollback de la Row-Level Security (F1-STRUCT) — retire policies + FORCE/ENABLE RLS
-- sur les 5 tables prioritaires. Symetrique de 0345.
--
-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ ⚠️  NON CÂBLÉ dans db.changelog-master.yaml (comme 0345).                  │
-- │     À câbler UNIQUEMENT pour un rollback d'urgence, avec le même contexte  │
-- │     `rls` et splitStatements:false / stripComments:false :                 │
-- │                                                                            │
-- │       - changeSet:                                                         │
-- │           id: "0353-rollback-rls-priority-tables"                          │
-- │           author: clenzy-team                                             │
-- │           context: "rls"                                                   │
-- │           sqlFile:                                                         │
-- │             path: changes/0353__rollback_rls_priority_tables.sql           │
-- │             relativeToChangelogFile: true                                  │
-- │             splitStatements: false                                         │
-- │             stripComments: false                                          │
-- │                                                                            │
-- │     Penser à repasser clenzy.security.rls.enabled=false en parallèle       │
-- │     (sinon la GUC est posée sans policy — inoffensif, mais incohérent).    │
-- └──────────────────────────────────────────────────────────────────────────┘

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
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
        EXECUTE format('ALTER TABLE %I NO FORCE ROW LEVEL SECURITY', t);
        EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
    END LOOP;
END $$;
