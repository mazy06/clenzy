# Inventaire interne — Channel Management (Clenzy)

> Vérité terrain issue du code Clenzy. Score domaine provisoire global : **2 / 3**.
> Échelle : 0 = Absent · 1 = Basique/manuel · 2 = Standard marché · 3 = Avancé/différenciant.

| Fonctionnalité | Statut | Preuve code | Score |
|---|---|---|---|
| Channel manager natif (CM SaaS sous-jacent) | Implémenté (via revendeur) | `integration/channex/` — connexion Channex + sync bidirectionnelle via Kafka topic `calendar.updates`, pricing drift/reconciliation, OTA watchdog | 2 |
| Connexion Airbnb par API officielle | Implémenté / Partiel | `AirbnbChannelAdapter` (OAuth, push dispo/prix OK) — **host-profile API = TODO** | 2 |
| Connexion Booking.com par API | Implémenté | Adapter direct + topic Kafka dédié | 2 |
| Connexion Expedia / VRBO par API | Implémenté | Adapters directs Expedia/VRBO, topics Kafka dédiés | 2 |
| iCal import/sync automatique | Implémenté | `scheduler/ICalSyncScheduler.java` — sync auto toutes les 3h, déduplication UID, multi-org | 2 |
| Sync bidirectionnelle dispo/prix temps réel | Implémenté | Channex + Kafka `calendar.updates`, reconciliation drift de prix | 2 |
| Sync des restrictions (min/max stay, CTA/CTD) | Non documenté dans l'inventaire | Couvert partiellement via Channex ; pas de preuve d'un mapping complet de restrictions dans le code fourni | 1 |
| Nombre d'OTA connectés effectivement | Implémenté (cœur) + Partiel/Absent (longue traîne) | Airbnb/Booking/Expedia/VRBO + Channex (large catalogue) ; stubs Agoda, Hotels.com, HomeAway, Google Vacation Rentals, TripAdvisor ; enums sans adapter pour Almosafer, Cleartrip, Hala, Trip.com, HomeToGo | 2 |
| Anti-double-réservation (verrou concurrentiel) | Implémenté | `CalendarEngine` — `pg_advisory_xact_lock(property_id)` | 3 |
| Mapping annonce ↔ propriété multi-canal | Implémenté | `ChannelMapping` | 2 |
| Multi-org / multi-tenant sur le channel management | Implémenté | `ICalSyncScheduler` multi-org + Hibernate `@Filter` sur entités | 2 |
| OTA watchdog / supervision de connectivité | Implémenté | `integration/channex/` (OTA watchdog) | 2 |
| Réconciliation des dérives de prix | Implémenté | `integration/channex/` (pricing drift/reconciliation) | 2 |
| OTAs MENA (Almosafer, Cleartrip, Hala) | Absent | Enums `ChannelName` **sans adapter** | 0 |
| Trip.com / HomeToGo (API directe) | Absent | Enums `ChannelName` **sans adapter** (HomeToGo en pré-partenariat) | 0 |

## Notes de lecture

- Le socle CM est solide : revendeur Channex (large catalogue OTA) + 4 adapters directs majeurs + iCal de secours. Architecture event-driven (Kafka outbox) propre.
- Différenciant fort = anti-double-réservation par `pg_advisory_xact_lock` au niveau `property_id` (verrou pessimiste DB, pas de check-then-act) → score 3 sur ce point précis.
- Limites : longue traîne d'OTA en stub/enum-only (faible coût d'opportunité mais score 0 sur ces lignes), Airbnb host-profile incomplet, pas de preuve d'un mapping de restrictions exhaustif côté code Clenzy (dépend de ce que Channex relaie).
- Positionnement = **revendeur/intégrateur Channex** (vs CM 100 % natif comme Guesty/Hostaway). Pertinent pour la vélocité, mais plafonne la vitesse de sync et la profondeur de contrôle vs les leaders qui possèdent leur propre connectivité.
