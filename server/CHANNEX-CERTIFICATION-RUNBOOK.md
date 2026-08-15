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

## ⛔ Avant de rejouer — les quatre points qui ont fait échouer le 2026-08-15

> Le code est corrigé pour le reste (pushs en delta au lieu d'instantanés, cf.
> `ChannexRateField`). **Ces quatre points-là ne sont PAS du code** : ils tiennent
> à la configuration de l'environnement et à la façon de jouer les scénarios.
> Les ignorer refera échouer exactement les mêmes tests.

| # | À faire | Sinon |
|---|---|---|
| 0 | Poser `CHANNEX_IMPORT_PULL_BOOKINGS=false` sur l'environnement de certification | Test 11 échoue à l'identique |
| 6 | Bloquer **une seule nuit**, pas une plage | « Update must target a single date, got 2027-02-10..2027-02-13 » |
| 8 | **Cause inconnue** — diagnostiquer en rejouant, payload en main | « No valid rate / no valid min stay over the half-year range » |
| 9 | **Annuler** une réservation d'**une** nuit (ne pas en créer une) | « No update sets availability to 1 or 7 » |

**Le point 0 est le moins intuitif et le plus coûteux.** Ce n'est pas un
`pull-bookings` manuel qui a produit les trois `booking_revision_received_via_list`
du refus : c'est **l'étape 7 de l'import**, qui rattrape l'historique par appel de
liste à chaque connexion de propriété. Comme Channex a repris l'hôtel de test
quatre fois dans la journée, chaque reconnexion en a déclenché un. L'ancienne
consigne « ne jamais lancer `pull-bookings` pendant le partage » était donc
insuffisante — on ne le lançait pas.

Le drapeau reste à `true` par défaut : ce rattrapage donne son passé à une
propriété fraîchement connectée (année fiscale en cours, LMNP), et le flux de
révisions ne remonte pas l'antérieur. C'est un réglage de certification, pas de
production.

**Sur le point 8, la cause reste à trouver.** J'avais écrit ici que la propriété
manquait d'un prix de base et d'une restriction couvrant la période : **c'est
faux, vérifié en base le 2026-08-15**. La propriété 3 porte `nightly_price =
120.00`, et une restriction `2027-08-01 → 2027-12-31` (min 3 / max 21) existe
bien. Il n'y a en outre ni override ni plan tarifaire sur ce semestre, donc
toutes les dates y valent 120 — des valeurs uniformes, que la compression aurait
dû fusionner en **une** entrée `date_from`/`date_to`.

Autrement dit, le payload attendu était exactement celui que Channex réclame. Le
reproche « No valid rate » et « single-date objects » ne s'explique pas par les
données. À diagnostiquer en rejouant le scénario **payload en main** (task ID →
API des tâches Channex), et non en supposant.

Un push tarifaire sans aucune entrée émet désormais un `WARN`
(`push rates SANS AUCUNE entree`) : si le cas se reproduit, les journaux le
diront cette fois.

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
- [ ] **`CHANNEX_IMPORT_PULL_BOOKINGS=false`** (cf. §Avant de rejouer, point 0) — à remettre à `true` après
- [x] Prix de base sur la propriété — **déjà en place** (`nightly_price = 120.00` sur la propriété 3, vérifié le 2026-08-15). Sans lui, `PriceEngine` renverrait `null` pour chaque date et tout push tarifaire partirait vide

## Les 14 tests

> Règle générale : chaque scénario est déclenché **depuis l'UI/les flux réels de Baitly**
> (jamais de script à côté — anti-pattern rejeté), et on note le(s) **task ID(s)**
> retournés (visibles dans les logs backend `ChannexSync[availability|rates]: ... task_ids=[...]`).

> **Les task IDs ne sont plus ici.** Ce runbook décrit *comment* déclencher chaque
> scénario ; les identifiants du dernier passage vivent dans un seul endroit,
> `CHANNEX-CERTIFICATION-REPONSES.md` — celui qu'on recopie dans le formulaire.
> Les tenir aux deux endroits les avait déjà fait diverger : la table ci-dessous
> a porté pendant un mois les IDs du 9 juillet, pointant sur une propriété
> supprimée entre-temps.

> **Statut = résultat du passage du 2026-08-15**, pas un état de santé.
> ✅ accepté · ⚠️ à rejouer (avertissement ou échec) · ➖ non applicable, justifié.
> Aucun ⚠️ n'a encore été rejoué contre Channex : le code est corrigé, la preuve
> reste à faire.

| # | Test | Déclencheur Baitly | Attendu côté API | Statut |
|---|---|---|---|---|
| 1 | Full sync 500 j | Bouton resync ⟳ (`resync` months=0) | **2 appels** : 1 availability + 1 rates&restrictions (compression date_from/date_to) | ✅ |
| 2 | Prix 1 date / 1 rate | Changer un prix (RateOverride) dans l'UI Tarification | **1 appel rates, et RIEN d'autre** — pas d'availability, et le payload ne porte que `rate` | ⚠️ |
| 3 | Prix multi-rates, 1 date | N/A — Baitly VR mono rate-plan (voir note test 14). Couvert par le test 2. | **1 appel** | ➖ |
| 4 | Prix multi-dates multi-rates | Nouveau plan tarifaire sur une plage future | **1 appel** rates compressé (ranges), payload limité à `rate` | ⚠️ |
| 5 | Min stay sur rates | Onglet Restrictions → séjour min **seul** (ne rien cocher d'autre) | **1 appel** rates, payload limité à `min_stay_*` | ⚠️ |
| 6 | Stop sell | **Bloquer UNE SEULE nuit** depuis le planning | **1 appel** rates, payload limité à `stop_sell: true`, `availability` **inchangée à 1** | ⚠️ |
| 7 | Restrictions combinées (CTA/CTD/min/max stay) | Onglet Restrictions → min/max + CTA/CTD sur deux plages | **1 appel** rates chacune | ✅ |
| 8 | Semestre (rate+CTA+CTD+min stay, 5 mois) | Même mécanisme que 7 sur **au moins 152 jours**. Données déjà en place (restriction 2027-08-01→12-31, prix de base 120) | **1 appel** rates, compressé en `date_from`/`date_to` (une entrée, pas 152) | ⚠️ |
| 9 | Availability 1 date | **ANNULER** une résa d'UNE nuit → dispo repasse à 1 | 1 appel availability, `availability: 1` (créer une résa donne 0, ce que Channex refuse) | ⚠️ |
| 10 | Availability multi-dates | Résa de plusieurs nuits → dispo sur la plage | 1 appel availability | ✅ |
| 11 | Réception bookings (create/modif/annulation) | Résa directe poussée au CRS (`push-crs`) → **new** ; séjour prolongé via l'app Booking CRS → **modified** ; `cancel-crs` → **cancelled** | réception par **webhook/flux UNIQUEMENT** → persist → ack par révision. Aucun appel de liste ni par identifiant (cf. point 0) | ⚠️ |
| 12 | Rate limits | — engagement, **rédigé §Engagements 12/13** (vérifié dans le code le 2026-08-06) | n/a | ✅ |
| 13 | Update logic | — engagement, **rédigé §Engagements 12/13** (vérifié dans le code le 2026-08-06) | n/a | ✅ |
| 14 | Extra notes | **rédigées §Extra notes (test 14)** | n/a | ✅ |

> ### ⚠️ Test 11 : le webhook public EST nécessaire — démenti du 2026-08-14
>
> Ce runbook affirmait qu'un tunnel entrant ne servait qu'à réduire la latence,
> le feed de révisions étant interrogé toutes les 10 minutes
> (`clenzy.channex.booking-feed-interval-minutes`). **C'était faux.** Le retour de
> certification est explicite : *« All webhook deliveries for revision … failed
> (notes.success != true); the webhook endpoint must accept the notification and
> respond with success. »* Channex mesure le succès des livraisons, et un feed
> qui tourne ne compense pas un webhook muet.
>
> Deux causes, trouvées en inspectant le compte : l'URL enregistrée était la
> **racine du tunnel ngrok, sans le chemin `/api/webhooks/channex`** — chaque
> livraison tombait donc en 404 — et Channex avait fini par **désactiver les deux
> webhooks** du compte. `POST /webhooks/ensure` refuse désormais une URL sans ce
> chemin et réactive un webhook désactivé.
>
> **Et ne jamais lancer `pull-bookings` pendant une campagne** : Channex trace
> chaque lecture par liste ou par identifiant comme une réception hors
> webhook/feed, et la compte contre vous.
>
> **Un avertissement OVERBOOKING est attendu dans ce montage** : la réservation
> de test est fabriquée en la poussant depuis Baitly, donc les nuits sont déjà
> occupées par la réservation directe quand Channex nous la renvoie en booking
> OTA. Le garde-fou persiste et acquitte, laisse le calendrier intact et signale
> l'intervention — comportement correct, pas un défaut du test.

> ¹ **Stop sell** : Baitly ne pousse pas `stop_sell` par date (l'indisponibilité passe
> par availability=0). À signaler en Extra Notes, OU à couvrir via une fermeture
> de plage (availability 0) selon la lecture du reviewer.

## Engagements 12/13 — texte à recopier dans le formulaire

> Rédigé le **2026-08-06**, chaque affirmation vérifiée dans le code — pas une
> intention, un constat. Les références sont données pour que le reviewer (ou
> nous, dans six mois) puisse contrôler sans nous croire sur parole.

### Test 12 — Rate limits

Baitly n'appelle **jamais** l'API depuis le producteur d'événements. Les
changements de calendrier et de prix partent en événements Kafka
(`calendar.updates`) que `ChannexAriBatcher` met en file **par propriété** ; un
flush périodique — **30 s par défaut**, `clenzy.channex.ari-flush-seconds` —
fusionne les plages accumulées et déclenche **un seul push availability et un
seul push rates par propriété et par flush**.

La cadence de flush **borne donc mécaniquement** le débit à **≤ 2 + 2 appels par
minute et par propriété**, très en deçà des limites Channex (10 + 10/min/prop).
Ce n'est pas un compteur qu'on pourrait dépasser sous charge : c'est une
conséquence de la période de flush.

Sur **429 ou 5xx**, la plage est **re-enfilée avec un différé de 60 s**
(`retrySeconds`) — le backoff demandé par la doc, sans immobiliser de thread.
Après **5 tentatives** (`MAX_ATTEMPTS`), le batcher s'arrête et laisse la main
aux filets : `retryFailedMappings` (horaire) et la réconciliation planifiée.

*Références : `ChannexAriBatcher` (file par propriété, flush, backoff, MAX_ATTEMPTS=5),
`ChannexCalendarUpdateListener` (les events n'appellent pas l'API, ils enfilent).*

### Test 13 — Update logic

**Deltas uniquement.** Le chemin nominal ne pousse que ce qui a changé : un
événement porte sa plage de dates, le batcher fusionne les plages d'une même
propriété, et le push est compressé en `date_from`/`date_to` (une plage de
22 nuits part en une entrée, cf. tests 7 et 8).

**Aucun full sync planifié.** La resynchronisation 500 jours (test 1) est
**exclusivement manuelle** — bouton ⟳ de l'écran Channex. Aucun `@Scheduled` du
paquet `integration.channex` ne déclenche de sync complète : les quatre
planificateurs existants sont
(a) le flush ARI (30 s, deltas en file),
(b) `retryFailedMappings` (horaire) — **reprise des mappings en ERREUR sur 7 jours seulement**,
(c) les réconciliations rates (60 min) et restrictions (180 min) — qui **lisent**
Channex pour détecter une dérive de prix et **ne poussent rien**,
(d) le watchdog (15 min) — santé des mappings, métriques uniquement, aucun appel de push.

L'engagement est donc **plus fort que « ≤ 1 full sync par 24 h »** : il n'y en a
aucun d'automatique.

*Références : `ChannexSyncService.retryFailedMappings` (fenêtre `now → now+7 j`),
`ChannexRatesReconciliationScheduler` (pull 30 j, détection de dérive),
`ChannexRestrictionReconciliationScheduler`, `ChannexWatchdogScheduler` (jauges).*

## Extra notes (test 14) — texte à recopier

> Réécrites le 2026-08-14 après le refus. La note « stop sell » disait l'inverse
> de ce qui est vrai aujourd'hui.

1. **Single-unit vacation rental.** One Baitly property = one Channex property
   with **1 room type × 1 rate plan**. The hotel protocol asks for 2×2; the
   single-unit adaptation is explicitly allowed by your documentation. Direct
   consequence: **test 3** (multiple rates on one date) is not applicable and is
   covered by test 2.
2. **A second rate plan appears on the property — it is not ours.** Alongside
   our `Standard Rate` (`bdacb7fc-…`, the one declared in the setup), you will
   see `Standard Rate - BookingCom …` (`fd230382-…`). Channex derived it
   automatically when the Booking.com channel was mapped: it carries a `channel`
   relationship, and our PMS neither created nor prices it. Our data model still
   holds exactly one rate plan per room type.
3. **Min stay.** Both `min_stay_through` and `min_stay_arrival` are sent on
   every date. Our model has a **single min-stay value**, so the two fields are
   always present and always equal — we do not currently let them diverge.
4. **Max stay.** Sent as **0** when the property sets no maximum, per your
   "no limit" convention.
5. **Stop sell.** Supported and sent on every date. A booking consumes
   inventory (`availability = 0`); a manual block or maintenance keeps the unit
   (`availability = 1`) and closes the date through `stop_sell = true`. The two
   used to be conflated — that is fixed.
6. **Credit cards.** Not required: payments go through the Channex Stripe
   Tokenization app; no card data transits through or is stored by Baitly.
7. **Booking acknowledgement.** The `booking_revisions/feed` is acknowledged
   **per revision, after the persistence commit** — never before. A booking
   received but not persisted is therefore not acknowledged and comes back on
   the next cycle.

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
