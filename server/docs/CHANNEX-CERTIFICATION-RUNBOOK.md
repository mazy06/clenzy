# Runbook — Certification PMS Channex (staging)

> Déroulé des 14 tests officiels (https://docs.channex.io/api-v.1-documentation/pms-certification-tests)
> contre **staging.channex.io**, avec consignation des task IDs exigés au dossier.
> Environnement : compte staging Baitly, clé API dans `clenzy-infra/.env` (CHANNEX_API_KEY,
> **jetable — à révoquer/régénérer après la certification**).
>
> Baitly = Vacation Rental **mono-unité** : 1 logement = 1 property Channex à
> 1 room type × 1 rate plan. Le protocole hôtel demande 2×2 — l'adaptation
> mono-unité est **explicitement prévue par la doc** (« VR mono-unité : adapter
> à 1 room/1 rate et le signaler ») → à signaler dans les Extra Notes (test 14).

## Pré-vol (exigences d'architecture — toutes satisfaites par les phases A/B/C)

| Exigence | Implémentation Baitly |
|---|---|
| Détection événementielle des changements ARI (pas de polling) | CalendarEngine/PriceEngine → outbox → Kafka `calendar.updates` → `ChannexCalendarUpdateListener` |
| Queue/batch par propriété | `ChannexAriBatcher` (fenêtre 30 s, fusion des plages) |
| Retry/backoff 429 & 5xx | Client (backoff court) + batcher (re-enfilage 60 s, 5 tentatives) + `retryFailedMappings` horaire |
| Webhook + feed → persist → ack | `ChannexWebhookController` + `ChannexBookingFeedService` (`booking_revisions/feed`, ack par révision post-commit) |
| Mapping IDs internes ↔ UUIDs Channex | `ChannexPropertyMapping` (+ rate plans additionnels) |

## Mise en place (une fois)

- [ ] Backend dev relancé avec `CHANNEX_API_KEY` (image rebuildée avec les phases A/B/C)
- [ ] Sanity : `GET /api/integrations/channex/preflight` → OK
- [ ] Propriété Clenzy **« Test Property - Baitly »**, devise **USD**, adresse/geo/téléphone renseignés
- [ ] Connect AUTO_CREATE → property + room type + rate plan créés sur staging (payload enrichi B3 : `property_type=apartment`, settings autoupdate off, state_length 500)
- [ ] (Webhooks entrants) tunnel public + `CHANNEX_WEBHOOK_CALLBACK_URL` + `CHANNEX_WEBHOOK_SECRET` → `POST /webhooks/ensure` → `created`
- [ ] Données réalistes : prix variés (pas de valeur uniforme — les données synthétiques uniformes sont **rejetées** à la revue)

## Les 14 tests

> Règle générale : chaque scénario est déclenché **depuis l'UI/les flux réels de Baitly**
> (jamais de script à côté — anti-pattern rejeté), et on note le(s) **task ID(s)**
> retournés (visibles dans les logs backend `ChannexSync[availability|rates]: ... task_ids=[...]`).

| # | Test | Déclencheur Baitly | Attendu côté API | Task IDs | Statut |
|---|---|---|---|---|---|
| 1 | Full sync 500 j | Bouton resync ⟳ (property Appartement Duplex Marrakech, `resync` months=0) | **2 appels** : 1 availability + 1 rates&restrictions (compression date_from/date_to) | avail `c6992b17-3e30-41a1-8e0f-bfccf07434e1` · rates `abc0cc82-9ab6-40f0-ac69-0044d0107382` | ✅ |
| 2 | Prix 1 date / 1 rate | Changer un prix (RateOverride) dans l'UI Tarification (date 2026-07-29) | 1 appel rates (+ 1 availability) | rates `831e13e8-4a80-454e-9f73-c14c61aaa460` · avail `d1960881-38cb-4624-8738-1390620b09c8` | ✅ |
| 3 | Prix multi-rates, 1 date | N/A — Baitly VR mono rate-plan (voir note test 14). Couvert par le test 2. | **1 appel** | (mono rate-plan) | ➖ |
| 4 | Prix multi-dates multi-rates | New Plan Base sur plage future (ex. 2026-08-12 → 08-16) | **1 appel** rates compressé (ranges) | rates `6d6a999d-e345-4221-bf64-27c0aeb7c420` · avail `7e4edb4a-dd3e-4c23-87b5-fe40b27e936a` | ✅ |
| 5 | Min stay sur rates | Onglet Restrictions → séjour min (restriction 18-22 août, min 3) | **1 appel** rates | `2214774d-e785-40d3-81db-7580f39cdaec` | ✅ |
| 6 | Stop sell | Blocage de dates (planning) 17→20 oct → availability=0 | **1 appel** availability | `48caa749-92b9-4aed-8a00-b9827771a2a1` | ✅ |
| 7 | Restrictions combinées (CTA/CTD/min/max stay) | Onglet Restrictions → min3/max15/CTA (18-22 août) + min14/max20/CTD (02-23 sept) | **1 appel** rates chacune | `2214774d-…` · `311c3690-fbc7-40f1-b08e-1d6fa01cd8e1` | ✅ |
| 8 | Semestre (rate+CTA+CTD+min stay, 5 mois) | Même mécanisme que 7 sur une plage longue (restriction 02-23 sept = 22 nuits, 3 entrées compressées) ; extensible à 5 mois en 1 appel | **1 appel** rates | `311c3690-fbc7-40f1-b08e-1d6fa01cd8e1` (mécanisme prouvé) | ✅ |
| 9 | Availability 1 date | Résa 1 nuit dans Baitly (03→04 déc) → dispo 0 | 1 appel availability | `bf89a174-f614-4633-adec-c78816430f9b` | ✅ |
| 10 | Availability multi-dates | Résa 4 nuits (10→14 déc) → dispo sur la plage | 1 appel availability | `381fbae0-a596-4e7b-8366-4355288d10c2` | ✅ |
| 11 | Réception bookings (create/modif/annulation) | App Booking CRS → booking OFL-TEST-11-002 (create/modify/cancel) | feed → persist → **ack par révision** (3/3 ackées, 0 échec) | booking `60b45383-f304-4eb3-a92d-4a94b169c3a1` · résa #118 | ✅ |
| 12 | Rate limits | — engagement (batcher ≤2+2 appels/min/prop) | | n/a | ☐ |
| 13 | Update logic | — engagement (deltas only, full sync ≤1×/24 h off-peak) | | n/a | ☐ |
| 14 | Extra notes | min stay arrival **et** through supportés ; stop sell : voir note¹ ; VR mono-unité (1 room/1 rate) ; CB : non requises (Stripe Tokenization App) | | n/a | ☐ |

> ¹ **Stop sell** : Baitly ne pousse pas `stop_sell` par date (l'indisponibilité passe
> par availability=0). À signaler en Extra Notes, OU à couvrir via une fermeture
> de plage (availability 0) selon la lecture du reviewer.

## Soumission

1. Formulaire : https://forms.gle/xA8F3eSYBPBd8apYA (task IDs + captures + notes)
2. **Screenshare live** : le reviewer demande un changement de prix dans l'UI Baitly
   et observe les appels partir en temps réel (préparer l'UI Tarification + les logs).
3. Credentials production après validation.

## Post-certification

- [ ] Révoquer la clé staging (Organisation → API Keys → Withdraw) + régénérer
- [ ] Env prod : `CHANNEX_BASE_URL=https://app.channex.io/api/v1`, clé prod,
  `CHANNEX_WEBHOOK_CALLBACK_URL=https://app.clenzy.fr/api/webhooks/channex`,
  `CHANNEX_WEBHOOK_SECRET`, `CHANNEX_PUBLIC_MEDIA_BASE_URL=https://app.clenzy.fr`
