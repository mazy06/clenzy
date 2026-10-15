# Restructuration de l'app mobile par rôle (2026-10-14)

Suite de [AUDIT-UX-MOBILE.md](AUDIT-UX-MOBILE.md). Décision : **réintégrer par rôle** les fonctions
des écrans hérités devenus inatteignables, **supprimer les doublons** en gardant la version la plus
aboutie, et donner à chaque rôle une navigation qui lui est propre.

## Constat de départ

`MainNavigator` envoie tous les rôles vers `BaitlyNavigator` : les navigateurs `HostNavigator`,
`HousekeeperNavigator` et `TechnicianNavigator` ne sont plus montés. 64 écrans sur 112 sont
inatteignables (calcul par graphe d'imports depuis `App.tsx`). Les administrateurs passent par
`ManagerNavigator`, imbriqué dans `BaitlyNavigator`.

## Rôles (personas)

Calculés une seule fois par `features/roles/persona.ts` (rôles Keycloak + type d'organisation),
jamais recalculés écran par écran.

| Persona | Qui | Onglets |
|---|---|---|
| Invité | non connecté | Services · Logements · Réel · Compte (connexion) |
| Propriétaire | `HOST`, organisation individuelle | Accueil · Calendrier · Logements · Compte |
| Conciergerie | `HOST`, organisation `CONCIERGE` | Accueil · Calendrier · Logements · Compte |
| Prestataire | `HOUSEKEEPER`, `TECHNICIAN`, `LAUNDRY`, `EXTERIOR_TECH` | Missions · Demandes¹ · Messages · Compte |
| Superviseur | `SUPERVISOR` | Planning · Missions · Messages · Compte |
| Administrateur | `SUPER_ADMIN`, `SUPER_MANAGER`, `ADMIN` | Planning · Missions · Messages · Plus |

Règle existante conservée : **4 onglets maximum** (dock à découpe, testé). Services (et Équipe pour la
conciergerie) sont des raccourcis de l'accueil et des rubriques du compte.

¹ seulement si le prestataire chiffre des devis (`canQuote`). Un compte qui est à la fois
propriétaire et prestataire garde la bascule d'espace dans Compte.

Messages : onglet pour les rôles terrain ; icône d'en-tête sur l'accueil pour propriétaire et conciergerie.

## Arborescence par persona

**Propriétaire**
- Accueil : à faire (devis à décider, travaux à valider), arrivées et départs du jour, interventions en cours et planifiées.
- Calendrier : calendrier des réservations / liste ; fiche réservation (modifier, encaisser).
- Logements : mes logements | annuaire. Fiche logement : vue d'ensemble, interventions, consignes, canaux, tarifs, appareils (serrures, bruit), modifier (infos, photos, équipements).
- Services (raccourci de l'accueil) : catalogue, prestataire, demande de devis.
- Compte : profil, mes devis, interventions, finances (paiements, factures), documents, avis voyageurs, abonnement, préférences, aide, suppression du compte.

**Conciergerie** : tout le propriétaire, plus
- Équipe (rubrique du compte et raccourci de l'accueil) : membres et invitations, réseau privé.
- Compte : indicateurs et rapports, tarification, reversements propriétaires (relevés, génération), mandats, publication publique, contacts de gestion, réglages d'exploitation.

**Prestataire** : missions (exécution guidée) ; demandes reçues et devis ; messages ; compte avec mes tarifs, mes paiements, mes signalements.

**Superviseur / Administrateur** : planning, missions (création, affectation, validation), messages ; Plus : équipes, demandes, incidents, documents, utilisateurs (admin), abonnement.

## Doublons : version conservée

| Fonction | Conservé | Supprimé | Raison |
|---|---|---|---|
| Accueil propriétaire | `features/owner/OwnerHomeScreen` | `screens/host/DashboardScreen` | Le Baitly est actionnable ; les arrivées/départs du jour du hérité y sont portés. |
| Liste des interventions | `features/missions/MissionsScreen` | `screens/host/InterventionsListScreen` | Groupée par état, suivi d'intervention. |
| Exécution de mission | `features/owner/MissionScreen` | `screens/housekeeper/*`, `screens/technician/*` | Étapes guidées, preuves photo, pause, signalement, inventaire. |
| Liste des logements | `features/owner/OwnerScreens` | `screens/host/PropertyListScreen` | Annuaire intégré. |
| Fiche logement | `screens/host/PropertyDetailScreen` (redessinée) | fiche Baitly minimale | Le hérité couvre consignes, canaux, interventions, tarifs. |
| Messagerie | `screens/shared/Conversation*` | `screens/host/Messaging`, `MessageDetail`, `InternalChat` | Boîte unifiée déjà en service. |
| Notifications | `features/account/NotificationsScreen` | `screens/host/NotificationsScreen` | Une seule boîte ; la route `Notifications` des notifications push y mène. |
| Profil | `features/account/*` | `screens/common/ProfileScreen` | Compte Baitly par rôle. |
| Demande de service | `features/marketplace/CreateRequestScreen` (+ création interne) | `screens/host/ServiceRequestScreen` | Le choix visuel remplace le formulaire hérité ; l'équipe crée ses interventions via `CreateInterventionScreen`. |
| Rapports | `screens/host/AnalyticsScreen` | `screens/host/RevenueReportsScreen` | Analytics couvre les revenus et l'occupation. |
| Demandes et incidents admin | `screens/manager/AdminRequestsScreen` | `ServiceRequestListScreen`, `IncidentListScreen` | Déjà remplacés par les alias. |

Écrans hérités **réintégrés** (aucun équivalent Baitly) : calendrier et liste des réservations,
fiche et modification de réservation, encaissement, sous-écrans du logement, serrures et appairage
Tuya, bruit (4 écrans), tarification et plans tarifaires, paiements, factures, facturation,
reversements propriétaires et relevés, documents, avis, abonnement, réglages, équipe, utilisateurs,
tarifs / paiements / signalements prestataire, suppression du compte.

## Phases

1. Persona et navigation par rôle ; enregistrement des écrans réintégrés dans la pile Baitly.
2. Suppression des doublons et des trois navigateurs morts (preuve : graphe d'imports).
3. Redesign des écrans réintégrés : `BaitlyScreen`, primitives, textes traduits fr/en/ar.
4. Redesign de l'espace Planning / Missions des superviseurs et administrateurs.
5. Vérification dans le simulateur, persona par persona.
