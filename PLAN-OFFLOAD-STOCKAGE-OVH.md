# Plan d'action — Alléger PostgreSQL : offload vers OVH Object Storage & Cold Archive

> Objectif : sortir les **binaires** (images en BYTEA) et les **documents générés** (sur disque) de la base/du VPS vers **OVH Object Storage (S3)**, et archiver les données froides de conformité (OTA/fiscal) vers **OVH Cold Archive**. La DB ne garde que le relationnel → backups rapides, RAM/disque allégés.

## Constat (code réel)
- **Images** : `PhotoStorageService` (interface : `store/retrieve/assertReadableInCurrentOrg/delete`) ; impl actuelle `LocalPhotoStorageService` (@Service) = **PostgreSQL BYTEA** via `PropertyPhotoRepository`. Le code prévoit déjà : « implement an S3-based PhotoStorageService and activate it via `@Profile("s3")` or config flag ».
- **Documents générés** (PDF, factures, reçus, contrats, pièces jointes) : `DocumentStorageService` & co. écrivent sur le **disque** (`/app/uploads/documents/{type}/{mois}/…` via `Files.write`, path-traversal déjà gardé).
- **Service cible = OVH Object Storage** (service 100% OVH, données hébergées chez OVH — **rien chez AWS**).

## Choix du client (sans AWS)
> ⚠️ « S3 » désigne ici un **protocole/API** (standard de l'industrie : MinIO, Backblaze, Cloudflare R2… l'implémentent), **pas** l'infra AWS. OVH Object Storage propose deux API ; on n'utilise **aucune** brique AWS :
- **Recommandé — OVH Object Storage « API S3 » + client MinIO Java** (`io.minio:minio`) : client **vendor-neutral** (pas AWS), endpoint OVH, données chez OVH. Simple, future-proof. *(Nouvelle dépendance `io.minio:minio` ; on n'utilise PAS `software.amazon.awssdk` même s'il est présent.)*
- **Alternative — OVH Object Storage « API Swift »** (OpenStack natif OVH) + client `openstack4j`/REST : 100% protocole OVH-natif, aucun rapport avec S3. Plus verbeux, abstraction différente.

> Quel que soit le choix, l'abstraction `ObjectStorageClient` (voir Phase 1) **masque le protocole** : le reste du code (`PhotoStorageService`, services de documents) ne dépend QUE de cette interface — on peut changer MinIO↔Swift sans toucher au métier.

## Pré-requis OVH (à faire une fois, côté console)
- Créer un **Object Storage S3** (région EU, ex. `gra`), classe Standard.
- Bucket **`baitly-media`** (images + documents actifs) ; bucket **`baitly-archive`** (Cold Archive, Object Lock activé).
- Générer les **credentials S3** (access key / secret) d'un utilisateur dédié, droits restreints aux buckets.
- Secrets en env : `S3_ENDPOINT` (`https://s3.gra.io.cloud.ovh.net`), `S3_REGION` (`gra`), `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET_MEDIA`, `S3_BUCKET_ARCHIVE`.

---

## Phasage

### Phase 1 — Abstraction Object Storage + config (SÛR · aucune migration de données · automatisable)
**But** : pouvoir stocker sur **OVH Object Storage**, derrière un **flag** par défaut sur `bytea` → **zéro changement de comportement** tant qu'on ne flippe pas.
- `ObjectStorageClient` (wrapper **MinIO Java SDK** `io.minio:minio`) : `put(key, bytes, contentType)`, `get(key)`, `delete(key)`, `presignGet(key, ttl)`. Config OVH : `MinioClient.builder().endpoint(OVH_ENDPOINT).credentials(access, secret).region(region)` (path-style natif MinIO) + SSE. *(Aucune brique AWS.)*
- `ObjectStoragePhotoService implements PhotoStorageService` :
  - `store` → upload vers `baitly-media` avec **clé org-scopée** `org/{orgId}/photos/{uuid}` (renvoie la clé).
  - `retrieve` → download par clé.
  - `assertReadableInCurrentOrg(key)` → **fail-closed** : parser l'`orgId` de la clé et le comparer au tenant courant (équivalent sécurité de l'impl BYTEA).
  - `delete` → suppression objet.
- Activation : flag `clenzy.storage.photos=bytea|object` (défaut **bytea**) — `@ConditionalOnProperty` / `@Primary` selon le flag. (Conserver `LocalPhotoStorageService` comme défaut.)
- **Sécurité** : pas d'URL publique → **URLs présignées TTL court** pour le front ; chiffrement SSE ; secrets en env (jamais en dur).
- **Tests** : S3 mocké (ou testcontainers MinIO) — store→retrieve, ownership cross-org refusé, delete.
- **Risque** : nul (défaut inchangé). **Validation** : `mvn package` vert.
→ **C'est le PROMPT à lancer (ci-dessous).**

### Phase 2 — Documents générés → Object Storage
- Introduire une impl Object-Storage derrière les services de documents (`DocumentStorageService`, `ReceiptStorageService`, `ContactFileStorageService`, `DocumentTemplateStorageService`, `InvoicePdfService`) — réutiliser `ObjectStorageClient`, même flag.
- Clés org-scopées `org/{orgId}/documents/{type}/{aaaa-mm}/{uuid}.pdf`.
- Lecture via URL présignée. Path-traversal déjà géré côté actuel.
- **Risque** : faible (nouveaux docs sur S3 ; anciens migrés en Phase 3).

### Phase 3 — Bascule + migration one-shot (COORDONNÉ · touche la prod-data)
- Créer le bucket OVH + injecter les secrets ; **flip** `clenzy.storage.photos=s3`.
- **Job de migration idempotent** (batch, repris en cas d'échec) :
  - photos BYTEA → upload S3 → mettre à jour la référence (clé) → **vérif checksum** → marquer migré.
  - documents disque → upload S3 → MAJ référence.
- Vérifier les lectures (échantillon) AVANT de purger.
- Après validation : purger les BYTEA + `VACUUM (FULL)` pour **récupérer l'espace disque/DB** ; vider `/app/uploads`.
- **Snapshot VPS + dump DB avant.** **Rollback** : flag → `bytea` + restaurer (les BYTEA ne sont purgés qu'après validation).

### Phase 4 — Cold Archive (conformité OTA / fiscal)
- Identifier les données **froides à conserver** (résas/factures NF > N ans).
- **Partitionner** les grosses tables par année (ou table d'archive) ; job d'**export** (dump par partition) vers bucket **`baitly-archive`** avec **Object Lock / rétention (WORM)** = immuabilité (preuve de conformité).
- Documenter la **politique de rétention** par type (durée légale) dans le dossier sécurité.
- Détacher/dropper les vieilles partitions de la base chaude une fois archivées (selon politique).

### Phase 5 — (option) Managed Database PostgreSQL
- Une fois la base allégée, envisager OVH Managed DB (backups/HA managés) — supprime le SPOF base. Non urgent.

## Sécurité & conformité (transverse)
- Clés **org-scopées** + `assertReadableInCurrentOrg` fail-closed (pas d'IDOR sur les objets).
- **URLs présignées** TTL court (jamais de bucket public).
- **SSE** (chiffrement au repos) côté bucket ; secrets en env.
- Archives : **Object Lock/WORM** + rétention = conformité OTA/fiscal.

## Ordre & validation
**Phase 1 (code, sûr) → Phase 2 (docs) → Phase 3 (bascule + migration, fenêtre planifiée + snapshot) → Phase 4 (archivage) → Phase 5 (option).** Chaque phase : `mvn package` + tests verts ; phases 3-4 : snapshot/dump + rollback testé.

---

## PROMPT À LANCER — Phase 1 (abstraction S3, sûr)

> À donner à un agent. Implémente le stockage S3 OVH derrière un flag par défaut `bytea` → aucun changement de comportement, mergeable sans risque.

```
Mission : implémenter le stockage objet S3 (OVH Object Storage) pour les images, derrière un flag,
SANS changer le comportement par défaut. Repo : server (Java 21 / Spring Boot). NE PAS migrer de
données (ça vient plus tard). NE PAS lancer mvn (compilation centrale). NE PAS committer.

CONTEXTE :
- Interface existante : com.clenzy.service.PhotoStorageService { String store(byte[],contentType,filename);
  byte[] retrieve(String key); void assertReadableInCurrentOrg(String key); void delete(String key); }
- Impl actuelle LocalPhotoStorageService (@Service) = PostgreSQL BYTEA (à CONSERVER comme défaut).
- Client : MinIO Java SDK (io.minio:minio) — VENDOR-NEUTRAL, AUCUNE brique AWS. Ajouter la dépendance
  io.minio:minio au pom ; NE PAS utiliser software.amazon.awssdk (même s'il est présent).
- Cible : OVH Object Storage (service OVH, API compatible S3 — données 100% chez OVH).
- TenantContext fournit l'org courante.

À IMPLÉMENTER :
1. ObjectStorageClient (@Component) : wrapper MinIO configuré pour OVH —
   MinioClient.builder().endpoint(OBJECT_ENDPOINT).credentials(ACCESS_KEY, SECRET_KEY).region(REGION).build().
   Méthodes : put(key,bytes,contentType), get(key)->byte[], delete(key), presignGet(key,Duration) (URL présignée).
   Config @ConfigurationProperties clenzy.storage.object.{endpoint,region,access-key,secret-key,bucket-media}
   (valeurs via env, défauts vides).
2. ObjectStoragePhotoService implements PhotoStorageService (activé par flag) :
   - store : clé org-scopée "org/{orgId}/photos/{uuid}" (orgId depuis TenantContext) → put → retourne la clé.
   - retrieve : get(key).
   - assertReadableInCurrentOrg(key) : FAIL-CLOSED — extraire orgId de la clé, comparer au tenant courant,
     AccessDeniedException sinon (bypass platform staff comme le pattern SmartLockService si pertinent).
   - delete : delete(key).
3. Activation par flag clenzy.storage.photos=bytea|object (défaut bytea) via @ConditionalOnProperty + @Primary
   sur l'impl active. LocalPhotoStorageService reste le défaut → comportement INCHANGÉ hors flag.

CONTRAINTES SÉCURITÉ : pas d'URL publique (présignée TTL court) ; jamais de secret en dur ; clé org-scopée.

TESTS (mockito ou testcontainers MinIO si dispo) : store→retrieve round-trip ; assertReadableInCurrentOrg
refuse une clé d'une autre org ; delete ; le défaut reste LocalPhotoStorageService quand flag absent.

RAPPORTER : fichiers créés, le contrat de config (clés clenzy.storage.s3.*), comment flipper le flag,
les tests, et ce qui reste pour la Phase 2 (documents) et Phase 3 (migration des BYTEA existants).
```
