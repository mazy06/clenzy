-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ 0364 — Inventaire des chemins échappant à la Row-Level Security          │
-- │ Audit sécurité 2026-07-26, plan REM-T-01                                  │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- POURQUOI PERSISTER
-- L'instrumentation de mesure accumulait ses constats en mémoire. Or l'inventaire doit
-- courir plusieurs semaines pour couvrir un cycle d'usage complet — fins de mois,
-- exports, tâches planifiées rares. Chaque redéploiement remettait le compteur à zéro,
-- et un inventaire qui repart de zéro ne prouve jamais rien : son silence ne serait que
-- celui d'un compteur neuf.
--
-- Cette table conserve les constats entre redémarrages et alimente l'écran
-- d'administration (Monitoring → Isolation RLS), pour que le suivi ne dépende plus
-- d'une commande qu'il faut penser à lancer.
--
-- PAS D'organization_id : ces constats sont techniques et transverses. Ils décrivent du
-- CODE, pas des données de tenant — l'écran est réservé au personnel plateforme.
--
-- ROLLBACK : DROP TABLE. Aucune donnée métier, aucune dépendance.

CREATE TABLE IF NOT EXISTS rls_audit_findings (
    id              BIGSERIAL PRIMARY KEY,

    -- Première frame applicative de la pile : c'est elle qui désigne le code à corriger.
    -- Exemple : com.clenzy.service.XxxService.maMethode:142
    origin          VARCHAR(512) NOT NULL,

    -- Table sous RLS touchée par la requête sans contexte tenant.
    table_name      VARCHAR(128) NOT NULL,

    -- Extrait de la requête, borné : sert à identifier l'appel, pas à le rejouer.
    sql_excerpt     VARCHAR(512),

    first_seen_at   TIMESTAMP NOT NULL DEFAULT now(),
    last_seen_at    TIMESTAMP NOT NULL DEFAULT now(),

    -- Compteur cumulé. Un chemin très fréquent est plus urgent qu'un chemin marginal :
    -- c'est ce qui permet de prioriser au lieu de traiter dans l'ordre d'apparition.
    occurrences     BIGINT NOT NULL DEFAULT 1,

    -- Marqué traité par un opérateur : la ligne reste, pour garder la trace et détecter
    -- une réapparition après correction.
    resolved_at     TIMESTAMP
);

-- Un chemin = une origine + une table. C'est cette clé qui rend l'accumulation
-- idempotente entre les vidages successifs du tampon mémoire.
CREATE UNIQUE INDEX IF NOT EXISTS uq_rls_audit_findings_origin_table
    ON rls_audit_findings (origin, table_name);

CREATE INDEX IF NOT EXISTS idx_rls_audit_findings_last_seen
    ON rls_audit_findings (last_seen_at DESC);
