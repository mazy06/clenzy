# Runbook — Déploiement stagé de la Row-Level Security (F1-STRUCT)

> Filet d'isolation multi-tenant au niveau PostgreSQL. Complète les gardes d'ownership
> applicatives (F1-01→F1-09) : c'est la **seule** défense qui rattrape aussi les
> `findById`-par-PK et les requêtes natives non scopées, là où le filtre Hibernate est
> inerte (open-in-view=false).
>
> **Statut** : plomberie livrée et **inerte** (flag `false`, changeset non câblé).
> Ce runbook décrit l'activation **stagée** — jamais un big-bang prod.

## Composants livrés (inertes tant que non activés)

| Artefact | Rôle | État par défaut |
|---|---|---|
| `com.clenzy.tenant.RlsGuc` | Pose `app.current_org` / `app.bypass_rls` (LOCAL) sur la tx courante | Appelé uniquement si flag ON |
| `com.clenzy.tenant.RlsTenantGucAspect` | `@Before` chaque `@Transactional` de `com.clenzy` | Gardé par `clenzy.security.rls.enabled` (défaut **false**) → no-op |
| `changes/0345__enable_rls_priority_tables.sql` | `ENABLE`+`FORCE ROW LEVEL SECURITY` + policy `tenant_isolation` sur 5 tables | **NON câblé** dans `db.changelog-master.yaml` → ne s'applique pas au boot |

Tables couvertes (v1) : `reservations`, `invoices`, `document_generations`, `service_requests`, `payment_transactions`.

## Modèle d'autorisation de la policy

Une ligne est visible/mutable si :
```
current_setting('app.bypass_rls', true) = 'on'
OR organization_id = NULLIF(current_setting('app.current_org', true), '')::bigint
```
`app.bypass_rls = on` pour : **staff plateforme** (SUPER_ADMIN/SUPER_MANAGER), **org SYSTEM**, et **threads background sans contexte tenant** (`org == null`) — même exemption qu'aujourd'hui (aucun filtre actif). Les flux HTTP tenant (org résolu par `TenantFilter`, fail-closed) sont donc **strictement scopés**.

## Prérequis AVANT activation

1. **Rôle de migration `BYPASSRLS`.** `FORCE ROW LEVEL SECURITY` soumet aussi le propriétaire des tables. Comme l'app se connecte en owner, tout futur changeset faisant du **DML** sur ces tables serait bloqué. Deux options (à décider avec l'infra `clenzy-infra`) :
   - donner l'attribut `BYPASSRLS` au rôle qui exécute Liquibase ; **ou**
   - faire tourner l'app sous un rôle **non-owner** (dans ce cas `FORCE` devient superflu).
2. **Couverture GUC.** Vérifier (staging, cf. checklist) que **tout** accès aux 5 tables passe par une méthode `@Transactional` de `com.clenzy` (couverte par l'aspect). Les accès repository Spring Data appelés **directement** hors service applicatif ne sont PAS couverts par le pointcut — cible robuste long terme : un `ConnectionProvider` Hibernate posant la GUC au checkout de connexion.
3. **Flux background.** Les consumers qui chargent par PK puis dérivent l'org sans contexte tenant (`PaymentEventConsumer`, reconciliations) tournent avec `org == null` → **bypass** → non cassés. Le durcissement (dériver+poser l'org avant, cf. F1-10/F6-02) est un chantier séparé.

## Procédure d'activation (staging d'abord)

### Étape 1 — Staging : poser la GUC sans policies
1. Déployer le code (flag toujours `false`).
2. Mettre `clenzy.security.rls.enabled=true` en **staging uniquement**.
3. Smoke tests : les GUC sont posées mais **aucune policy n'existe encore** → comportement inchangé. Vérifier via logs / `SELECT current_setting('app.current_org', true)` dans une requête tracée. Confirmer : zéro régression, zéro erreur.

### Étape 2 — Staging : activer la RLS
1. Câbler `0345` dans `db.changelog-master.yaml` (bloc YAML fourni en tête du `.sql`, **`splitStatements: false`** + **`stripComments: false`**).
2. S'assurer que le rôle de migration a `BYPASSRLS` (prérequis 1).
3. Redéployer staging → le changeset applique `ENABLE/FORCE RLS` + policies.
4. **Checklist de validation** (voir plus bas). Tout doit être vert.

### Étape 3 — Production
1. Après ≥ 1 semaine de staging sain, PR `main → production`.
2. CD Deploy → le `pms-server-prod` applique le changeset au boot (invariant `SPRING_LIQUIBASE_ENABLED=true`).
3. Surveiller Grafana / Sentry sur les 5 domaines (résa, factures, docs, demandes, paiements) : un pic de résultats vides = GUC non posée sur un chemin → **rollback** (voir plus bas).

## Checklist de validation (staging)

- [ ] Un HOST de l'org A ne voit **plus** les réservations/factures/docs/SR/paiements de l'org B (rejouer F1-01/F1-02/F1-03).
- [ ] Un HOST de l'org A voit **toujours** intégralement ses propres données (aucune sur-filtration).
- [ ] SUPER_ADMIN / SUPER_MANAGER voient toujours le cross-org.
- [ ] Org SYSTEM (services cross-org) fonctionne.
- [ ] **Sync OTA** (Airbnb/Booking via Kafka) : réservations créées/mises à jour correctement.
- [ ] **Réconciliation paiement** (`PaymentEventConsumer`, webhooks) : statuts mis à jour.
- [ ] **Schedulers** (iCal, pricing, retention) : pas de résultats vides inattendus.
- [ ] **Génération de documents** (facture/devis) : PDF produits, envois OK.
- [ ] Boot : Liquibase applique `0345` sans erreur ; aucun changeset DML ultérieur bloqué.

## Rollback

- **Désactiver la GUC** : `clenzy.security.rls.enabled=false` (redéploiement) → l'aspect redevient no-op. Les policies restent mais, sans `app.current_org` posée, **elles bloqueraient tout** → il faut AUSSI retirer les policies.
- **Retirer les policies** : changeset de rollback (à préparer) :
  ```sql
  DO $$ DECLARE t text; BEGIN
    FOREACH t IN ARRAY ARRAY['reservations','invoices','document_generations','service_requests','payment_transactions'] LOOP
      EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
      EXECUTE format('ALTER TABLE %I NO FORCE ROW LEVEL SECURITY', t);
      EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
    END LOOP;
  END $$;
  ```
- Conforme à la règle « pas de fix manuel prod » : le rollback passe par un changeset + CD Deploy, pas par du SQL ad-hoc.

## Extension (post-v1)

Étendre `0345` (ou changesets suivants) aux autres tables org-scopées (les 130 entités `@Filter` + les tables org-scopées sans `@Filter`), table par table, avec la même checklist. Prioriser les tables à forte valeur (guests, escrow, owner_payouts, security_deposits).
