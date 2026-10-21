# Annuaire de professionnels Baitly : Sirene et OpenStreetMap

## Parcours livré

`/prestataires?view=references` propose une liste et la carte partagée Baitly.
Les utilisateurs authentifiés consultent les références. SUPER_ADMIN et
SUPER_MANAGER peuvent rechercher, référencer, rapprocher et retirer les fiches.
Le catalogue de prestataires inscrits, les contacts CRM privés et les demandes
de devis conservent leurs règles existantes. Une référence n'est pas un compte,
une qualification vérifiée ou une offre réservable.

### Imports dans le CRM d'une organisation

Les conciergeries et propriétaires ayant `baitly-crm:view` et `baitly-crm:manage`
peuvent utiliser **Rechercher des professionnels** depuis Prospection ou l'annuaire.
Le même formulaire propose la ville, l'activité et la sélection multi-pages.
**Importer dans mon CRM** est aussi disponible sur chaque référence de l'annuaire.
Les mutations globales restent réservées aux SUPER_ADMIN et SUPER_MANAGER.

Les endpoints `/api/prospects/professional-imports` valident la gestion de
l'organisation active et son type (CONCIERGE, INDIVIDUAL ou SYSTEM pour l'équipe
plateforme). Aucun identifiant d'organisation cible n'est accepté du navigateur.
Les tickets de recherche CRM sont liés à l'acteur **et** à cette organisation :
un changement d'organisation impose une nouvelle recherche. Un ticket global
ne peut pas être réutilisé pour importer dans un CRM.

Le changeset `0578-baitly-crm-professional-imports` stocke le SIRET, le contact
local, l'auteur, les dates, la licence, le lien et le snapshot de provenance.
Son unicité `(organization_id,siret)` conserve l'indépendance des CRM. L'import
prend le verrou d'organisation déjà partagé avec les autres mutations CRM.
Il vérifie les SIRET importés, les noms/villes des contacts existants et, pour
les coordonnées OSM disponibles, les identités normalisées et leurs historiques.
Un rapprochement incertain retourne REVIEW sans fusion ni écrasement ; les
archives et références globales retirées empêchent la recréation concernée.

Les nouveaux contacts ont une provenance OPEN_DATA et une nature PROFESSIONAL.
La société et la catégorie sont renseignées à partir de la source. Le téléphone,
l'email et le site disponibles dans une référence OSM confirmée sont repris après
validation de format. Aucune autorisation de contact n'est créée ou réactivée.
Aucune position n'est copiée, même depuis une référence globale déjà localisée.
Le parcours CRM existant propose puis confirme explicitement la correspondance
OSM, depuis la fiche ou la file « À localiser » de la carte. L'import ne déclenche
ni recherche OSM en lot ni envoi de messages.

Après chaque import CRM, l'action **Valider les correspondances OSM** ouvre
directement cette carte avec une file limitée aux identités CREATED et EXISTING
du résultat. Les identifiants sont dédoublonnés ; les résultats REVIEW, REMOVED
et CATALOGUE restent exclus. Les contacts sont relus dans le CRM actif, et les
positions déjà enregistrées sont conservées sans nouvelle validation forcée.
Le nom, la ville, la France et la nature d'établissement public sont préremplis
pour les contacts professionnels dont la provenance est un établissement Sirene.
La recherche démarre automatiquement pour le seul contact affiché via
`POST /api/prospect-locations/{id}/osm/imported-search`. Ce parcours utilise le
client Overpass borné de l'annuaire, jamais le Nominatim public du parcours manuel.
Il relit la preuve Sirene de l'organisation et refuse les contacts privés,
archivés ou modifiés. Une correspondance OSM publique déjà validée pour le SIRET
est proposée sans requête externe. À défaut, la recherche Overpass utilise les
coordonnées Sirene ; si elles manquent, la recherche manuelle reste disponible.
Le parcours réutilise les tickets de confirmation CRM existants. Les résultats
sont cachés 24 h côté source. Le budget public OSM,
le verrou de débit global et les délais réseau restent appliqués ; une instance
dédiée est requise pour un usage régulier à grande échelle. Aucun travailleur
de géocodage en lot n'est activé. Le navigateur ne précharge pas les contacts
suivants et n'effectue qu'une reprise différée d'une limitation HTTP 429.
La première proposition est présélectionnée sans être enregistrée ; le SIRET
différent est rejeté avant proposition. L'utilisateur peut sélectionner une autre
proposition, réessayer en cas d'erreur ou passer pendant une recherche en cours.
La réponse d'un contact quitté est ignorée. Après confirmation, le repère persistant apparaît
et la file passe au suivant. Passer un contact n'enregistre aucune position ; une
erreur conserve le contact courant. Le retour est bloqué pendant une confirmation.
Le même parcours est proposé après l'import unitaire depuis l'annuaire partagé.

1. Rechercher la ville via l'API Découpage administratif puis choisir la commune
   et une famille de services. Le nom ou SIRET reste un filtre facultatif.
   La recherche utilise l'API publique Recherche d'entreprises (données Sirene).
2. Cocher les établissements actifs et totalement diffusibles à importer, ou
   sélectionner la page entière. La sélection est conservée entre les pages,
   jusqu'à 100 établissements par import et dans la durée de validité des tickets.
3. Demander les lieux OSM dans un rayon de 1,5 km des coordonnées Sirene.
4. Examiner le nom, l'adresse, le SIRET éventuel, le code postal et le lien OSM.
5. Confirmer une proposition : seuls ses contacts et sa position sont publiés.

Les lieux proches sans concordance restent présentés comme proximité seulement.
Un SIRET explicitement différent est éliminé. Aucune position issue d'une simple
proposition n'est publiée. Les établissements sans coordonnées Sirene restent
dans la liste et ne peuvent pas être rapprochés par ce premier parcours.

## Identité et provenance

Les familles CLEANING, MAINTENANCE, LAUNDRY, EXTERIOR et CONCIERGE reprennent le
vocabulaire du catalogue existant. Les codes NAF associés sont définis dans
`BaitlyProfessionalSearchFilters`. Le filtre amont porte sur l'unité légale ;
Baitly vérifie aussi l'activité et la commune de chaque établissement retourné.
Il s'agit d'une découverte indicative, pas d'un annuaire exhaustif de services.
Les recherches directes par SIRET ignorent les filtres amont : le contrôle local
reste donc obligatoire. Paris, Lyon et Marseille incluent leurs arrondissements.

`POST /api/professional-directory/sirene/confirm-batch` valide tous les tickets
et leurs indices avant toute écriture. Chaque choix garde le ticket de sa page.
Une transaction sérialisée importe la sélection dédoublonnée par SIRET. Le
rapport distingue CREATED, EXISTING, CATALOGUE et REMOVED, sans écraser une fiche
existante ni recréer une fiche retirée. Une erreur de ticket annule tout le lot ;
une erreur SQL entraîne le rollback transactionnel. Aucune recherche ou validation
OSM n'est déclenchée par l'import. Les nouvelles positions publiées restent nulles.
Changer les filtres efface la sélection pour éviter les imports hors périmètre.

La table globale `baitly_directory_professionals` impose l'unicité du SIRET et
du lieu OSM. Les écritures concurrentes sont sérialisées par verrou transactionnel.
Les rapprochements possibles avec `marketplace_providers` par SIRET ou nom/ville
bloquent l'ajout et ne fusionnent jamais automatiquement des comptes.
Les informations privées d'une organisation ne sont pas utilisées comme source.

Chaque validation crée une preuve dans `baitly_directory_source_evidence` :
source, URL, licence, données choisies, date de consultation et auteur.
L'adresse Sirene et l'adresse OSM sont distinctes. Un remplacement conserve
les preuves antérieures. Les candidats expirent après 10 minutes, sont liés à
l'acteur, à la fiche et à sa version. Le navigateur ne peut pas imposer ses
propres coordonnées dans la requête de confirmation.

Le retrait efface les coordonnées de contact et les preuves détaillées, masque
la fiche et empêche sa réimportation. Le SIRET conservé sert de liste repoussoir.
Il n'envoie aucun message aux professionnels et n'accorde aucune autorisation
de prospection au CRM.

## Sources et exploitation

- Sirene : Licence Ouverte 2.0 ; respecter le statut de diffusion et les droits
  des professionnels, y compris les adresses d'entrepreneurs individuels.
- OSM : ODbL 1.0, attribution affichée ; examiner les obligations de partage
  des bases dérivées avant toute exportation ou redistribution étendue.
- Les données de dirigeants et de finances retournées par la recherche sont
  supprimées avant la mise en cache. Les résultats externes sont cachés 24 h,
  la date de consultation affichée peut donc porter sur un résultat en cache.
- Première version assistée, sans aspiration nationale ni synchronisation
  automatique des fermetures/changements de diffusion. Prévoir la procédure
  d'information, de correction, de retrait et de revue périodique avant une
  publication à grande échelle. Aucune information juridique de conformité
  n'est déduite de la seule présence dans Sirene ou OSM.
- Activité APE affichée comme activité déclarée. Les prestations, tarifs,
  disponibilités et zones d'intervention doivent être confirmés par le professionnel.

## Configuration serveur

- `baitly.directory.sirene-url` : défaut
  `https://recherche-entreprises.api.gouv.fr/search`, sans clé.
- `baitly.directory.overpass-url` : défaut
  `https://overpass-api.de/api/interpreter`, pour recherches ponctuelles.
  Budget commun de découverte : 60 recherches non cachées par 24 h et environ
  10 Mo de réponses maximum. Une instance dédiée n'utilise pas ce budget public.
  Pour l'exploitation régulière en production, utiliser une instance dédiée
  ou une infrastructure adaptée selon la politique du serveur choisi.
- Redis requis : cache, limitation globale, propositions de validation.
- Villes : `https://geo.api.gouv.fr/communes`, nom et codes postaux pour lever
  les homonymes, puis code INSEE pour filtrer les établissements.
- Réponses limitées à 2 Mo, délais réseau, absence de redirections, gestion
  des réponses 429 et attente `Retry-After`. Endpoints HTTPS configurés côté
  opérateur uniquement, jamais fournis par les utilisateurs.
- Migration Liquibase `0577-baitly-professional-directory`, automatique au
  prochain démarrage par le flux CI/CD habituel. Ne pas exécuter de SQL manuel.

## Vérifications

Tests unitaires : projections publiques, statut de diffusion, contacts, indices
de correspondance, tickets expirés ou d'un autre acteur et autorisations.
Test PostgreSQL opt-in : `-Dbaitly.directory.test.jdbc=jdbc:postgresql://127.0.0.1:55442/postgres`.
Il applique le changeset réel, vérifie l'idempotence, les preuves, la validation
OSM, le rejet d'une proposition périmée et le retrait sans réimportation.
Tests frontend : sélection explicite multi-pages, remise à zéro au changement
de filtres, reprise après erreur, droits et absence de repère
avant validation. Ne pas lancer de preview sans demande utilisateur.
