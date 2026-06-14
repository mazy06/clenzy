# Channel Management

## 1. Périmètre & méthode (sources, dates, confiance globale)

**Périmètre.** Connectivité OTA et channel management du PMS Clenzy comparée à 7 PMS/CM concurrents : Hostaway, Guesty, Smoobu, Lodgify, Hospitable, Avantio, Smily (ex-BookingSync). Axes évalués : connexions natives Airbnb/Booking.com/Vrbo/Expedia (API officielle vs iCal), sync temps réel bidirectionnelle (prix/dispo/restrictions), nombre d'OTA connectés, mapping/multi-listing, prévention overbooking/gestion d'erreurs, et nature du channel manager (natif vs revendeur d'un agrégateur type Channex/Rentals United/NextPax).

**Méthode.** Colonne Clenzy = inventaire terrain du code (vérité interne, non extrapolée). Colonnes concurrents = recherche web sur pages officielles produit, pricing et docs (2025-2026), reformulées. Toute donnée non trouvée est notée « non documenté » sans extrapolation.

**Confiance globale : Probable.** Les capacités macro (nombre de canaux, API vs iCal, statut de partenariat OTA) sont bien documentées et croisées entre plusieurs sources. Les détails fins (vitesse de sync exacte en calls/s, profondeur du mapping de restrictions par canal) sont moins systématiquement publiés → confiance « À vérifier » au cas par cas dans la matrice.

**Repère structurant.** Guesty (acquisition Rentals United) et Hostaway revendiquent une connectivité quasi-native à grande échelle (60-200+ canaux). Clenzy s'appuie sur **Channex** (revendeur) + 4 adapters directs + iCal : modèle hybride proche d'Avantio/Smily mais avec une longue traîne d'OTA encore en stub.

## 2. Inventaire interne (fonctionnalité | statut | preuve code | score)

| Fonctionnalité | Statut | Preuve code | Score |
|---|---|---|---|
| Channel manager (via revendeur Channex) | Implémenté | `integration/channex/` (sync bidir. Kafka `calendar.updates`, drift pricing, OTA watchdog) | 2 |
| Airbnb API officielle | Implémenté/Partiel | `AirbnbChannelAdapter` OAuth, push OK, host-profile TODO | 2 |
| Booking.com API | Implémenté | Adapter direct + topic Kafka | 2 |
| Expedia / VRBO API | Implémenté | Adapters directs, topics Kafka dédiés | 2 |
| iCal import/sync auto (3h, dédup UID, multi-org) | Implémenté | `scheduler/ICalSyncScheduler.java` | 2 |
| Sync bidir. dispo/prix temps réel | Implémenté | Channex + Kafka, reconciliation drift | 2 |
| Sync restrictions (min/max stay, CTA/CTD) | Non documenté | Dépend de Channex ; pas de mapping explicite dans le code | 1 |
| Nombre d'OTA effectifs | Implémenté + Partiel/Absent | 4 directs + catalogue Channex ; stubs Agoda/Hotels.com/HomeAway/GVR/TripAdvisor ; enum-only MENA/Trip.com/HomeToGo | 2 |
| Anti-double-réservation | Implémenté | `CalendarEngine` `pg_advisory_xact_lock(property_id)` | 3 |
| Mapping annonce ↔ propriété multi-canal | Implémenté | `ChannelMapping` | 2 |
| Multi-tenant sur le CM | Implémenté | `ICalSyncScheduler` multi-org + `@Filter` | 2 |
| OTAs MENA / Trip.com / HomeToGo (API) | Absent | Enums `ChannelName` sans adapter | 0 |

## 3. Matrice de comparaison

Scores 0-3. Confiance : **C** = Confirmé, **P** = Probable, **V** = À vérifier.

| Fonctionnalité | Clenzy | Hostaway | Guesty | Smoobu | Lodgify | Hospitable | Avantio | Smily |
|---|---|---|---|---|---|---|---|---|
| Connexion Airbnb (API officielle) | 2 (C) | 3 (C) | 3 (C) | 3 (C) | 3 (C) | 3 (C) | 3 (C) | 3 (C) |
| Connexion Booking.com (API) | 2 (C) | 3 (C) | 3 (C) | 3 (C) | 3 (C) | 3 (C) | 3 (C) | 3 (C) |
| Connexion Vrbo (API officielle) | 2 (C) | 3 (C) | 3 (C) | 1 (C) | 3 (C) | 3 (C) | 3 (C) | 3 (C) |
| Connexion Expedia (API) | 2 (C) | 3 (C) | 3 (C) | 2 (P) | 3 (C) | 1 (P) | 3 (C) | 3 (C) |
| Nombre d'OTA connectés | 2 (P) | 3 (C) | 3 (C) | 3 (C) | 2 (C) | 1 (C) | 3 (C) | 3 (C) |
| Sync temps réel dispo/prix (2-way) | 2 (C) | 3 (C) | 3 (C) | 2 (P) | 3 (C) | 2 (P) | 3 (C) | 3 (C) |
| Sync restrictions (min stay, rules) | 1 (V) | 3 (C) | 3 (P) | 2 (P) | 2 (P) | 2 (P) | 3 (P) | 2 (P) |
| Anti-double-réservation | 3 (C) | 3 (C) | 3 (C) | 2 (P) | 2 (P) | 3 (P) | 3 (P) | 3 (P) |
| Mapping / multi-listing | 2 (C) | 3 (C) | 3 (C) | 2 (P) | 2 (P) | 2 (P) | 3 (C) | 3 (C) |
| CM natif (vs revendeur) | 1 (C) | 3 (P) | 3 (C) | 2 (P) | 2 (P) | 2 (P) | 3 (C) | 3 (C) |
| Unified inbox / messaging cross-canal | 2 (C) | 3 (C) | 3 (C) | 1 (C) | 2 (P) | 3 (C) | 2 (P) | 3 (C) |
| **Score moyen domaine** | **2,0** | **3,0** | **3,0** | **2,1** | **2,5** | **2,3** | **2,9** | **2,9** |

Notes :
- **Vrbo Smoobu = 1** : Smoobu ne propose pas de connexion API à Vrbo (iCal uniquement) — source 2025.
- **Expedia Hospitable = 1** et **Nb d'OTA Hospitable = 1** : Hospitable cible volontairement un petit set (Airbnb/Booking/Vrbo/Agoda Homes + direct), pas Expedia — choix produit assumé, pas un défaut technique.
- **CM natif Clenzy = 1** : modèle revendeur Channex (la connectivité n'appartient pas à Clenzy) vs Guesty/Avantio/Smily qui possèdent leur stack de connectivité.
- **Restrictions Clenzy = 1** : pas de preuve d'un mapping de restrictions exhaustif dans le code fourni (dépend de ce que Channex relaie).

## 4. Gaps critiques | Avantages | Parité

### Gaps critiques
1. **Modèle revendeur (Channex) vs CM natif des leaders.** Guesty, Avantio et Smily possèdent leur propre connectivité (Guesty Pro revendique ~15 calls/s ; Hostaway/mid-market ~2-3 calls/s selon Guesty). Clenzy dépend d'un tiers → plafond de vitesse de sync, de profondeur de contrôle et marge sur le coût par connexion.
2. **Sync des restrictions partielle/non prouvée.** Min/max stay, CTA/CTD, rule sets : les leaders (Hostaway « real-time restrictions », Avantio « full API all content ») le revendiquent explicitement. Clenzy = 1 faute de preuve code → risque d'overbooking-par-règle si une restriction Airbnb ne se propage pas à Booking.
3. **Longue traîne d'OTA en stub/enum-only.** Agoda, Hotels.com, HomeAway, Google Vacation Rentals, TripAdvisor (stubs), Almosafer/Cleartrip/Hala/Trip.com/HomeToGo (enum sans adapter) — alors que tous les concurrents annoncent 50 à 200+ canaux. Le catalogue Channex couvre une partie, mais l'absence d'adapters directs limite le contrôle.

### Avantages
1. **Anti-double-réservation de qualité supérieure.** `pg_advisory_xact_lock(property_id)` = verrou pessimiste DB (pas de check-then-act). Approche techniquement plus robuste que la simple « sync temps réel » mise en avant par les concurrents (qui réduit la fenêtre mais ne la ferme pas atomiquement).
2. **Architecture event-driven propre (Kafka outbox + reconciliation drift).** OTA watchdog + réconciliation des dérives de prix = filet de sécurité que peu de concurrents documentent publiquement.
3. **Ancrage MENA latent.** Enums déjà présents pour Almosafer/Cleartrip/Hala : positionnement potentiel sur un marché que la quasi-totalité des concurrents (orientés EU/US) ne couvrent pas.

### Parité
- Connexions API directes aux 4 majors (Airbnb/Booking/Expedia/VRBO) : parité fonctionnelle, mais en API officielle « préférée/premier » les concurrents ont un statut de partenariat supérieur (Lodgify Airbnb Preferred+ & Vrbo Elite 2025 ; Hospitable Booking Premier 2025 ; Avantio Preferred multi-OTA).
- iCal de secours, mapping multi-listing, multi-tenant : parité avec le standard marché.

## 5. Opportunités vs sociétés de service

Sans objet direct pour ce domaine purement technique (channel management = capacité produit, pas service). Deux angles toutefois pertinents pour Clenzy en tant qu'éditeur ciblant conciergeries pro FR/MENA :
- **Onboarding de connectivité managé** : les conciergeries pro multi-biens souffrent du paramétrage initial des canaux. Un service d'« activation channel » (mapping + go-live assistés) différencie face aux pure-players self-serve (Smoobu/Lodgify).
- **Couverture OTA régionale (FR + MENA)** comme service à valeur : connecter des canaux locaux (HomeToGo, plateformes MENA) que les leaders globaux négligent.

## 6. Recommandations & initiatives

| Titre | Type | Impact (1-3) | Effort |
|---|---|---|---|
| Mapping complet des restrictions (min/max stay, CTA/CTD, rules) via Channex + tests anti-régression | Rattrapage gap critique | 3 | M |
| Finaliser l'adapter Airbnb (host-profile API) + viser statut Preferred+ | Rattrapage gap critique | 2 | M |
| Activer 3-5 OTA de la longue traîne via Channex (Agoda, GVR, Trip.com) plutôt qu'adapters maison | Optimisation | 2 | S |
| Connectivité OTA MENA (Almosafer/Cleartrip/Hala) — différenciation régionale | Différenciation | 3 | L |
| Tableau de bord de santé de connectivité (OTA watchdog exposé UI + alerting drift) | Différenciation | 2 | M |

## 7. Sources

| URL | Date consultation | Confiance |
|---|---|---|
| https://www.hostaway.com/features/channel-manager/ | 2026-06-13 | C |
| https://www.hostaway.com/vacation-rental-channel-manager/booking-com/ | 2026-06-13 | C |
| https://www.hostaway.com/vacation-rental-channel-manager/vrbo/ | 2026-06-13 | C |
| https://www.hostaway.com/vacation-rental-channel-manager/expedia/ | 2026-06-13 | C |
| https://www.guesty.com/features/channel-manager/ | 2026-06-13 | C |
| https://www.guesty.com/blog/channel-manager-quality-real-time-sync/ | 2026-06-13 | P |
| https://www.guesty.com/lp/guesty-vs-hostaway/ | 2026-06-13 | P |
| https://www.smoobu.com/en/channel-manager-booking-com/ | 2026-06-13 | C |
| https://www.smoobu.com/en/blog/best-channel-managers/ | 2026-06-13 | P |
| https://hostradar.eu/en/reviews/smoobu/ | 2026-06-13 | P |
| https://www.lodgify.com/vacation-rental-channel-manager/ | 2026-06-13 | C |
| https://www.lodgify.com/vacation-rental-channel-manager/expedia/ | 2026-06-13 | C |
| https://stayfi.com/vrm-insider/2025/09/01/lodgify-review/ | 2026-06-13 | P |
| https://hospitable.com/features/vacation-rental-channel-manager | 2026-06-13 | C |
| https://hospitable.com/booking-com-channel-manager | 2026-06-13 | C |
| https://www.avantio.com/vacation-rental-channel-manager/ | 2026-06-13 | C |
| https://www.avantio.com/blog/preferered-partner-rental-management-software/ | 2026-06-13 | P |
| https://www.smily.com/software/features/channel-manager | 2026-06-13 | C |
| https://manual.bookingsync.com/hc/en-us/articles/360005264254-Channels-Synchronization | 2026-06-13 | C |
| https://hotelub.fr/en/smily-our-review-after-testing-is-it-a-good-channel-manager-to-start-with/ | 2026-06-13 | P |
| https://rentalsunited.com/blog/guesty-vs-hostaway-vacation-rental-channel-manager/ | 2026-06-13 | P |
| https://eviivo.com/trade-secrets/best-vacation-rental-channel-managers/ | 2026-06-13 | P |
