# Archivage froid (OVH Cold Archive) — guide d'activation

> **Etat : MECANISME INERTE PAR DEFAUT.** Tant que `clenzy.archival.enabled=false` (defaut)
> **et** qu'aucune `ArchivalSource` n'est fournie en code, rien n'est lu, exporte ou supprime.
> Ce document liste ce que **l'exploitant doit decider** avant d'activer. Le code ne tranche
> **aucune** de ces decisions a votre place.

## 1. Ce que fait (et ne fait pas) le mecanisme

- **Fait** : exporte des donnees froides designees vers un bucket S3-compatible OVH en classe
  « Cold Archive », au format **NDJSON** (une ligne JSON par enregistrement), en **lecture seule**
  sur la base, par batch borne, avec une cle d'archive **deterministe** (idempotent).
- **Ne fait pas** : il **n'efface RIEN** en base. Aucune politique de retention legale, aucune
  table et aucune duree ne sont codees en dur. La **purge** eventuelle est une etape **separee,
  explicite et non implementee** (voir §5).

## 2. Decisions a prendre AVANT d'activer (obligatoire)

| # | Decision | Detail |
|---|----------|--------|
| a | **Quelles donnees archiver** | Ex : reservations cloturees au-dela de la periode courante, factures NF anciennes, logs/justificatifs. Materialise par une `ArchivalSource` (voir §4). |
| b | **Durees de retention legales** | **DEFINIES** dans [RETENTION-POLICY.md](RETENTION-POLICY.md) (FR + MA + KSA + exigences OTA) : comptable/fiscal **10 ans** (15 ans si bien immobilier KSA), portees par `Target.retentionYears` + `legalBasis`. **A faire valider par un avocat/DPO** (points ouverts au §7 de la politique). |
| c | **Immuabilite cote OVH** | Bucket en classe **Cold Archive** + **Object Lock / WORM** (mode COMPLIANCE recommande) pour garantir l'immuabilite fiscale/OTA des exports. Ce verrou est **cote bucket**, hors application. |

> Conformite OTA/fiscale : l'immuabilite repose **entierement** sur l'Object Lock du bucket OVH.
> L'application se contente d'ecrire l'export ; elle ne peut pas garantir le WORM seule.

## 3. Contrat de configuration

### `clenzy.storage.object.bucket-archive` (env `STORAGE_OBJECT_BUCKET_ARCHIVE`)
Nom du bucket d'archive froid. **Defaut vide** => archivage inerte (aucun repli sur les buckets
medias/documents chauds : `putArchive` echoue explicitement si ce bucket n'est pas configure).
Le bucket **doit** etre provisionne cote OVH en Cold Archive + Object Lock/WORM.

### `clenzy.archival.*`
```yaml
clenzy:
  archival:
    enabled: false        # DESACTIVE PAR DEFAUT — ne passer a true qu'apres avoir tranche 2a/2b/2c
    batch-size: 500       # taille de page (borne memoire / taille des objets), defaut 500, max 5000
    targets:              # cibles d'archivage (vide par defaut ; politique : RETENTION-POLICY.md)
      - name: invoices-archive
        description: "Factures NF anciennes hors periode courante"
        retention-years: 10        # 15 si rattachement a un bien immobilier (KSA ZATCA)
        legal-basis: "C. com. L123-22 (FR) ; CGI 211 (MA) ; ZATCA VAT Reg. (KSA)"
      - name: reservations-archive
        description: "Reservations cloturees au-dela de la periode courante"
        retention-years: 10
        legal-basis: "C. conso. D213-2 (FR) ; CGI 211 (MA) ; Law of Commercial Books art. 8 (KSA)"
      - name: payment-transactions-archive
        description: "Transactions de paiement (preuve de litige / reconciliation)"
        retention-years: 10
        legal-basis: "obligation comptable ; CNIL 2018-303 (CB non stockee)"
```
- Une `Target` porte `name` (identifiant stable, doit matcher une `ArchivalSource`), `description`,
  et la politique `retention-years` + `legal-basis` (cf. [RETENTION-POLICY.md](RETENTION-POLICY.md) ;
  champs documentaires/auditables, destines a la future purge — l'export ne les lit pas). La **table**
  archivee reste decidee par la `ArchivalSource`.

## 4. Fournir une `ArchivalSource` (le « quoi archiver »)

Le moteur est **generique** : il ne connait aucune table. Pour archiver un domaine, fournir un
bean implementant `com.clenzy.service.storage.archival.ArchivalSource` dont `targetName()`
correspond a un `clenzy.archival.targets[].name`. **Aucune source n'est fournie par defaut**
(c'est ce qui garde le mecanisme inerte). Contrat :

- `fetchBatch(pageable)` en **lecture seule** (ne supprime/modifie rien), tri sur cle stable
  (ex : `id` croissant) pour une pagination sans saut/doublon.
- retourner des **records/DTO serialisables** Jackson (pas d'entites JPA lazy).

## 5. PURGE (NON implementee — etape separee et explicite)

La suppression en base apres archivage n'est **pas** cablee. Elle ne doit etre concue qu'apres :
(a) expiration de la retention legale decidee en §2b, (b) verification que l'export est complet,
immuable (Object Lock OVH) et restaurable, (c) une **validation humaine explicite**. Tant que ces
points ne sont pas tranches : **export seul, 100% non destructif**.

## 6. Comment declencher

Operation **manuelle**, **SUPER_ADMIN** uniquement, **aucun scheduler** :

```
POST /api/admin/archival/run?target=reservations-cold
```

Reponse (exemple no-op quand desactive) :
```json
{ "target": "reservations-cold", "executed": false, "reason": "archival-disabled",
  "batches": 0, "records": 0, "bytes": 0 }
```
`reason` possibles en no-op : `archival-disabled`, `unknown-target`, `archive-bucket-missing`,
`no-source-registered`. Quand l'export tourne : `executed=true`, `reason="ok"`, compteurs renseignes.

## 7. Cles d'archive (idempotence)

Format deterministe : `archive/{target}/page-NNNNNN.ndjson`. Un re-run reecrit les memes cles.
Cote OVH, l'Object Lock en mode COMPLIANCE peut **rejeter** l'ecrasement d'une version verrouillee :
c'est le comportement WORM attendu.
