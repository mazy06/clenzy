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

Chaque cas donne : *applicable ?*, le texte de description à recopier, et les
task IDs. Le formulaire compare le texte déclaré au contenu réel de la tâche —
au passage précédent, le test 2 a été refusé parce que la date et le tarif
annoncés ne correspondaient pas à ce que Channex avait reçu.

> ### ✅ Passage du 2026-08-14, après correctifs — chaque payload relu sur l'API
>
> Les IDs ci-dessous ne viennent pas de nos journaux : chaque tâche a été
> relue via `GET /tasks/{id}` sur staging, et son `payload.values` vérifié.
> Toutes sont en `success: true`, sans erreur.
>
> **Un seul ID par test, sauf le test 1.** C'est le cœur du refus précédent :
> Baitly poussait availability ET rates à chaque changement. Un full sync envoie
> légitimement les deux ; un changement ciblé, un seul.
>
> **Chaque test a été déclenché seul, en laissant passer le flush de 30 s.**
> Enchaînés, le batcher fusionne les plages et aucun ID n'est attribuable.

### Test 1 — Full Sync
Applicable : **Yes**

```
1cc44acd-781d-4fc1-bf66-ff5d31a389bf
fc6a44ea-acbc-4b68-a355-3dd0c3a1f996
```

`Property.UpdateAvailability` + `Property.UpdateRestrictions`, 500 jours.
Vérifié : **500 objets de restriction, les six restrictions déclarées présentes
sur les 500** — là où le rapport comptait « 154/181 » et « 181/181 » d'absences.
La disponibilité part en `date_from`/`date_to` fusionnés.

### Test 2 — Single Date Update for Single Rate
Applicable : **Yes**

```
Price set to 333.00 USD on the single date 2026-11-22, from the Pricing screen.
One Property.UpdateRestrictions call, one entry, one date. No availability call.
```

```
5ea7ac56-6e92-4944-999e-d65bccb0829b
```

Payload reçu : `{"date": "2026-11-22", "rate": "333.00", …}`.

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
Applicable : **Yes**

```
Price changed to 275.00 USD over 2026-12-01 to 2026-12-05 from the Pricing
screen. One API call, compressed into a single date_from/date_to entry. The
"multiple rates" part is not applicable: we have a single rate plan (see Test 3).
```

```
4f4b527a-4ce5-463f-9417-a4127aa86f86
```

### Test 5 — Min Stay Update
Applicable : **Yes**

```
Minimum stay set to 4 nights on the single date 2027-01-15, from the
Restrictions tab. One Property.UpdateRestrictions call, one entry, one date.
Both min_stay_through and min_stay_arrival are set to 4 (our model holds a
single min-stay value - see Extra Notes).
```

```
9f7d5f27-9cbe-4d61-9402-ecdc7c8e029f
```

### Test 6 — Stop Sell Update
Applicable : **Yes** — *répondait No au passage précédent, c'était l'erreur*

```
Dates 2027-02-10 to 2027-02-13 blocked from the Planning screen. One
Property.UpdateRestrictions call carrying stop_sell: true. Availability stays 1:
a manual block closes the date for sale without consuming inventory, while a
booking consumes it (availability 0). Only a booking touches availability.
```

```
36278866-9d29-47bd-8d0d-fffb1b64f5a2
```

### Test 7 — Multiple Restrictions Update
Applicable : **Yes**

```
Combined restriction over 2027-04-05 to 2027-04-12: min stay 3, max stay 14,
closed to arrival and closed to departure. One Property.UpdateRestrictions call.
It contains two entries because the nightly rate differs across the range;
restriction values are identical throughout.
```

```
6cd6f048-199b-4ff6-bb28-e1a16683366a
```

### Test 8 — Half-year Update
Applicable : **Yes**

```
Combined restriction over 153 days, 2027-08-01 to 2027-12-31: min stay 3,
max stay 21, closed to arrival and closed to departure, with rates. One single
Property.UpdateRestrictions call, compressed into 6 date_from/date_to ranges
following the rate changes.
```

```
9b0c5223-7dd8-471b-9f69-7fdc5e0c09fa
```

### Test 9 — Single Date Availability Update
Applicable : **Yes**

```
One-night booking created for 2027-03-05. One Property.UpdateAvailability call,
one entry, single date, availability 0 - the unit is taken. No rate or
restriction call is emitted.
```

```
0d43be0c-64bd-45f2-aa04-9831bd2d2328
```

### Test 10 — Multiple Date Availability Update
Applicable : **Yes**

```
A four-night booking over 2026-12-01 to 2026-12-04 was cancelled, releasing the
unit. One Property.UpdateAvailability call, availability 1, compressed into a
single date_from/date_to range. One unit, so availability is 1 when free and 0
when booked.
```

```
1a54db96-52a7-4280-85b2-f1d730edd556
```

> Il a fallu passer par une **annulation** : depuis la séparation
> inventaire / fermeture, seule une réservation touche `availability`. C'est
> aussi ce qui répond au « Availability is 0, expected 1 or 3 » du rapport.

### Test 11 — Booking Receiving
Applicable : **Yes**

| Champ | Valeur |
|---|---|
| **Booking ID** | `9dc4350b-b8ea-41aa-ab97-91d9672c329d` |
| **Revision — New** | `028960e8-56d2-43ff-bb41-7c5897a60cff` |
| **Revision — Modified** | `738a68ab-635c-4c7a-828b-60dfbcc2eaf2` |
| **Revision — Cancelled** | `d1725050-3511-4c6d-b660-f2c669dc9188` |

```
Bookings are received through the webhook. Channex delivered booking, booking_new
and ari events to our public endpoint; each delivery drains the revisions feed and
acknowledges per revision, after the persistence commit. No list polling and no
by-id fetching was used during this run.

New: a direct reservation was pushed to the CRS. Modified: the stay was extended
by two nights and occupancy raised to 3, from the Booking CRS app. Cancelled:
cancelled from Baitly.
```

Les trois revisions sont en `acknowledge_status: acknowledged` cote Channex.
Chaine complete relevee dans les journaux, en quelques secondes :

```
15:25:03  webhook recu: event=booking  -> ack 028960e8  (1 traitee, 1 ackee, 0 echec)
15:25:39  webhook recu                 -> ack 738a68ab
15:26:01  webhook recu                 -> ack d1725050
```

> **Ce qui a change depuis le refus.** Le rapport disait « All webhook deliveries
> for revision 6548e90c… failed ». Deux causes, corrigees : l'URL enregistree
> etait la racine du tunnel, sans `/api/webhooks/channex` — chaque livraison
> tombait en 404 et Channex a fini par desactiver le webhook ; et
> `/webhooks/ensure` se contentait de signaler un webhook inactif au lieu de le
> reactiver. Les revisions arrivent desormais **par livraison webhook**, pas par
> le planificateur de 10 minutes.
>
> **Aucun `pull-bookings` ni `getBooking` de tout le passage.** Les huit
> evenements `..._via_list` / `..._via_find` reproches venaient d'appels de
> diagnostic, pas d'un flux automatique.
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

Les onze scénarios ont été rejoués le 2026-08-14 après correctifs, chaque
payload relu sur l'API des tâches Channex. Il reste :

1. **Trancher la réponse PCI** — seul champ encore ouvert.
2. **Cocher Stop Sell** dans les fonctionnalités : la réponse passe de No à Yes,
   c'était l'erreur qui rendait le test 6 injouable.
3. **Recopier les Extra Notes** du runbook, dont la note sur le second rate plan
   dérivé par Channex — sans elle, le test 3 peut se faire rouvrir.
4. **Rejouer les scénarios depuis l'écran** avant le screenshare : ce passage a
   été déclenché par les endpoints, qui sont le même chemin de code mais pas le
   même geste. Le reviewer demandera des actions dans l'interface.

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
