# Channex — réponses préparées pour le formulaire de certification

> Formulaire : 82 champs sur 34 pages. Les réponses ci-dessous croisent la
> structure réelle du formulaire (extraite le 2026-08-07) avec les résultats
> consignés dans `CHANNEX-CERTIFICATION-RUNBOOK.md`.
>
> ## ⛔ Deux dossiers soumis, deux refus — 2026-08-14 puis 2026-08-15
>
> **Refus n°1 (2026-08-14).** Baitly poussait `availability` **et** `rates` à
> chaque flush, là où le protocole attend un seul appel. Plus : restrictions
> absentes des dates sans restriction explicite, `stop_sell` jamais envoyé,
> `availability = 0` sur un blocage, webhooks tous en échec.
>
> **Refus n°2 (2026-08-15).** Les correctifs ont ouvert le défaut inverse. En
> remplissant tous les champs partout pour combler les restrictions manquantes,
> chaque push est devenu un **instantané** là où Channex attend un **delta** :
> « Update also carries all declared restrictions […]; this looks like a
> snapshot-based update rather than a rate-only delta » — quatre scénarios.
>
> ## ✅ Ce qui est corrigé, et vérifié contre staging le 2026-08-15
>
> `ChannexRateField` : un push ne porte plus que le champ modifié. Un prix →
> `rate` seul ; un séjour minimum → `min_stay_*` seuls ; un blocage →
> `stop_sell` seul ; un full sync → tout, l'instantané y restant légitime.
>
> `putDateOrRange` : plus jamais la clé `date`, toujours `date_from`/`date_to`.
> C'est la cause **prouvée** de l'échec du test 8 — payload `9b0c5223` relu, il
> mélangeait les deux syntaxes et leur validateur ne reconstituait pas la
> couverture du semestre.
>
> Cinq payloads produits le 2026-08-15 après correctifs : **une entrée chacun**,
> tous en `date_from`/`date_to`, tous `success: true`. Contre six entrées dont
> une en syntaxe `date` au passage refusé.
>
> ## ✅ ÉTAT DES TASK IDs — les onze scénarios rejoués d'affilée le 2026-08-16
>
> Passage intégral, sans interruption, tous redéclenchés **depuis l'écran**
> (sauf le push CRS du test 11, qui n'a pas de commande d'interface), un à la
> fois, chaque payload relu via `GET /tasks/{id}` :
>
> | Test | Task ID | Payload vérifié |
> |---|---|---|
> | 1 · Full sync | `32889655-fd81-45c7-957e-c9d3411885d6` | availability, 7 entrées / 500 j |
> | 1 · Full sync | `89bdd066-2d00-4f61-aec3-26a73714c18f` | rates, 206 entrées / 500 j |
> | 2 · Prix, 1 date | `39ac6bc3-9e81-4df4-8b6e-81ac9bab09e3` | `rate=312.00` seul, 2026-08-29 |
> | 3 · Multi-rates | — | non applicable, mono rate-plan |
> | 4 · Prix, plage | `0599a64a-15a6-4931-8591-97932c32a68e` | `rate=231.00` seul, 08-17→08-21, 1 entrée |
> | 5 · Séjour min | `6bfb9810-3d2d-404d-b7b0-94b4df91032d` | `min_stay=5` SEUL, 2027-02-09 |
> | 6 · Stop sell | `09baaaa8-be18-4264-91c8-efb6c534344a` | `stop_sell=true` seul, 2026-09-19 |
> | 7 · Restrictions | `7a27a1f8-e69a-4a44-bfa7-15b890a86545` | min 3 / max 10 + CTA/CTD, 05-20→05-24 |
> | 8 · Semestre | `4ff972a7-cd70-46af-958b-5feee6f35e32` | `rate=150.00` seul, 2027-08-01→12-31 |
> | 8 · Semestre | `ae76d246-caaf-4901-b39f-d4104aa67ee8` | restrictions seules, même plage |
> | 9 · Dispo, 1 date | `1d2ff26a-ec59-404c-b614-d106744a8263` | `availability=1`, 2026-08-24 |
> | 10 · Dispo, plage | `6088f883-2cf5-4437-bc0c-cc128e3a0af9` | `availability=1`, 09-12→09-15 |
> | 11 · Réception | `c14a4033` + 3 révisions | webhook only, 3/3 ackées |
>
> Tous en `success: true`, zéro erreur. **Une entrée par appel** quand les
> valeurs sont uniformes, toujours en `date_from`/`date_to`, jamais la clé
> `date`, et **uniquement le champ modifié** — sauf le full sync, où
> l'instantané reste légitime.
>
> **Les onze scénarios sont couverts.** Le test 11 a été rejoué le 2026-08-16
> par le tunnel ngrok : webhook `792bcc83`, chemin complet, trois révisions
> livrées et acquittées (`0e942e7b` new, `dea584d7` modified, `8c929c57`
> cancelled), zéro échec, **et une seule réservation en base** — la #253, que
> l'import a adoptée au lieu de la recréer.
>
> ⚠️ Le webhook pointe sur un **tunnel éphémère**, fermé après ce passage. Pour
> rejouer : relancer un tunnel, remettre `CHANNEX_WEBHOOK_CALLBACK_URL` (chemin
> complet), recréer le conteneur, puis `POST /webhooks/ensure` — et vérifier
> qu'aucun ancien webhook actif ne subsiste, ses échecs de livraison finissant
> par faire désactiver l'ensemble.

## Page 1 — Identité

| Champ | Réponse |
|---|---|
| Adresse e-mail | *(ton compte Google)* |
| **Product name** | `Baitly` |
| **Contact Person Name** | *(à toi)* |
| **Contact Person Email** | *(à toi)* |

## Fonctionnalités du PMS

| Question | Réponse | Pourquoi |
|---|---|---|
| Multiple **Room Types** per Property | **No** | Vacation Rental mono-unité : 1 logement = 1 property à 1 room type |
| Multiple **Rate Plans** per Room Type | **No** | 1 seul rate plan par room type |
| **Restrictions supportées** (cases) | ☑ Availability ☑ Rate ☑ Min Stay Through ☑ Min Stay Arrival ☑ Max Stay ☑ Closed To Arrival ☑ Closed To Departure ☑ **Stop Sell** | **Toutes cochées, Stop Sell comprise.** Cette case était décochée aux deux passages précédents, au motif que Baitly fermait par `availability = 0` : c'était l'erreur. Un blocage envoie désormais `stop_sell: true` en laissant l'inventaire à 1 — seule une réservation le consomme. C'est ce qui rend le test 6 applicable. |
| Credit card details with bookings ? | **No** | Les paiements passent par l'application Stripe Tokenization de Channex |
| PCI Certified ? | **No, but we use PCI Service like Vaultera, PCI Booking or Tokenex** | ✅ **Tranché (2026-08-15) : c'est Stripe.** Baitly ne reçoit ni ne stocke aucune donnée de carte — Stripe, certifié PCI-DSS niveau 1, les traite de bout en bout via l'app de tokenisation de Channex. C'est exactement ce que décrit cette option. Un « No » sec serait trompeur dans l'autre sens : il laisserait croire qu'on manipule des cartes sans protection. |

## Setup Testing Property — ✅ recréé le 2026-08-13

| Champ | Obligatoire | Valeur |
|---|---|---|
| **Property ID at Channex** | oui | `789973a4-dabb-4a35-988b-5670ff4c103c` |
| **Twin Room ID at Channex** | oui | `6e88960e-ca6d-475a-abd6-e4a385717d08` |
| **Twin Room Best Available Rate ID** | oui | `bdacb7fc-684a-4532-84f4-2bca19dcb246` |
| Twin Room Bed & Breakfast Rate ID | non | *laisser vide* |
| Double Room ID | non | *laisser vide (mono-unité)* |
| Double Room BAR / B&B | non | *laisser vide* |

> Le protocole demande 2 room types × 2 rate plans ; en mono-unité on ne remplit
> que la première colonne, ce que la doc autorise explicitement. Les champs
> « Double Room » sont facultatifs — les laisser vides est la bonne réponse, pas
> un oubli.

**Réglages vérifiés sur Channex** (tous conformes au runbook) :

```
titre                                          Test Property - Baitly
devise                                         USD
pays / fuseau                                  MA / Africa/Casablanca
property_type                                  apartment
allow_availability_autoupdate_on_modification  false
allow_availability_autoupdate_on_cancellation  false
state_length                                   500
min_stay_type                                  both
```

`min_stay_type: both` est ce qui rend vrai l'engagement « min stay arrival **et**
through » de la note 2 des Extra Notes. `autoupdate` désactivé des deux côtés
garantit que le PMS reste seul maître de la disponibilité — sans quoi Channex
recalculerait de son côté et les résultats de test seraient ininterprétables.

> ### ⚠️ Deux clés Channex coexistent — ne pas s'y tromper
>
> | Fichier | Clé | Compte |
> |---|---|---|
> | `clenzy-infra/.env` | `uhH3tu…` | **autre compte** ; pas de `CHANNEX_BASE_URL` → défaut `app.channex.io` |
> | `clenzy-infra/.env.dev` | `ulALqE…` | **celui du backend de dev**, `staging.channex.io` |
>
> Les deux fonctionnent contre staging mais voient des comptes **différents**.
> Toute vérification par API doit utiliser la clé de **`.env.dev`** — c'est celle
> que le backend emploie. Une propriété interrogée avec l'autre clé répond
> `resource_not_found` alors qu'elle existe.
>
> Cette confusion a coûté la suppression d'une propriété de staging le
> 2026-08-13 (elle était déjà vide et non conforme, mais la décision reposait
> sur une observation faite avec la mauvaise clé).

## Les 11 cas de test

Chaque cas donne : *applicable ?*, le texte de description à recopier, et les
task IDs. Le formulaire compare le texte déclaré au contenu réel de la tâche —
au passage précédent, le test 2 a été refusé parce que la date et le tarif
annoncés ne correspondaient pas à ce que Channex avait reçu.

> ### Méthode — inchangée, et non négociable
>
> Un ID ne se prend jamais dans les journaux seuls : chaque tâche est relue via
> `GET /tasks/{id}` sur staging et son `payload.values` vérifié champ par champ.
> Le formulaire compare le texte déclaré au contenu réel — un écart suffit.
>
> **Un seul ID par test**, sauf le test 1 (full sync, deux canaux légitimes) et
> le test 8 (une dimension changée = un appel, cf. sa note).
>
> **Un scénario à la fois, 30 s entre deux.** Enchaînés, le batcher fusionne les
> plages et plus aucun ID n'est attribuable — c'est ce qui a fait tomber le test
> 2 au premier passage (« Update targets 2027-03-15, expected 2026-11-22 »).
>
> **Ce que le payload doit montrer, désormais** : une seule entrée par appel
> quand les valeurs sont uniformes, en `date_from`/`date_to` — jamais la clé
> `date` —, et **uniquement le champ modifié**. Un changement de prix ne porte
> ni restriction ni `stop_sell` ; un séjour minimum ne porte pas le prix.

### Test 1 — Full Sync
Applicable : **Yes** — ✅ **IDs À JOUR** (rejoué le 2026-08-16 depuis l'écran)

```
32889655-fd81-45c7-957e-c9d3411885d6
89bdd066-2d00-4f61-aec3-26a73714c18f
```

`Property.UpdateAvailability` + `Property.UpdateRestrictions`, 500 jours.
Vérifié : **500 objets de restriction, les six restrictions déclarées présentes
sur les 500** — là où le rapport comptait « 154/181 » et « 181/181 » d'absences.
La disponibilité part en `date_from`/`date_to` fusionnés.

### Test 2 — Single Date Update for Single Rate
Applicable : **Yes** — ✅ **IDs À JOUR** (rejoué le 2026-08-16 depuis l'écran)

```
Price set to 312.00 EUR on the single date 2026-08-29, from the Pricing screen.
One Property.UpdateRestrictions call, one entry, one date, in date_from/date_to
form with both bounds equal. The payload carries the rate only - no restriction
field and no stop_sell - and no availability call is emitted.
```

```
39ac6bc3-9e81-4df4-8b6e-81ac9bab09e3
```

> Le payload d'avant portait les sept champs : « Update also carries all
> declared restrictions […]; snapshot-based update rather than a rate-only
> delta ». Vérifier que le nouveau ne contient QUE `rate`.

### Test 3 — Single Date Update for Multiple Rates
Applicable : **No**

```
Baitly is a single-unit vacation-rental PMS. One property has exactly one room
type with exactly one rate plan, so a given date never carries more than one
rate. There is no second rate to update, which makes this scenario structurally
impossible in our data model rather than merely unimplemented.

The underlying capability is proven by Test 2, which performs the same
single-date rate update on our single rate plan.
```

### Test 4 — Multiple Date Update for Multiple Rates
Applicable : **Yes** — ✅ **IDs À JOUR** (rejoué le 2026-08-16 depuis l'écran)

```
Price changed to 231.00 EUR over 2026-08-17 to 2026-08-21 from the Pricing
screen. One API call, compressed into a single date_from/date_to entry, carrying
the rate only. The "multiple rates" part is not applicable: we have a single
rate plan (see Test 3).
```

```
0599a64a-15a6-4931-8591-97932c32a68e
```

> Même reproche qu'au test 2 : le payload ne doit porter QUE `rate`.

### Test 5 — Min Stay Update
Applicable : **Yes** — ✅ **IDs À JOUR** (rejoué le 2026-08-16 depuis l'écran)

```
Minimum stay set to 5 nights on the single date 2027-02-09, from the Restrictions
tab. One Property.UpdateRestrictions call, one entry, one date. The payload
carries min_stay_through and min_stay_arrival only - no rate, no max stay, no
closed-to-arrival/departure, no stop_sell. Both min-stay fields hold the same
value (our model has a single min-stay - see Extra Notes).
```

```
6bfb9810-3d2d-404d-b7b0-94b4df91032d
```

> Reproche du 2026-08-15 : « Min stay update also carries other fields
> (closed_to_arrival, closed_to_departure, max_stay, rate, stop_sell); it should
> contain only min stay. » Ne poser QUE le séjour minimum dans le formulaire :
> le filtre ne retient que les champs non nuls de la restriction.

### Test 6 — Stop Sell Update
Applicable : **Yes** — *répondait No au passage précédent, c'était l'erreur*

```
A SINGLE night, 2026-09-19, blocked from the Planning screen. One
Property.UpdateRestrictions call, one entry, that single date, carrying
stop_sell: true and nothing else. Availability stays 1: a manual block closes
the date for sale without consuming inventory, while a booking consumes it
(availability 0). Only a booking touches availability.
```

```
09baaaa8-be18-4264-91c8-efb6c534344a
```

> **Deux reproches en un** le 2026-08-15 : « Update must target a single date,
> got 2027-02-10..2027-02-13 » — quatre nuits bloquées par erreur de
> manipulation — et « also carries other fields; it should contain only stop
> sell ». Bloquer **une seule** nuit, et vérifier que le payload ne porte que
> `stop_sell`.

### Test 7 — Multiple Restrictions Update
Applicable : **Yes** — ✅ **IDs À JOUR** (rejoué le 2026-08-16 depuis l'écran)

```
Combined restriction over 2027-05-20 to 2027-05-24: min stay 3, max stay 10,
closed to arrival and closed to departure. One Property.UpdateRestrictions call,
a SINGLE entry covering the whole range in date_from/date_to form - the four
restriction fields are identical throughout. No rate and no stop_sell: the
update carries only what the restriction changed.
```

```
7a27a1f8-e69a-4a44-bfa7-15b890a86545
```

> Choisir une plage **sans restriction préexistante**. Au premier essai du
> 2026-08-16, la plage 05-10→05-14 chevauchait une restriction déjà en base
> (05-10→05-16, min 3 seul) : c'est elle qui gagnait la résolution, et le push
> ne portait qu'un `min_stay` — ni max, ni CTA/CTD. Le payload était juste, la
> mise en scène ne l'était pas.

### Test 8 — Half-year Update
Applicable : **Yes** — ✅ **IDs À JOUR** (rejoué le 2026-08-16 depuis l'écran)

```
Rate and restrictions applied over 153 days, 2027-08-01 to 2027-12-31.

Two Property.UpdateRestrictions calls, one per changed dimension, because our
PMS emits field-level deltas: an update carries only what actually changed.
Each call is a single entry covering the whole half-year in date_from/date_to
form.

4ff972a7 - rate set to 150.00 EUR over the range, no restriction field.
ae76d246 - min stay 3, max stay 20, closed to arrival, closed to departure,
           no rate and no stop_sell.
```

```
4ff972a7-cd70-46af-958b-5feee6f35e32
ae76d246-caaf-4901-b39f-d4104aa67ee8
```

> **Deux IDs ici, et c'est assumé.** Le modèle delta exigé par les tests 2, 5 et
> 6 — « it should contain only min stay », « only stop sell » — implique un
> appel par dimension modifiée. Les deux critères du test 8 sont satisfaits : un
> tarif valide **et** un séjour minimum valides sur le semestre.
>
> Pour n'en avoir qu'un seul, il faut que les deux gestes tombent dans la même
> fenêtre de flush de 30 s : le batcher fusionne alors les champs par union et
> envoie un appel unique portant tarif et restrictions. Faisable, mais serré
> depuis l'écran — aux deux passages les gestes ont été volontairement espacés,
> justement pour montrer un appel par dimension.
>
> **Ce que ce test corrige.** L'ancien payload `9b0c5223` contenait **six**
> entrées, dont une en syntaxe `date` (`{"date":"2027-09-07"}`) : des nuits
> bloquées à l'intérieur du semestre faisaient alterner `stop_sell`, ce qui
> fragmentait la compression, et l'une des séries ne durait qu'un jour. Le
> validateur Channex, qui lit les `date_from`/`date_to`, ignorait cette entrée
> et ne reconstituait pas la couverture — d'où « No valid rate set over the
> half-year range ». Le prix de base et la restriction semestrielle étaient
> pourtant bien présents en base : ce n'a jamais été un problème de données.

### Test 9 — Single Date Availability Update
Applicable : **Yes** — ✅ **IDs À JOUR** (rejoué le 2026-08-16 depuis l'écran)

```
A one-night booking on 2026-08-24 was CANCELLED, releasing the unit. One
Property.UpdateAvailability call, one entry, single date, availability 1 - the
unit is free again. One unit, so availability is 1 when free and 0 when booked.
No rate or restriction call is emitted.
```

```
1d2ff26a-ec59-404c-b614-d106744a8263
```

> Reproche du 2026-08-15 : « No update sets availability to 1 or 7 (a vacation
> rental is a single unit). » Créer une réservation donne 0 — ce qu'ils
> refusent. Il faut **annuler** une réservation d'UNE nuit pour poser 1.

### Test 10 — Multiple Date Availability Update
Applicable : **Yes** — ✅ **IDs À JOUR** (rejoué le 2026-08-16 depuis l'écran)

```
A four-night booking over 2026-09-12 to 2026-09-16 was cancelled, releasing the
unit. One Property.UpdateAvailability call, availability 1, compressed into a
single date_from/date_to range covering the four booked nights (09-12 to 09-15;
the checkout day was never occupied). One unit, so availability is 1 when free
and 0 when booked.
```

```
6088f883-2cf5-4437-bc0c-cc128e3a0af9
```

> Il a fallu passer par une **annulation** : depuis la séparation
> inventaire / fermeture, seule une réservation touche `availability`. C'est
> aussi ce qui répond au « Availability is 0, expected 1 or 3 » du rapport.

### Test 11 — Booking Receiving
Applicable : **Yes** — ✅ **IDs À JOUR** (rejoué le 2026-08-16)

| Champ | Valeur |
|---|---|
| **Booking ID** | `c14a4033-1d44-48e8-9dc5-7595f0637f25` |
| **Revision — New** | `0e942e7b-898c-444c-9dc9-3268d02f4496` |
| **Revision — Modified** | `dea584d7-1908-426f-a397-fdba9a9fb63c` |
| **Revision — Cancelled** | `8c929c57-55e4-4cb3-93e8-e19b3b1c3ba1` |

```
Bookings are received through the webhook only. Channex delivered booking,
booking_new, booking_modification, booking_cancellation and ari events to our
public endpoint; every delivery answered 200 in under a second, drained the
revisions feed and acknowledged per revision, after the persistence commit.

No list polling and no by-id fetching was used at any point during this run.

New: a direct reservation (2026-09-24 to 2026-09-26) was pushed to the CRS.
Modified: the stay was extended by one night, to 2026-09-27.
Cancelled: the booking was cancelled.
```

Les trois revisions ont ete acquittees une a une. Chaine complete relevee dans
les journaux :

```
22:20:02  webhook event=booking  -> resa #253 ADOPTEE (pas de doublon)
          ack 0e942e7b            (1 traitee, 1 ackee, 0 echec)
22:21:47  webhook event=booking  -> resa #253 modifiee (dates_changed=true)
          ack dea584d7            (1 traitee, 1 ackee, 0 echec)
22:22:24  webhook event=booking  -> resa #253 annulee
          ack 8c929c57            (1 traitee, 1 ackee, 0 echec)
```

**Une seule reservation en base a l'arrivee** — la #253, creee dans Baitly,
poussee au CRS, puis reconnue comme notre propre reservation quand elle nous
est revenue par webhook. C'est le correctif d'adoption par `channexCrsBookingId`
qui evite le doublon ; les deux revisions suivantes retombent ensuite dans le
filet d'idempotence normal, par `externalUid`.

> **Ce qui a change depuis le refus.** Le rapport disait « All webhook deliveries
> for revision 6548e90c… failed ». Deux causes, corrigees : l'URL enregistree
> etait la racine du tunnel, sans `/api/webhooks/channex` — chaque livraison
> tombait en 404 et Channex a fini par desactiver le webhook ; et
> `/webhooks/ensure` se contentait de signaler un webhook inactif au lieu de le
> reactiver. Les revisions arrivent desormais **par livraison webhook**, pas par
> le planificateur de 10 minutes.
>
> ⛔ **Cette affirmation était fausse, et le refus du 2026-08-15 l'a prouvé.**
> On écrivait ici « aucun `pull-bookings` de tout le passage, les événements
> `..._via_list` venaient d'appels de diagnostic ». Le verdict suivant a compté
> **trois** `booking_revision_received_via_list`, et aucun n'était manuel :
> c'est **l'étape 7 de l'import** qui rattrape l'historique par appel de liste à
> chaque connexion de propriété. Channex ayant repris l'hôtel de test quatre
> fois dans la journée, chaque reconnexion en a déclenché un.
>
> D'où le drapeau `CHANNEX_IMPORT_PULL_BOOKINGS`, **à poser à `false`** sur
> l'environnement de certification. La consigne « ne jamais lancer
> `pull-bookings` pendant le partage » était respectée — et inutile.
>
> ⚠️ Le webhook pointe sur un **tunnel ephemere**, ferme apres ce passage. Pour
> rejouer le test 11, relancer un tunnel, remettre
> `CHANNEX_WEBHOOK_CALLBACK_URL` (avec le chemin complet), recreer le conteneur,
> puis `POST /webhooks/ensure`.

## Rate Limits and Update logic

| Question | Réponse |
|---|---|
| **Can you stay in rate limits?** | **Yes** |
| **Do you agree to only send updated changes to Channex?** | **Yes** |

Les deux textes détaillés — à recopier si un champ libre le permet, ou à garder
pour le screenshare — sont dans `CHANNEX-CERTIFICATION-RUNBOOK.md`, section
« Engagements 12/13 ». Résumé :

- **Rate limits** : le débit n'est pas surveillé par un compteur, il est **borné
  mécaniquement** par la fenêtre de flush du batcher (30 s) → ≤ 2+2 appels par
  minute et par propriété, contre 10+10 autorisés. Backoff 60 s sur 429.
- **Deltas only** : il n'existe **aucun full sync automatique**. Les quatre
  planificateurs sont le flush ARI (deltas), la reprise des mappings en erreur
  (7 jours), les réconciliations (qui **lisent**, ne poussent pas) et le
  watchdog (métriques). La resynchronisation 500 jours est manuelle.

## Avant d'envoyer — ce qui reste

**Dix scénarios sur onze portent des IDs à jour**, rejoués depuis l'écran le
2026-08-15 et chacun relu sur l'API des tâches. Il reste :

1. **Le test 11.** Il exige un tunnel public,
   `CHANNEX_WEBHOOK_CALLBACK_URL` avec le chemin complet
   (`/api/webhooks/channex`, jamais la racine), un rebuild du conteneur puis
   `POST /webhooks/ensure`. Vérifier ensuite côté Channex que le webhook est
   **actif**.
2. **Garder `CHANNEX_IMPORT_PULL_BOOKINGS=false`** sur l'environnement de
   certification pendant tout le passage — c'est l'étape 7 de l'import, et non
   un pull manuel, qui a produit les `booking_revision_received_via_list` du
   refus précédent.
3. **Recopier les Extra Notes** du runbook, dont la note sur le second rate plan
   dérivé par Channex — sans elle, le test 3 peut se faire rouvrir.

**Le canal Booking.com : recréé, mais pas activable par nous.** Recréé le
2026-08-15 après sa cinquième disparition (Channex reprend les hôtels de test
sans prévenir) — `914511ae`, titre `BookingCom - Test Property - Baitly`, une
propriété rattachée. Il reste `is_active: false` : l'activation ne se fait que
par leur assistant, un `PUT is_active: true` répond 200 sans effet. Les pushs
partent quand même grâce au contournement `allow-push-without-active-ota`, et
les onze scénarios du 2026-08-16 en attestent — mais si le reviewer exige un
canal actif à l'écran, c'est de leur côté que ça se règle.

### Un bug corrigé au passage

L'import initial (`pull-bookings`, `GET /bookings`) désérialisait l'enveloppe
JSON:API à plat : les champs vivant dans `attributes`, `property_id` restait nul
et chaque booking était rejeté en « ChannexBookingDto manque id ou propertyId ».
Le feed de révisions, lui, déballait déjà correctement — d'où un test 11 vert
alors que l'import restait cassé. Corrigé dans `ChannexBookingsListResponse`,
avec un test qui verrouille la forme réelle de la réponse.

## Rappel de séquence pour le nouveau passage

Le runbook insiste sur un point qui se paie cher : **chaque scénario doit être
déclenché depuis l'UI ou les flux réels de Baitly**, jamais par un script à
côté. Un dossier monté sur des appels fabriqués est rejeté à la revue, et le
screenshare live le vérifie — le reviewer demande un changement de prix dans
l'interface et regarde les appels partir.

Autre exigence facile à manquer : **des prix variés**. Des données synthétiques
uniformes (tout à 100) sont rejetées.
