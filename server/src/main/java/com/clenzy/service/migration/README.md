# Import des exports PMS dans Baitly

Entrée produit : **Paramètres → Migration PMS** (`/settings?tab=migration`).
Le guide de démarrage propose aussi cette migration aux hôtes et administrateurs,
avec une action **Continuer sans migrer** enregistrée côté serveur. Un import terminé
valide l'étape automatiquement ; un brouillon ne la valide pas. L'ajout de cette étape
facultative ne rouvre pas un guide déjà terminé.
API authentifiée : `/api/migration/imports`, rôles HOST / SUPER_MANAGER / SUPER_ADMIN.
Organisation obligatoire ; un lot appartient à son créateur. Les propriétés liées sont
contrôlées par organisation et par propriétaire pour les HOST.

## Périmètre effectif

CSV (virgule, point-virgule, tabulation, pipe, cellules citées/multilignes), TSV,
Excel XLS/XLSX (toutes les feuilles), JSON (objets, tableaux, enveloppes), ZIP.
L'encodage texte se choisit explicitement. Les formules Excel ne sont jamais exécutées :
elles doivent être exportées en valeurs. Les dates texte exigent le choix ISO / DMY /
MDY / numéro de série Excel 1900. Pas de conversion implicite UTC/date locale ou hégirienne.

Les lecteurs ne dépendent pas d'une liste fermée de PMS. Les alias de colonnes ne
constituent **pas** une certification des exports d'un fournisseur. Les fixtures sont
synthétiques ; les variations réelles doivent être validées sur des échantillons autorisés.

Les logements, voyageurs et réservations deviennent des entités Baitly. Les réservations
doivent être confirmées ou annulées. Les logements nécessitent adresse, type, pièces,
devise et fuseau explicites ; ils sont attribués à l'utilisateur importateur et ne sont
pas publiés dans le moteur de réservation. Les réservations peuvent référencer des
logements/voyageurs importés dans ce lot ou un lot précédent du même compte source.
On peut aussi associer chaque référence de logement à un logement Baitly existant.

Avis (`REVIEW` → `guest_reviews`), tarifs par nuit (`RATE` → `rate_overrides`, source `PMS_IMPORT`) et
tâches (`TASK` → `interventions`, statut repris, aucune assignation ni notification) sont aussi
matérialisés. Un tarif déjà présent pour la nuit (`RATE_EXISTS`) ou un avis déjà importé
(`REVIEW_EXISTS`) est signalé, jamais écrasé. Frais de ménage, taxe de séjour et taxes sont repris
sur la réservation. Les statuts qui ne sont pas des séjours (demande, inquiry, refus, expiré,
blocage) sont comptés dans `skipped` et ne bloquent pas le lot. Les autres jeux de données
(messages, pièces comptables, propriétaires, etc.) restent des **archives**, pas des objets métier natifs. PDF, photos, ICS et XML restent des pièces
inertes, tout comme les formats propriétaires non interprétés. Aucune URL distante n'est téléchargée. Une archive n'est jamais annoncée comme
une intégration métier. Les fichiers originaux, leur SHA-256 et les colonnes supplémentaires
sont récupérables par l'export JSON du lot. L'export complet du compte
Baitly et les connecteurs API sont décrits plus bas.

## Intégrité et effets opérationnels

1. Upload limité à 8 Mio / 20 fichiers, 5 000 lignes, 256 colonnes et 100 jeux de données.
   ZIP et XLSX ont un budget commun de décompression de 24 Mio ; pas de ZIP imbriqué.
2. Sources, fichiers originaux, mappings et rapport résident en base, chiffrés par
   `EncryptedFieldConverter`. Les tableaux de bord des imports ne chargent pas ces payloads.
3. Prévisualisation sans écriture métier. Toute modification des correspondances invalide
   l'approbation dans l'interface ; le commit réclame le jeton enregistré côté serveur.
4. Identité stable = organisation + PMS + compte source + type + identifiant externe.
   Réimport identique ignoré, contenu modifié refusé (pas d'écrasement). Les références
   restent des chaînes, avec préservation des zéros initiaux. Un identifiant déjà arrondi
   par le logiciel exporteur ne peut pas être reconstitué.
5. Revalidation au commit, verrou du lot, unicité SQL des références et transaction
   atomique. Contrôles groupés des conflits avec le calendrier et les réservations existantes.
6. Les nuits confirmées sont réservées via CalendarEngine (verrou par logement + contrôle
   de conflit + invalidation du cache). Pas de recalcul des prix, factures, paiements, OTA
   outbox ou envoi de messages. Les automations de réservation et le rattrapage ménage restent
   suspendus via `migration_automation_paused`. La bascule OTA est une opération séparée.

Les montants sont décimaux exacts, séparés par devise dans le bilan. Le champ payé est
repris uniquement lorsqu'il est fourni. Les identifiants Stripe, moyens de paiement et
identifiants de connexion OTA ne sont jamais transférés vers les entités actives.

## Extension

Ajouter un lecteur dans `PmsExportReader`, ou un type dans `ImportPlan.Kind` avec ses
champs/normalisations dans `PmsImportSchema`, puis sa matérialisation transactionnelle
dans `PmsImportService`. Toute nouvelle intégration doit définir les relations, la
déduplication, les effets autorisés et le rapprochement de totaux. Ne jamais activer des
automatisations sur des archives historiques pour donner l'impression d'une intégration.

Tests : `PmsExportReaderTest`, `PmsImportSchemaTest`, `PmsImportServiceTest`,
`PmsImportSchemaPostgresTest`, plus régressions CalendarEngine/automations/ménage et
`PmsImportWorkspace.test.tsx`. Le test PostgreSQL est activé uniquement par
`-Dbaitly.import.test.jdbc=jdbc:postgresql://127.0.0.1:PORT/baitly_import_test` sur une base
jetable locale. Il exécute le vrai changeset 0491 et les politiques RLS.

## Profils éditeurs (`PmsVendorProfiles`)

La source choisie à l'import (`smoobu`, `beds24`, `hostaway`, `guesty`, `hospitable`, `ownerrez`,
`baitly`) ajoute des noms de colonnes à essayer en premier. Les profils éditeurs reprennent les noms
de champs des API publiques (présents dans leurs exports JSON) : ce sont des suggestions, pas une
certification des exports écran, qui varient selon la langue et la version du compte. Le profil
`baitly` relit l'export complet de Baitly (`csv/` mappé, `json/`, `files/` et manifeste en archive).
Une colonne nommée exactement comme la clé de champ l'emporte toujours sur les alias.

## Connecteurs API (`service/migration/api`)

`POST /api/migration/imports/api` lit Smoobu, Beds24, Hostaway, Guesty, Hospitable ou OwnerRez en
lecture seule et crée un **brouillon** d'import ordinaire (colonnes canoniques + pages brutes en
archive) : rien n'est écrit avant validation et commit. Les identifiants servent à cet appel
uniquement : ni stockés, ni journalisés, ni renvoyés. Hôtes fixes (les liens de pagination qui
sortent de l'hôte de l'éditeur sont refusés), 60 pages et 5 000 lignes au plus, 3 reprises sur 429.
Les appels HTTP ont lieu hors transaction. Endpoints et champs suivent la documentation publique
de chaque éditeur : connecteurs **bêta** tant qu'ils n'ont pas été validés sur un vrai compte ;
une réponse inattendue échoue avec `API_RESPONSE_UNEXPECTED` plutôt que d'importer partiellement.

## Bascule et adoption par le channel manager

Une réservation importée (`externalUid = baitly-import:…`) est **adoptée** par le premier événement
Channex qui porte le même code de confirmation OTA dans le logement mappé (un seul candidat exigé).
Pas de doublon ; l'email et le téléphone du voyageur, souvent absents des exports OTA, sont complétés.

`/api/migration/plan` conserve le plan de bascule (changeset 0493, RLS) : date de fin d'accès, préavis,
échéances calculées (résiliation = fin − préavis ; exports = fin − 7 jours) et liste d'étapes.
`IMPORT_COMMITTED` est déduite des lots terminés et ne se coche pas à la main.

## Export complet du compte (`service/export/AccountExportService`)

`GET /api/account/export` produit un ZIP en libre-service : `csv/` réimportable (en-têtes = clés de
champ), `json/` (toutes les colonnes des tables opérationnelles, en texte, hors secrets, identifiants
de prestataires de paiement et blobs), `files/` (photos), `imports/` (fichiers d'origine) et
`manifest.json` (volumes, exclusions, SHA-256 de chaque fichier). Le personnel plateforme exporte
l'organisation ; un hôte, ses logements et ce qui en dépend. Les voyageurs passent par l'entité
(déchiffrés). Aucun mécanisme de résiliation d'organisation n'existe encore : la fenêtre de 30 jours
après résiliation affichée sur le site devra être appliquée par ce futur flux.

Tests : `PmsApiConnectorsTest`, `PmsMigrationPlanServiceTest`, `AccountExportServiceTest`,
`ChannexImportedReservationAdoptionTest`, et `AccountExportPostgresTest` (même propriété
`baitly.import.test.jdbc` que ci-dessus : SQL d'export et changeset 0493 sur une vraie base).
