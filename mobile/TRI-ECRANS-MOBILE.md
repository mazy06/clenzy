# Tri des écrans de l'app mobile — à valider

Pour chaque écran : ma recommandation. Indiquez « OK » ou corrigez la colonne **Décision**.
Aucune réécriture ne démarre avant validation.

Légende : **Garder** = conservé et redessiné · **Fusionner** = son contenu utile passe dans l'écran
indiqué, puis il disparaît · **Supprimer** = retiré.
⚠ = déjà supprimé à l'étape précédente (restaurable : `git checkout HEAD -- <fichier>`).

## 1. Propriétaire et conciergerie — quotidien

| # | Écran (fichier) | Rôle de l'écran | Recommandation | Décision |
|---|---|---|---|---|
| 1 | Accueil Baitly (`features/owner/OwnerHomeScreen`) | À faire, interventions, raccourcis | **Garder** | |
| 2 | Tableau de bord hérité (`host/DashboardScreen`) ⚠ | Compteurs, « à venir », alertes ALUR | **Fusionner** dans 1 (arrivées/départs du jour, alertes) | |
| 3 | Calendrier des réservations (`host/ReservationCalendarScreen`) | Mois, réservations + interventions par jour | **Garder** → onglet Calendrier | |
| 4 | Liste des réservations (`host/ReservationsListScreen`) | Toutes / à venir / en cours / passées | **Fusionner** dans 3 (vue « Liste ») | |
| 5 | Fiche réservation (`host/ReservationDetailScreen`) | Infos, paiement, interventions liées | **Garder** | |
| 6 | Modifier une réservation (`host/ReservationEditScreen`) | Dates, voyageurs, prix | **Garder** | |
| 7 | Encaisser une intervention (`host/PaymentCheckoutScreen`) | Paiement Stripe | **Garder** | |
| 8 | Interventions Baitly (`features/missions/MissionsScreen` + suivi) | Liste groupée par état, suivi | **Garder** | |
| 9 | Interventions héritées (`host/InterventionsListScreen`) ⚠ | Liste simple | **Supprimer** (doublon de 8) | |
| 10 | Notifications Baitly (`features/account/NotificationsScreen`) | Boîte de notifications | **Garder** | |
| 11 | Notifications héritées (`host/NotificationsScreen`) ⚠ | Idem | **Supprimer** (doublon de 10) | |
| 12 | Messagerie unifiée (`shared/ConversationScreen` + détail + modèles) | Tous canaux : voyageurs, interne | **Garder** | |
| 13 | Messagerie héritée (`host/MessagingScreen`, `MessageDetailScreen`, `InternalChatScreen`) ⚠ | Formulaire de contact, chat interne | **Supprimer** (couverts par 12) | |

## 2. Logements

| # | Écran | Rôle | Recommandation | Décision |
|---|---|---|---|---|
| 14 | Mes logements + annuaire (`features/owner/PropertiesTab`) | Liste + sélecteur annuaire | **Garder** | |
| 15 | Liste héritée (`host/PropertyListScreen`) ⚠ | Liste simple | **Supprimer** (doublon de 14) | |
| 16 | Fiche logement héritée (`host/PropertyDetailScreen`) | Hub : vue d'ensemble, interventions, canaux, consignes | **Garder** (devient LA fiche logement) | |
| 17 | Fiche logement Baitly (`features/owner/OwnerScreens` › `BaitlyPropertyScreen`) | Photos, adresse, description | **Fusionner** dans 16 | |
| 18 | Vue d'ensemble (`host/PropertyOverviewScreen`) | Description, ménage, prestations, tarification | **Fusionner** dans 16 (sections) | |
| 19 | Interventions du logement (`host/PropertyInterventionsScreen`) | Historique par logement | **Fusionner** dans 16 (liste 8 filtrée) | |
| 20 | Canaux (`host/PropertyChannelsScreen`) | Airbnb, Booking, iCal | **Garder** | |
| 21 | Consignes voyageurs (`host/PropertyInstructionsScreen`) + édition | Accès, wifi, règles | **Garder** (lecture + édition en un écran) | |
| 22 | Modifier le logement (`host/PropertyEditScreen`) | Infos générales | **Garder** | |
| 23 | Photos (`host/PropertyPhotosManageScreen`) | Ajout, ordre, suppression | **Garder** | |
| 24 | Équipements (`host/PropertyAmenitiesEditScreen`) | Liste d'équipements | **Garder** | |
| 25 | Annuaire, profils publics, comparateur (`features/conciergeries/*`, `PublicClientProfile`, `PublicProperty`) | Trouver une conciergerie / des biens | **Garder** | |

## 3. Prix, appareils, avis

| # | Écran | Rôle | Recommandation | Décision |
|---|---|---|---|---|
| 26 | Tarification (`host/PricingScreen`, 1 276 l.) | Prix par logement et par date | **Garder** | |
| 27 | Plans tarifaires (`host/RatePlanManagementScreen`) | Plans par logement | **Fusionner** dans 26 | |
| 28 | Serrures connectées (`host/SmartLockScreen`) | Nuki, codes | **Garder** | |
| 29 | Appairage Tuya (`host/TuyaPairingScreen`) | Ajouter un appareil | **Garder** | |
| 30 | Bruit : suivi, ajout, détail, alertes (4 écrans `host/Noise*`, `AddNoiseDevice`) | Capteurs Minut | **Garder**, regroupés sous « Appareils » | |
| 31 | Avis voyageurs (`host/ReviewsScreen`) | Avis et réponses | **Garder** | |

## 4. Finances et documents

| # | Écran | Rôle | Recommandation | Décision |
|---|---|---|---|---|
| 32 | Tableau de facturation (`host/BillingDashboardScreen`) | Synthèse | **Garder** comme entrée « Finances » | |
| 33 | Historique des paiements + détail (`host/PaymentHistoryScreen`, `PaymentDetailScreen`) | Paiements | **Garder** | |
| 34 | Factures + détail (`host/InvoiceListScreen`, `InvoiceDetailScreen`) | Factures | **Garder** | |
| 35 | Rapports (`host/AnalyticsScreen`, 1 211 l.) + export | Revenus, occupation | **Garder** | |
| 36 | Rapports de revenus (`host/RevenueReportsScreen`) ⚠ | Revenus | **Supprimer** (doublon de 35) | |
| 37 | Indicateurs conciergerie Baitly (`ConciergeBusinessSummary`, `BusinessActionsScreen`) | Synthèse + actions | **Garder** (porte d'entrée de 35) | |
| 38 | Documents : liste, détail, génération (`host/Documents*`) | Contrats, PDF | **Garder** | |
| 39 | Abonnement + paiement (`common/Subscription*`) | Forfait Baitly | **Garder** | |

## 5. Conciergerie uniquement

| # | Écran | Rôle | Recommandation | Décision |
|---|---|---|---|---|
| 40 | Reversements propriétaires + détail (`host/OwnerPayouts*`) | Ce qu'on reverse aux propriétaires | **Garder** | |
| 41 | Générer un reversement (`host/GeneratePayoutScreen`) | Création | **Garder** | |
| 42 | Statistiques de reversement (`host/PayoutStatsScreen`) | Chiffres | **Fusionner** dans 40 | |
| 43 | Envoyer un relevé (`host/SendOwnerStatementScreen`) | Relevé au propriétaire | **Garder** | |
| 44 | Mandats, signature (`features/management/MandateScreens`) | Contrats de gestion | **Garder** | |
| 45 | Réglages d'exploitation (`host/HostSettingsScreen`) | Check-in/out auto, push prix | **Garder** | |
| 46 | Équipe (`host/TeamManagementScreen`) | Équipes de la conciergerie | **Garder** | |
| 47 | Utilisateurs : liste, détail, édition, invitation (`admin/User*`, `InviteMember`) | Membres de l'organisation | **Garder** (rubrique Équipe) | |
| 48 | Réseau privé, publication, contacts de gestion (`features/network`, `ProfilePublication`, `ConciergePublication`) | Partenaires, vitrine | **Garder** | |
| 49 | Demander un service hérité (`host/ServiceRequestScreen`) ⚠ | Demande d'intervention interne | **Supprimer** : remplacé par 50 (prestataire externe) et 61 (équipe) | |

## 6. Services (marketplace)

| # | Écran | Rôle | Recommandation | Décision |
|---|---|---|---|---|
| 50 | Catalogue, prestataire, demande de devis, devis, mes devis (`features/marketplace/*`) | Trouver et engager un prestataire | **Garder** | |
| 51 | Réel et réglages (`features/reels/*`) | Vidéo de présentation | **Garder** | |

## 7. Prestataires (ménage, maintenance, blanchisserie, jardin)

| # | Écran | Rôle | Recommandation | Décision |
|---|---|---|---|---|
| 52 | Missions Baitly : liste, exécution guidée, dommages (`features/missions/*`, `MissionScreen`) | Faire la mission étape par étape | **Garder** | |
| 53 | Missions du jour héritées + checklist, photos, anomalie, signature (`housekeeper/*`, 6 écrans) ⚠ | Ancien parcours ménage | **Supprimer** (doublon de 52) — ⚠ la **signature client** n'existe pas dans 52 | |
| 54 | File de tickets + diagnostic, photos, rapport, signature (`technician/*`, 5 écrans) ⚠ | Ancien parcours maintenance | **Supprimer** (doublon de 52) — ⚠ le **formulaire de diagnostic** n'existe pas dans 52 | |
| 55 | Mes tarifs (`shared/MyRatesScreen`) | Tarifs du prestataire | **Garder** | |
| 56 | Mes paiements (`shared/MyPayoutsScreen`) | Ce qui lui est versé | **Garder** | |
| 57 | Mes signalements (`shared/MyIssuesScreen`) | Problèmes signalés | **Garder** | |
| 58 | Demandes reçues + devis (`RequestsScreen` côté prestataire) | Chiffrer | **Garder** | |

## 8. Superviseurs et administrateurs

| # | Écran | Rôle | Recommandation | Décision |
|---|---|---|---|---|
| 59 | Planning (`manager/PlanningDashboardScreen`) | Vue du jour | **Garder** | |
| 60 | Missions admin : liste, détail, validation (`manager/Intervention*`, `TaskValidation`) | Suivre et valider | **Garder** | |
| 61 | Créer une intervention (`manager/CreateInterventionScreen`) | Création + affectation | **Garder** (aussi pour la conciergerie) | |
| 62 | Équipes admin (`manager/TeamList`, `TeamAssignment`) | Affectation | **Fusionner** avec 46 | |
| 63 | Demandes et incidents (`manager/AdminRequestsScreen`) | File admin | **Garder** | |
| 64 | Anciennes listes demandes / incidents (`manager/ServiceRequestList`, `IncidentList`) ⚠ | Idem | **Supprimer** (déjà remplacées par 63) | |
| 65 | Menu Plus (`manager/ManagerMoreScreen`) | Accès secondaires | **Garder** | |

## 9. Compte (tous rôles)

| # | Écran | Rôle | Recommandation | Décision |
|---|---|---|---|---|
| 66 | Compte Baitly + préférences (`features/account/*`) | Menu par rôle | **Garder** | |
| 67 | Informations personnelles Baitly (`AccountDetailsScreen`) | Prénom, nom | **Garder** | |
| 68 | Profil hérité (`common/ProfileDetailScreen`, admin) | + rôle, forfait, identifiant | **Fusionner** dans 67 | |
| 69 | Menu profil hérité (`common/ProfileScreen`) ⚠ | Ancien menu | **Supprimer** (doublon de 66) | |
| 70 | Supprimer le compte (`common/DeleteAccountScreen`) | Écran dédié avec confirmation | **Garder** (remplace l'alerte de 67) | |
| 71 | Connexion, invité, lecteur PDF | — | **Garder** | |

## Points à trancher en priorité

- **53 — signature client** et **54 — diagnostic technique** : ces deux fonctions n'existent pas dans le parcours mission Baitly. Soit on les supprime, soit on les ajoute comme étapes du parcours 52.
- **49 — demande de service interne** : un propriétaire géré par une conciergerie peut-il encore « demander une intervention » à sa conciergerie ? Si oui, il faut garder ce parcours (réécrit).
- **26 / 35 / 40** : ce sont les plus gros écrans (1 200+ lignes). Faut-il les avoir sur mobile, ou les réserver au PMS web ?
