# Runbook — Certification PMS Channex (staging)

> Déroulé des 14 tests officiels (https://docs.channex.io/api-v.1-documentation/pms-certification-tests)
> contre **staging.channex.io**, avec consignation des task IDs exigés au dossier.
> Environnement : compte staging Baitly, clé API dans **`clenzy-infra/.env.dev`**
> (`CHANNEX_API_KEY`, **jetable — à révoquer/régénérer après la certification**).
>
> ⚠️ **Pas `.env`.** Les deux fichiers portent une clé Channex, et elles voient des
> comptes **différents** : `.env` (`uhH3tu…`) n'a pas de `CHANNEX_BASE_URL` et
> tombe donc sur `app.channex.io`, tandis que `.env.dev` (`ulALqE…`) est celle que
> le backend de dev emploie contre staging. Toute vérification par API doit
> utiliser celle de `.env.dev` : la propriété de test interrogée avec l'autre
> répond `resource_not_found` alors qu'elle existe. Cette confusion a coûté la
> suppression d'une propriété de staging le 2026-08-13.
>
> Baitly = Vacation Rental **mono-unité** : 1 logement = 1 property Channex à
> 1 room type × 1 rate plan. Le protocole hôtel demande 2×2 — l'adaptation
> mono-unité est **explicitement prévue par la doc** (« VR mono-unité : adapter
> à 1 room/1 rate et le signaler ») → à signaler dans les Extra Notes (test 14).

## ✅ Passage intégral du 2026-08-16 — les onze scénarios, d'une traite

Tous rejoués **depuis l'écran** (sauf le push CRS du test 11, qui n'a pas de
commande d'interface), un à la fois, chaque payload relu via `GET /tasks/{id}`
avant d'être consigné. Tous en `success: true`.

Les identifiants sont dans `CHANNEX-CERTIFICATION-REPONSES.md` — **un seul
endroit**, c'est la règle ; les tenir aussi ici les avait déjà fait diverger.

### Ce que ce passage a réglé

**Le test 8 avait une cause, et ce n'était pas les données.** Ce runbook a
longtemps affirmé que la propriété manquait d'un prix de base et d'une
restriction sur la période — c'était faux, vérifié en base. La vraie cause a été
trouvée en relisant le payload refusé `9b0c5223` : il contenait six entrées dont
une en syntaxe `{"date": …}`. Leur validateur ne lit que `date_from`/`date_to`,
ignorait cette entrée et ne reconstituait donc pas la couverture du semestre.
`putDateOrRange` n'émet plus jamais la clé `date`.

**Deux régressions introduites par la correction du delta**, invisibles aux
13 406 tests et sorties par le rejeu en conditions réelles :

- `rate must be >= 0, got null` — le passage au delta rendait le tarif
  facultatif, l'invariant du DTO le refusait encore.
- des fermetures à `false` embarquées dans un delta de séjour minimum —
  `closed_to_arrival` et `closed_to_departure` sont NOT NULL en base, le filtre
  « champ non nul » ne pouvait pas les écarter.

### Les pièges de mise en scène — c'est là que ça casse, pas dans le code

| # | À faire | Sinon |
|---|---|---|
| 0 | Poser `CHANNEX_IMPORT_PULL_BOOKINGS=false` | Trois `booking_revision_received_via_list`, refus |
| 2·4 | Une date **future** | « Past date is not allowed » — un scénario joué sur des dates passées est rejeté sec |
| 6 | Bloquer **une seule nuit**, pas une plage | « Update must target a single date, got 2027-02-10..2027-02-13 » |
| 7 | Choisir une plage **sans restriction préexistante** | La restriction déjà en base gagne la résolution et le push ne porte qu'elle |
| 9·10 | **Annuler** une réservation (ne pas en créer une) | « No update sets availability to 1 » — créer donne 0, ce qu'ils refusent |
| — | Un scénario à la fois, **30 s entre deux** | Le batcher fusionne les plages, plus aucun ID n'est attribuable |

**Le point 0 est le moins intuitif.** Ce n'est pas un `pull-bookings` manuel qui
a produit les `booking_revision_received_via_list` du refus : c'est **l'étape 7
de l'import**, qui rattrape l'historique par appel de liste à chaque connexion de
propriété. Channex ayant repris l'hôtel de test quatre fois dans la journée,
chaque reconnexion en a déclenché un. La consigne « ne jamais lancer
`pull-bookings` pendant le partage » était respectée — et inutile.

Le drapeau reste à `true` par défaut : ce rattrapage donne son passé à une
propriété fraîchement connectée (année fiscale en cours, LMNP), et le flux de
révisions ne remonte pas l'antérieur. C'est un réglage de certification, pas de
production.

**Le point 7 s'est payé au passage du 16.** Joué d'abord sur 2027-05-10→05-14,
plage déjà couverte par une restriction en base (min 3 seul) : c'est elle qui
gagnait la résolution, et le push ne portait qu'un `min_stay` — ni max, ni
CTA/CTD. Le code était juste, la plage ne l'était pas. `SELECT start_date,
end_date FROM booking_restrictions` avant de choisir.

Un push tarifaire sans aucune entrée émet un `WARN`
(`push rates SANS AUCUNE entree`) : si le cas se reproduit, les journaux le diront.

## Pré-vol (exigences d'architecture — toutes satisfaites par les phases A/B/C)

| Exigence | Implémentation Baitly |
|---|---|
| Détection événementielle des changements ARI (pas de polling) | CalendarEngine/PriceEngine → outbox → Kafka `calendar.updates` → `ChannexCalendarUpdateListener` |
| Queue/batch par propriété | `ChannexAriBatcher` (fenêtre 30 s, fusion des plages) |
| Retry/backoff 429 & 5xx | Client (backoff court) + batcher (re-enfilage 60 s, 5 tentatives) + `retryFailedMappings` horaire |
| Webhook + feed → persist → ack | `ChannexWebhookController` + `ChannexBookingFeedService` (`booking_revisions/feed`, ack par révision post-commit) |
| Mapping IDs internes ↔ UUIDs Channex | `ChannexPropertyMapping` (+ rate plans additionnels) |

## Mise en place (une fois)

> État au 2026-08-16, après le passage intégral. Les cases cochées l'ont été
> vérifiées ce jour-là ; le reste est à refaire si l'environnement est reconstruit.

- [x] Backend dev bâti avec `CHANNEX_API_KEY` (celle de `.env.dev`)
- [x] Sanity : diagnostic Channex de l'écran Intégrations → **4/4 OK**
- [x] Propriété **« Test Property - Baitly »**, devise **USD**, `MA / Africa/Casablanca`, `property_type=apartment`, autoupdate off des deux côtés, `state_length 500`, `min_stay_type both`
- [x] Property / room type / rate plan créés sur staging (identifiants dans la feuille de réponses)
- [x] Tunnel public + `CHANNEX_WEBHOOK_CALLBACK_URL` **avec le chemin complet** `/api/webhooks/channex` → webhook `792bcc83` actif, `event_mask: *`
- [x] Données réalistes : prix variés (pas de valeur uniforme — les données synthétiques uniformes sont **rejetées** à la revue)
- [x] **`CHANNEX_IMPORT_PULL_BOOKINGS=false`** (cf. §Pièges, point 0) — à remettre à `true` après la certification
- [x] Prix de base sur la propriété (`nightly_price = 120.00` sur la propriété 3). Sans lui, `PriceEngine` renverrait `null` pour chaque date et tout push tarifaire partirait vide
- [ ] **Canal Booking.com actif** — `914511ae` existe avec sa propriété rattachée, mais reste `is_active: false`. **Hors de notre main** : l'activation ne passe que par l'assistant Channex, un `PUT is_active: true` répond 200 sans effet. Les pushs partent grâce à `CHANNEX_ALLOW_PUSH_WITHOUT_ACTIVE_OTA`, à remettre à `false` après la certification et à ne **jamais** activer en production

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

> **Statut = résultat du passage du 2026-08-16**, pas un état de santé.
> ✅ vérifié payload en main · ➖ non applicable, justifié.
> Les onze scénarios ont été rejoués d'affilée et chaque `payload.values` relu
> champ par champ sur l'API des tâches.

| # | Test | Déclencheur Baitly | Attendu côté API | Statut |
|---|---|---|---|---|
| 1 | Full sync 500 j | Intégrations → Channex → « Connecter un logement déjà dans Baitly » → icône ⟳ sur la ligne de la propriété (`resync` months=0) | **2 appels** : 1 availability + 1 rates&restrictions (compression date_from/date_to) | ✅ |
| 2 | Prix 1 date / 1 rate | Tarification → « Par propriété » → clic sur une case du calendrier → prix | **1 appel rates, et RIEN d'autre** — pas d'availability, et le payload ne porte que `rate` | ✅ |
| 3 | Prix multi-rates, 1 date | N/A — Baitly VR mono rate-plan (voir note test 14). Couvert par le test 2. | **1 appel** | ➖ |
| 4 | Prix multi-dates multi-rates | Même écran, **cliquer-glisser** sur une plage → barre d'action en bas → « Modifier le prix » → « Appliquer sur la période » | **1 appel** rates compressé (une entrée), payload limité à `rate` | ✅ |
| 5 | Min stay sur rates | Onglet Restrictions → séjour min **seul** (ne rien remplir d'autre) | **1 appel** rates, payload limité à `min_stay_*` | ✅ |
| 6 | Stop sell | **Bloquer UNE SEULE nuit** depuis le planning (onglet Blocage de la modale) | **1 appel** rates, payload limité à `stop_sell: true`, `availability` **inchangée à 1** | ✅ |
| 7 | Restrictions combinées (CTA/CTD/min/max stay) | Onglet Restrictions → min + max + CTA + CTD sur une plage **libre de toute restriction** | **1 appel** rates, une entrée, les quatre champs, ni tarif ni `stop_sell` | ✅ |
| 8 | Semestre (rate+CTA+CTD+min stay, 5 mois) | **Deux gestes espacés** : un plan tarifaire « Base » sur 2027-08-01→12-31, puis l'édition de la restriction semestrielle | **2 appels** rates, un par dimension changée, chacun une entrée sur les 153 jours | ✅ |
| 9 | Availability 1 date | **ANNULER** une résa d'UNE nuit → dispo repasse à 1 | 1 appel availability, `availability: 1` (créer une résa donne 0, ce que Channex refuse) | ✅ |
| 10 | Availability multi-dates | **ANNULER** une résa de plusieurs nuits | 1 appel availability, `availability: 1`, compressé sur les nuits occupées (la nuit de départ n'en fait pas partie) | ✅ |
| 11 | Réception bookings (create/modif/annulation) | Résa directe poussée au CRS (`push-crs`) → **new** ; séjour prolongé par `PUT /bookings/:id` → **modified** ; `cancel-crs` → **cancelled** | réception par **webhook/flux UNIQUEMENT** → persist → ack par révision. Aucun appel de liste ni par identifiant (cf. point 0) | ✅ |
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

> ### Test 11 — trois choses qu'on ne trouve qu'en le jouant
>
> **Le push CRS n'a aucune commande d'interface.** `POST
> /api/integrations/channex/reservations/{id}/push-crs` et son pendant
> `cancel-crs` n'existent que côté API — aucun bouton ne les appelle dans le
> front. Les invoquer depuis la session authentifiée, en visant le backend
> **directement** (`http://localhost:8084`) : le serveur de dev Vite ne proxifie
> pas `/api`, un appel relatif répond 404 sans jamais atteindre Spring.
>
> **La modification passe par un `PUT /bookings/:id` complet.** Envoyer le seul
> champ modifié fait répondre `can't be blank` sur `property_id`, `currency`,
> `ota_name`, `arrival_date`, `customer` et `rooms` : il faut relire le booking,
> reposter l'objet entier avec la valeur changée — et, si l'on prolonge le
> séjour, **ajouter la nuit dans `rooms[].days`** en plus de décaler
> `departure_date` et `checkout_date`.
>
> **Une réservation poussée au CRS nous revient par webhook.** Elle est
> désormais *adoptée* par `channexCrsBookingId` au lieu d'être recréée — le
> journal l'écrit noir sur blanc (« est notre propre resa #N poussée au CRS —
> adoptée, pas de doublon »). Avant ce correctif, chaque passage laissait deux
> réservations sur la même nuit. Vérifier en base qu'il n'en reste qu'une.

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

1. Formulaire : https://forms.gle/xA8F3eSYBPBd8apYA (task IDs + notes)
2. Prévenir Evan (Channex, via Intercom) que le nouveau dossier **remplace** le
   précédent — sans quoi un reviewer peut ouvrir l'ancien et re-refuser sur des
   tâches obsolètes.
3. Credentials production après validation.

**Troisième dossier soumis le 2026-08-16**, avec les identifiants du passage
intégral du même jour. Réponse envoyée dans le fil « Certification form
resubmitted » le jour même.

### Tant que la revue est en cours — ne rien couper

- **Le tunnel et le serveur de dev restent debout.** Si Channex livre un webhook
  qui tombe dans le vide, ce sont ces échecs répétés qui finissent par faire
  désactiver le webhook — l'un des motifs du premier refus.
- **`CHANNEX_IMPORT_PULL_BOOKINGS` reste à `false`.** Une reconnexion de
  propriété suffirait à produire un `booking_revision_received_via_list`.

## Post-certification

- [ ] Révoquer la clé staging (Organisation → API Keys → Withdraw) + régénérer
- [ ] Env prod : `CHANNEX_BASE_URL=https://app.channex.io/api/v1`, clé prod,
  `CHANNEX_WEBHOOK_CALLBACK_URL=https://app.clenzy.fr/api/webhooks/channex`,
  `CHANNEX_WEBHOOK_SECRET`, `CHANNEX_PUBLIC_MEDIA_BASE_URL=https://app.clenzy.fr`
- [ ] Remettre `CHANNEX_IMPORT_PULL_BOOKINGS=true` (le rattrapage d'historique
  redevient utile hors certification)
- [ ] Remettre `CHANNEX_ALLOW_PUSH_WITHOUT_ACTIVE_OTA=false` — **jamais en production**
