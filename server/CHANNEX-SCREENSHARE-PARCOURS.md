# Channex — parcours du screenshare, pas à pas

> À suivre **dans l'interface Baitly**, pas par les endpoints. C'est la
> différence qui compte : le reviewer regarde des clics, et il improvise
> (« changez ce prix à 250, ce séjour minimum à 3 »). Le passage du 2026-08-14 a
> été déclenché par API — même chemin de code, geste différent.
>
> Chaque étape indique **où cliquer**, **ce qui doit s'afficher**, et **la preuve
> à montrer**. Les captures annotées viendront s'insérer à ces emplacements.

## Avant de partager l'écran

| # | Vérification | Comment | Si ça cloche |
|---|---|---|---|
| 0.1 | Conteneurs debout | `docker ps` — `clenzy-server-dev` healthy | recréer le serveur |
| 0.2 | Le canal Booking.com existe encore | Réglages → Intégrations → dialogue Channex | le recréer (§1) — Channex reprend les hôtels de test sans prévenir |
| 0.3 | Un terminal avec les journaux | `docker logs -f clenzy-server-dev \| grep ChannexSync` | — |
| 0.4 | Deuxième écran ou onglet : l'API des tâches Channex | pour montrer le payload reçu | — |

> **Le terminal des journaux est la pièce maîtresse.** C'est là que le reviewer
> voit partir les appels en direct : `ChannexSync[rates]: property=3
> task_ids=[…]`. Le garder visible pendant tout le partage.

## 1. Connecter l'OTA — si le canal a disparu

**Écran** : `/settings?tab=integrations` → carte Channex → dialogue du logement.

1. **Connecter OTAs** → **Booking.com**
2. Second écran : saisir l'**identifiant Booking.com** — `10485037` (hôtel de
   test USD, gratuit). *Ce champ est le nôtre : il permet de créer le canal déjà
   rattaché au bon logement.*
3. **Continuer** → le wizard Channex s'ouvre **sur un canal déjà créé**. Le titre
   doit être « **BookingCom - Test Property - Baitly** » : c'est le format que
   notre backend génère, la preuve que la pré-création a marché.
4. Onglet **Mapping** : mapper **Apartment `1048503702`** → notre room type, et
   **Standard Rate `37364460`** → notre *Standard Rate*. Enregistrer.
5. **Actions → Activate**.

> ⚠️ **L'activation ne passe QUE par le wizard Channex.** Un `PUT is_active:true`
> répond 200 sans effet — Channex l'active via son action, qui teste la connexion
> avec Booking.com. À dire au reviewer plutôt qu'à subir en direct.
>
> Si l'identifiant est refusé (« Channel Already Exists »), un autre intégrateur
> l'a pris : écrire à support@channex.io, ils libèrent la connexion.

## 2. Full sync — test 1

**Écran** : Réglages → Intégrations → dialogue Channex → bouton **⟳**.

- **Attendu** : deux appels, `Property.UpdateAvailability` et
  `Property.UpdateRestrictions`.
- **Preuve** : deux lignes `task_ids=[…]` dans les journaux.
- **À dire** : un full sync envoie légitimement les deux canaux ; c'est le seul
  scénario où c'est le cas.

## 3. Prix sur une date — test 2

**Écran** : `/tarification` → onglet **Par logement** → calendrier de prix.

- Changer le prix d'**une seule nuit**.
- **Attendu** : **un seul** appel, `scope=RATES`. Aucun appel de disponibilité.
- **Preuve** : `push batche property=3 period=[D,D] scope=RATES` puis un unique
  `ChannexSync[rates]`.
- **Le point à montrer** : la période affiche la **même date deux fois**. C'est
  la normalisation des bornes — avant, une nuit modifiée en poussait deux.

## 4. Prix sur une plage — test 4

Même écran, sélectionner **plusieurs nuits**.

- **Attendu** : un seul appel rates, compressé en `date_from`/`date_to`.
- **Preuve** : dans le payload de la tâche, **une seule entrée** pour toute la
  plage, pas une par date.

## 5. Séjour minimum — test 5

**Écran** : `/tarification` → onglet **Restrictions**.

- Créer une restriction de **séjour minimum seul**, sur **une seule date**.
- **Attendu** : un seul `UpdateRestrictions`, une entrée, une date.
- **À dire** : `min_stay_through` et `min_stay_arrival` portent la même valeur —
  notre modèle n'a qu'un séjour minimum, c'est écrit en Extra Notes.

## 6. Fermeture à la vente — test 6

**Écran** : `/planning` → bloquer une plage de dates.

- **Attendu** : un seul `UpdateRestrictions` avec **`stop_sell: true`**.
- **Le point à montrer** : la disponibilité **reste à 1**. Un blocage ferme la
  vente sans consommer l'inventaire ; seule une réservation le consomme.
- **À dire** : c'est le test qu'on avait déclaré non applicable à tort.

## 7. Restrictions combinées — test 7

**Écran** : `/tarification` → **Restrictions**.

- Séjour min + max + fermeture à l'arrivée + au départ, sur une plage.
- **Attendu** : **une seule tâche**. Elle peut contenir plusieurs entrées si le
  tarif varie sur la plage — les valeurs de restriction, elles, sont identiques.
  Le critère porte sur le nombre de tâches, pas d'entrées.

## 8. Semestre — test 8

Même écran, une restriction sur **cinq à six mois**.

- **Attendu** : une seule tâche couvrant toute la période, compressée en
  quelques plages suivant les tarifs.

## 9. Disponibilité, une date — test 9

**Écran** : `/planning` ou `/reservations` → créer une réservation d'**une nuit**.

- **Attendu** : un seul `UpdateAvailability`, une entrée, `availability: 0`.
- **Preuve** : `scope=AVAILABILITY` dans les journaux, aucun appel rates.

## 10. Disponibilité, plusieurs dates — test 10

**Écran** : `/reservations` → **annuler** une réservation de plusieurs nuits.

- **Attendu** : un seul `UpdateAvailability`, `availability: 1`, compressé en
  `date_from`/`date_to`.
- **À dire** : il faut une **annulation** pour montrer une disponibilité
  positive. Le reviewer avait écrit « Availability is 0, expected 1 or 3 » :
  un logement mono-unité vaut 1 quand il est libre.

## 11. Réception d'une réservation — test 11

**Prérequis** : un tunnel public **avec le chemin complet**.

1. Lancer le tunnel, poser
   `CHANNEX_WEBHOOK_CALLBACK_URL=https://<tunnel>/api/webhooks/channex`
2. Recréer le conteneur serveur, puis `POST /webhooks/ensure`
3. Vérifier côté Channex que le webhook est **actif**

Puis, depuis Baitly : créer une réservation directe, la pousser au CRS, la
modifier via l'app Booking CRS, l'annuler.

- **Preuve** : dans les journaux, `Channex webhook recu` suivi de
  `revision acknowledged` — **en quelques secondes**, pas au bout de dix minutes.
- **À dire** : les réservations arrivent par webhook, jamais par interrogation
  de liste.

> ⛔ **Ne jamais lancer `pull-bookings` pendant le partage.** Channex compte
> chaque lecture par liste ou par identifiant comme une réception illégitime.

## Le rythme, et pourquoi il compte

**Un scénario à la fois, en laissant passer 30 secondes entre deux.** Le batcher
agrège les changements d'une même propriété sur cette fenêtre : enchaînés, deux
scénarios partent en un seul appel et plus aucun task ID n'est attribuable. C'est
ce qui a rendu le test 2 inexploitable au passage précédent.

C'est aussi une bonne chose à **expliquer** au reviewer : cette fenêtre est
exactement le batching que leur documentation exige.

## Les cinq questions du pré-vol

Elles peuvent tomber pendant l'appel. Réponses courtes, avec les références :

| Question | Réponse |
|---|---|
| Un changement de prix émet-il un événement observé ? | Oui — `CalendarEngine`, outbox → Kafka `calendar.updates` |
| File d'attente, ou appel direct depuis le handler ? | File — `ChannexAriBatcher`, alimenté par `ChannexCalendarUpdateListener`. Le listener enfile, il n'appelle jamais l'API |
| Sur 429, le retry recule-t-il ? | Oui — différé 60 s, 5 tentatives, puis reprise horaire |
| D'où part `POST /availability` ? | `ChannexClient`, appelé par `ChannexSyncService` |
| Si on supprimait le code de test, le PMS pousserait-il encore ? | Oui — il n'existe aucun code dédié à la certification |
