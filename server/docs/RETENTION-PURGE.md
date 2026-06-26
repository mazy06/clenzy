# Purge de rétention (suppression des données expirées) — guide d'activation

> **État : MÉCANISME INERTE PAR DÉFAUT.** Tant que `clenzy.retention.purge.enabled=false` (défaut)
> **et** qu'aucune `PurgeSource` n'est fournie en code, rien n'est compté, lu ni supprimé. De plus
> `dry-run-default=true` : même activé, un appel sans `dryRun=false` explicite ne supprime RIEN.
> Ce document liste ce que **l'exploitant doit décider** avant d'activer. Le code ne tranche
> **aucune** de ces décisions à votre place.
>
> Miroir défensif de [COLD_ARCHIVE.md](COLD_ARCHIVE.md). **Différence clé** : l'archivage *exporte*
> en lecture seule ; la purge **SUPPRIME** (irréversible). D'où la sécurité renforcée (triple verrou,
> audit obligatoire, suppression bornée par batch).

## 1. Ce que fait (et ne fait pas) le mécanisme

- **Fait** : supprime les enregistrements d'une cible désignée dont la durée de conservation légale
  est expirée (plus vieux que `now - retentionDays`), par **batchs bornés et transactionnels**
  (un `DELETE ... ORDER BY id LIMIT :batchSize` par batch côté `PurgeSource`), avec un **garde-fou
  anti-boucle** sur le nombre total de batches. Chaque run réel est **audité** (qui / quand / quoi /
  combien) pour preuve de conformité.
- **Ne fait pas** : il ne supprime **RIEN par défaut** (triple verrou ci-dessous). Aucune durée
  légale, aucune table et aucune politique ne sont codées en dur. Le « quoi purger » est porté par
  une `PurgeSource` (SPI) fournie en code ; la durée vient de la config. Aucune `PurgeSource` n'est
  fournie dans cette phase.

## 2. Les 3 verrous d'inertie (sécurité renforcée)

| # | Verrou | Effet quand non levé |
|---|--------|----------------------|
| 1 | `clenzy.retention.purge.enabled=false` (défaut) | Le moteur `RetentionPurgeService` est totalement inerte : pas de comptage, pas de suppression (no-op `purge-disabled`). |
| 2 | Aucune `PurgeSource` fournie en code (défaut) | Rien à purger pour une cible (no-op `no-source-registered`), **même si `enabled=true`**. |
| 3 | `dry-run-default=true` (défaut) | Un appel sans `dryRun=false` explicite **compte seulement** les candidats (`deleted=0`). La suppression réelle exige un `dryRun=false` explicite. |

Le scheduler ajoute une garde supplémentaire : il n'exécute une purge automatique que si
`enabled` **ET** `scheduler-enabled` sont vrais (les deux `false` par défaut).

## 3. Décisions à prendre AVANT d'activer (obligatoire)

| # | Décision | Détail |
|---|----------|--------|
| a | **Quelles données purger** | Matérialisé par une `PurgeSource` (voir §5). Une cible sans source ne purge rien. |
| b | **Durée de conservation** | **DÉFINIE** dans [RETENTION-POLICY.md](RETENTION-POLICY.md) (FR + MA + KSA + exigences OTA), portée par `Target.retentionDays` + `legalBasis`. **À faire valider par un avocat/DPO** (points ouverts au §7 de la politique). |
| c | **Validation humaine** | Toujours lancer un **dry-run** d'abord (§6) pour vérifier le volume de candidats, puis décider explicitement de la suppression réelle. |

## 4. Contrat de configuration — `clenzy.retention.purge.*`

```yaml
clenzy:
  retention:
    purge:
      enabled: false           # VERROU 1 — ne passer à true qu'après avoir tranché 3a/3b/3c
      scheduler-enabled: false # purge automatique uniquement si enabled ET scheduler-enabled
      dry-run-default: true    # VERROU 3 — un appel sans dryRun explicite ne supprime RIEN
      batch-size: 500          # borne par batch (défaut 500, max 5000) — transaction par batch
      targets:                 # vide par défaut ; politique : RETENTION-POLICY.md
        # --- EXEMPLES COMMENTÉS (NON ACTIFS) — voir §7 "Purges en attente d'une entité" ---
        # - name: police-records
        #   description: "Fiche de police voyageurs étrangers"
        #   retention-days: 180        # 6 mois (CESEDA R814-3)
        #   legal-basis: "FR CESEDA R814-1/R814-3 (purge obligatoire à 6 mois)"
        # - name: payment-dispute-proof
        #   description: "Preuve de contestation de paiement (chargeback)"
        #   retention-days: 450        # 13-15 mois (CNIL 2018-303)
        #   legal-basis: "CNIL délib. 2018-303 + CMF L133-24"
```

- Une `Target` porte `name` (identifiant stable, doit matcher une `PurgeSource`), `description`,
  et la politique `retention-days` (durée de conservation, en jours) + `legal-basis`
  (cf. [RETENTION-POLICY.md](RETENTION-POLICY.md)). Une cible dont `retention-days` est absent ou
  ≤ 0 est **volontairement non purgeable** (no-op `retention-not-configured`).
- `batch-size` est clampé à 5000 max : la suppression reste **bornée**, jamais une grosse
  transaction unique.

## 5. Fournir une `PurgeSource` (le « quoi purger »)

Le moteur est **générique** : il ne connaît aucune table. Pour purger un domaine, fournir un bean
implémentant `com.clenzy.service.retention.PurgeSource` dont `targetName()` correspond à un
`clenzy.retention.purge.targets[].name`. **Aucune source n'est fournie par défaut** (verrou 2).
Contrat (suppression = irréversible, donc strict) :

- `countExpired(cutoff)` en **lecture seule** : compte les enregistrements dont l'horodatage de
  référence est `<= cutoff`. Utilisé en dry-run.
- `deleteExpiredBatch(cutoff, limit)` : supprime **au plus** `limit` enregistrements `<= cutoff`,
  dans une **transaction propre par batch** (`@Transactional` sur la méthode du repository/service
  appelé), en **tri stable** (ex : `ORDER BY id`). Retourne le nombre réellement supprimé ; `0`
  signale la fin au moteur.
- **Idempotent / répétable** : re-jouer avec le même cutoff ne doit jamais sur-supprimer.
- Le `cutoff` est calculé par le moteur (`now - retentionDays`, `Clock` injecté) — la `PurgeSource`
  **ne décide pas** de la durée.

## 6. Comment déclencher (dry-run d'abord)

Opération **manuelle**, **SUPER_ADMIN** uniquement.

**Étape 1 — dry-run (recommandé, défaut)** — compte les candidats, ne supprime RIEN :
```
POST /api/admin/retention/purge?target=police-records
POST /api/admin/retention/purge?target=police-records&dryRun=true
```
```json
{ "target": "police-records", "executed": true, "dryRun": true, "reason": "dry-run",
  "candidates": 42, "deleted": 0 }
```

**Étape 2 — suppression réelle** — exige `dryRun=false` EXPLICITE :
```
POST /api/admin/retention/purge?target=police-records&dryRun=false
```
```json
{ "target": "police-records", "executed": true, "dryRun": false, "reason": "ok",
  "candidates": 42, "deleted": 42 }
```

`reason` possibles en no-op (`executed=false`) : `purge-disabled`, `unknown-target`,
`no-source-registered`, `retention-not-configured`.

**Automatique (scheduler)** : `RetentionPurgeScheduler` tourne tous les jours à **3h30 UTC**
(`0 30 3 * * *`) et appelle `purgeAllConfigured(false)` (suppression réelle) — **uniquement si**
`enabled && scheduler-enabled` (les deux `false` par défaut → scheduler totalement inerte).

## 7. Purges en attente d'une entité

Certaines obligations de purge de [RETENTION-POLICY.md](RETENTION-POLICY.md) **ne peuvent pas encore**
être implémentées en `PurgeSource`, faute d'entité ou de donnée stockée :

- **Fiche de police (CESEDA R814-3, purge à 6 mois)** — la fiche de police des voyageurs étrangers
  **n'a PAS d'entité dédiée** dans Baitly aujourd'hui (cf. §6 de la politique : *« entité dédiée à
  créer ; cf. `RegulatoryConfig` »*). La `PurgeSource` `police-records` ne pourra être écrite
  **qu'une fois cette entité modélisée**. La cible d'exemple `retention-days: 180` est donc
  **commentée** (§4) et inerte.
- **Preuve de contestation CB (13-15 mois)** — la preuve de chargeback / les données carte **ne sont
  pas stockées** côté Baitly : PAN et preuve sont **délégués au PSP Stripe** (cf. politique §2/§4).
  Il **n'y a donc pas de cible** côté PMS — la purge relève de la rétention Stripe, pas de ce moteur.
  La cible d'exemple `payment-dispute-proof` est documentaire/commentée, sans source.

> En clair : le framework est prêt et inerte. Activer une purge réelle suppose, pour chaque cible :
> (1) une entité/table à purger qui existe, (2) une `PurgeSource` qui l'opère, (3) la levée des
> trois verrous, (4) un dry-run validé. Les durées et bases légales viennent **uniquement** de
> [RETENTION-POLICY.md](RETENTION-POLICY.md), jamais du code.
