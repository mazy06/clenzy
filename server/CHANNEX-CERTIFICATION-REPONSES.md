# Channex — réponses préparées pour le formulaire de certification

> Formulaire : 82 champs sur 34 pages. Les réponses ci-dessous croisent la
> structure réelle du formulaire (extraite le 2026-08-07) avec les résultats
> consignés dans `CHANNEX-CERTIFICATION-RUNBOOK.md`.
>
> ## ⛔ Ce dossier a été SOUMIS et REFUSÉ le 2026-08-14
>
> Ne pas resoumettre ces task IDs : ils décrivent le comportement que Channex a
> rejeté. Neuf scénarios sur onze tombaient sur un même défaut — Baitly poussait
> `availability` **et** `rates` à chaque flush, là où le protocole attend un seul
> appel. Les autres reproches : les restrictions déclarées absentes des dates
> sans restriction explicite, `stop_sell` jamais envoyé, `availability = 0` pour
> un blocage là où Channex attend un inventaire, et des livraisons de webhook
> toutes en échec.
>
> **Les quatre correctifs sont faits** (portée des pushes, restrictions
> complètes, `availability` = inventaire + `stop_sell`, webhook réactivable) mais
> **aucun n'a encore été exercé contre le staging**. La prochaine campagne exige
> de tout rejouer : un scénario à la fois, **déclenché depuis l'écran**, en
> laissant passer le flush de 30 s entre deux — sinon le batcher fusionne les
> plages et les task IDs redeviennent inattribuables, ce qui a fait tomber le
> test 2 (« Update targets 2027-03-15, expected the single date 2026-11-22 »).
>
> Le reste du document — setup, UUID, justifications des tests 3 et 6,
> engagements 12/13 — garde sa valeur. Seuls les task IDs sont périmés.

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
| **Restrictions supportées** (cases) | ☑ Availability ☑ Rate ☑ Min Stay Through ☑ Min Stay Arrival ☑ Max Stay ☑ Closed To Arrival ☑ Closed To Departure — **☐ Stop Sell** | Tout est prouvé par les tests 5 et 7. Stop Sell **non coché** : Baitly ferme par `availability = 0`, il ne pousse pas le champ `stop_sell`. Ne pas le cocher est ce qui rend la réponse au test 6 cohérente. |
| Credit card details with bookings ? | **No** | Les paiements passent par l'application Stripe Tokenization de Channex |
| PCI Certified ? | **No, but we use PCI Service like Vaultera, PCI Booking or Tokenex** | ⚠️ *Choix à confirmer.* Baitly ne reçoit ni ne stocke aucune donnée de carte : c'est Stripe (PCI-DSS niveau 1) qui les traite, via l'app de tokenisation de Channex. « No » sec serait trompeur dans l'autre sens — il laisserait croire qu'on manipule des cartes sans protection. |

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

Chaque cas suit le même triptyque : *applicable ?* → si oui, les task IDs ; si
non, la justification.

> ### ✅ Task IDs régénérés le 2026-08-14
>
> Tous les scénarios ci-dessous ont été rejoués sur la propriété recréée
> (`789973a4-…`), avec une grille tarifaire variée — 180 jours, 175 prix
> distincts de 110 à 240 USD, week-ends marqués. Les IDs sont ceux de ce
> passage ; les anciens (9 juillet) pointaient sur une propriété supprimée.
>
> **Chaque test a été déclenché seul, en attendant le flush du batcher entre
> deux.** C'est indispensable : le batcher fusionne les plages d'une même
> propriété sur une fenêtre de 30 s — enchaînés, les tests seraient partis en un
> seul appel et aucun ID n'aurait pu être attribué à un test précis.
>
> L'ordre availability / rates varie d'un test à l'autre dans les journaux ; les
> deux lignes appartiennent au même déclenchement.

### Test 1 — Full Sync
**Test results** (un ID par ligne) :
```
cf4361b6-1ad2-467b-83d0-8c6ce9d730e6
39377a2d-44e6-44a2-b7ad-8ed22c3ba2ca
```

### Test 2 — Single Date Update for Single Rate
Applicable : **Yes**
```
3aaa0ec2-aa81-4aaa-883b-d588c0781de8
607bf28b-896e-4f65-8ce2-1fedb2d92de9
```

### Test 3 — Single Date Update for **Multiple Rates**
Applicable : **No**

> Baitly is a vacation-rental PMS: one property has exactly one room type with
> one rate plan, so there is never more than one rate to update on a given date.
> This scenario is structurally impossible in our data model — it is covered by
> Test 2, which performs the same update on the single rate plan.

### Test 4 — Multiple Date Update for Multiple Rates
Applicable : **Yes**
```
d5ae6aca-5df0-44f4-87d6-08a39ccb2152
d54b8636-4f91-4b61-8d27-5d3a6eeadb14
```
> Une phrase à ajouter dans le champ, sinon le reviewer verra une contradiction
> avec le test 3 : *« Multi-date range on our single rate plan, compressed into
> one call using date_from/date_to. The 'multiple rates' part is not applicable
> (see Test 3). »*

### Test 5 — Min Stay Update
Applicable : **Yes**
```
6e380d46-8791-4ad6-a091-d7e1ace9e44e
ddc37878-8207-47ef-ac3e-8c0dc322ec2c
```

### Test 6 — Stop Sell Update
Applicable : **No**

> Baitly does not push the `stop_sell` field. Closing dates for sale is done by
> pushing `availability = 0`, which is our single source of truth for
> availability — a blocked date, a manual block and a booking all converge to
> the same representation. Task ID `f5c80a78-44c4-4d5c-91b3-c4bd0d6e075b`
> (Test 10) shows a date range being closed this way. If your review requires
> the explicit `stop_sell` field, we will add it — please tell us.

### Test 7 — Multiple Restrictions Update
Applicable : **Yes**
```
3a74a2ea-9c5f-41b7-aa71-7cbf9abd434c
424889c0-d063-43cf-8eb5-f2546e1a234a
```

### Test 8 — Half-year Update
Applicable : **Yes**
```
9790ef16-5c71-4510-b2f6-28fcafc9812b
2f19d09e-72c2-4725-9d6b-215ae8a86606
```

> Joué pour de vrai le 2026-08-14 : une restriction combinée (min 2, max 21,
> CTA, CTD) sur **152 jours** — 2027-08-01 → 2027-12-31 — poussée en **un seul
> appel rates**. Plus de doublon avec le test 7, chaque test a son propre ID.

### Test 9 — Single Date Availability Update
Applicable : **Yes**
```
64e13714-db99-425b-bdd0-152ca5ed637b
1b261919-734b-4ef7-8a10-4b55df67578e
```
> Le premier est l'appel availability — celui que le test vise. Le second est le
> rates émis par le même déclenchement : nos pushes vont par paire, et les
> déclarer tous deux évite de donner une image fausse du schéma d'appels.

### Test 10 — Multiple Date Availability Update
Applicable : **Yes**
```
f5c80a78-44c4-4d5c-91b3-c4bd0d6e075b
7f6de9a9-537e-47a1-8bb0-af4a98bc237d
```

### Test 11 — Booking Receiving — ✅ rejoué le 2026-08-14

| Champ | Valeur |
|---|---|
| **Booking ID** | `813a13e1-237e-4a13-942c-537bbbb4df59` |
| **Booking Revision ID — New** | `6548e90c-393c-4784-a7ed-1bdeacd67874` |
| **Booking Revision ID — Modified** | `78ccf904-d76d-4c35-a6cf-e095ea0f2868` |
| **Booking Revision ID — Cancelled** | `ac013d96-3ee7-48b2-9ce9-7a76100d08df` |

> ⛔ **Démenti par le refus.** Ce paragraphe affirmait qu'aucun webhook public
> n'était nécessaire. Channex a répondu que « the webhook endpoint must accept
> the notification and respond with success », et a compté les huit lectures par
> liste ou par identifiant comme des réceptions illégitimes. Le feed seul ne
> suffit pas.

Le feed de révisions est interrogé toutes les 10 minutes
(`clenzy.channex.booking-feed-interval-minutes`), et c'est ce planificateur qui a
consommé les trois révisions :

```
00:39:26  reservation BAITLY-243 creee depuis 813a13e1-…      ack 6548e90c-…
00:49:25  reservation #244 modifiee (dates_changed=true)      ack 78ccf904-…
00:49:26  reservation #244 annulee depuis Channex             ack ac013d96-…
          ChannexFeed: 3 revisions traitees, 3 ackees, 0 en echec
```

Déroulé : la réservation directe #243 est poussée au CRS (`push-crs`) → révision
**new** ; le séjour est prolongé de 2 nuits et passé à 3 adultes via l'app
Booking CRS, qui joue le rôle du canal → révision **modified** ; l'annulation
part de Baitly (`cancel-crs`) → révision **cancelled**.

> **Un avertissement OVERBOOKING apparaît dans les journaux — il est attendu.**
> La réservation a été fabriquée en la poussant depuis Baitly, donc les nuits
> étaient déjà occupées par la réservation directe #243 quand Channex nous l'a
> renvoyée en tant que booking OTA. Le garde-fou a fait exactement son travail :
> réservation persistée **et** acquittée, calendrier laissé intact, intervention
> signalée. Avec un vrai canal OTA (le cas nominal) la nuit est libre et le
> calendrier se bloque normalement.

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

Après le refus du 2026-08-14, la liste se réduit à ceci :

1. **Rebuild du conteneur**, puis exercer les quatre correctifs contre le
   staging — rien n'a encore été vérifié en conditions réelles.
2. **Rendre Baitly joignable** et lancer `POST /webhooks/ensure` : URL avec le
   chemin `/api/webhooks/channex`, webhook réactivé, une livraison qui aboutit.
3. **Rejouer les onze scénarios depuis l'écran**, un à la fois, en laissant
   passer le flush de 30 s entre deux, et noter le task ID au moment du clic.
4. **Ne pas lancer `pull-bookings`** pendant la campagne.
5. **Trancher la réponse PCI**, toujours ouverte.

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
