# Channex — préparation de l'examen en direct (étape 4)

> Channex décrit cinq étapes et prévient que **l'examen en direct est l'étape
> décisive** : « les étapes 1 à 3 ne font que la préparer ». Ce qu'ils vérifient
> pendant l'appel : que le comportement vu via les task IDs vient bien du PMS et
> non d'un script, que le code est dans la base principale et pas dans un harnais
> de test, et que la file d'attente, le retry et la couche de mapping existent.
>
> Ils demandent des actions **improvisées** — leur exemple : « change ce prix à
> 250 et ce séjour minimum à 3 ». On ne peut donc pas préparer un enchaînement :
> il faut que chaque scénario soit atteignable depuis l'interface.

## Point 1 — chaque scénario est-il reproductible depuis l'interface ?

Vérifié dans le code le 2026-08-14. Le critère n'est pas « un bouton existe »
mais « le bouton atteint le push Channex ». La chaîne est la même pour tous :

```
écran → endpoint → outbox (publishCalendarEvent) → Kafka calendar.updates
      → ChannexCalendarUpdateListener:75  (l'événement ENFILE, il n'appelle pas l'API)
      → ChannexAriBatcher                 (file par propriété, flush 30 s)
      → ChannexSyncService:284            → ChannexClient:1192  POST /availability
```

| Scénario | Écran | Événement émis | Vérifié |
|---|---|---|---|
| Prix (tests 2, 4) | Tarification → onglet **Par logement** → calendrier de prix | `CALENDAR_PRICE_UPDATED` (`CalendarEngine:624`, via `updateManualPrice:655`) | ✅ |
| Séjour min & restrictions (tests 5, 7, 8) | Tarification → onglet **Restrictions** | `RESTRICTION_CREATED/UPDATED/DELETED` (`BookingRestrictionService:63/76/87`) | ✅ |
| Blocage de dates (test 6/10) | Planning → bloquer une plage | `CALENDAR_BLOCKED` (`CalendarEngine:393`) | ✅ |
| Réservation (tests 9, 10) | Planning → créer une réservation | `CALENDAR_BOOKED` / `CALENDAR_CANCELLED` (`CalendarEngine:198/248`) | ✅ |
| Full sync 500 j (test 1) | Réglages → Intégrations → dialogue Channex → bouton ⟳ | appel direct `channexApi.resync` (`ChannexMappingDialog.tsx:507`) | ✅ |

### Ce qui reste à contrôler, application lancée

Le code est bon ; ce qui n'est pas prouvé, c'est que **la propriété de
certification** (logement 3) soit sélectionnable et modifiable dans ces écrans.
À faire une fois, avant l'appel :

- [ ] Tarification → Par logement : le logement 3 apparaît, changer un prix
      d'une nuit future, voir partir un `task_ids=[…]` dans les journaux.
- [ ] Tarification → Restrictions : poser un séjour min sur une plage, idem.
- [ ] Planning : bloquer deux nuits, idem.
- [ ] Réglages → Intégrations : le bouton ⟳ est visible et actif.
- [ ] Journal ouvert pendant l'appel (`docker logs -f clenzy-server-dev | grep ChannexSync`)
      — c'est ce qu'ils veulent voir défiler.

> **Le point d'exposition, dit franchement.** La campagne du 14 août a été
> déclenchée **par les endpoints**, pas par des clics. Ces endpoints sont ceux
> que l'interface appelle — le chemin de code est authentique, ce n'est pas un
> harnais — mais si un scénario ne s'atteint QUE par API, c'est exactement le cas
> qu'ils décrivent comme rédhibitoire : « si un test ne peut pas être reproduit
> depuis votre interface, la certification échoue au screenshare quels que soient
> les task IDs soumis ». D'où la liste ci-dessus.

## Point 2 — brancher un vrai canal OTA de test

Aujourd'hui on pousse grâce à `CHANNEX_ALLOW_PUSH_WITHOUT_ACTIVE_OTA=true`, un
contournement de développement : sans canal actif, `ChannexSyncService`
court-circuite. Montrer ça pendant l'appel serait maladroit. Channex fournit des
propriétés de test Booking.com — autant s'en servir.

**La propriété à prendre : `10485037` (« Test Hotel - USA »), devise USD.** Le
choix est contraint : leur doc prévient que « les rate plans doivent être dans la
même devise, sinon le mapping est impossible », et notre propriété de
certification est en USD. La seule autre en USD (`12152494`, « OTA Pay ») exige
une **vraie carte bancaire** — à éviter.

Le compte staging n'a **aucun channel** à ce jour (`GET /channels` → 0), donc
rien à nettoyer avant.

### Le parcours, entièrement depuis Baitly

C'est un atout pour l'appel : connecter un OTA est lui-même une action du PMS.

1. Réglages → Intégrations → dialogue Channex du logement 3 → **Connecter OTAs**
   → choisir **Booking.com** (`BDC` / `BookingCom`).
   Baitly crée le channel en `is_active: false` (`ChannexClient.createChannel`)
   puis ouvre l'iframe Channex.
2. Dans l'iframe : saisir **Hotel ID `10485037`**, puis *Test Connection*.
3. **Mapper la chambre ET le tarif.** Leur doc est explicite : « le canal ne sera
   pas activé tant que rooms et rates ne sont pas mappés — rooms seul ne suffit
   pas ». Enregistrer.
4. *Actions* → **Activate**.
5. Repasser `CHANNEX_ALLOW_PUSH_WITHOUT_ACTIVE_OTA` à `false` dans `.env.dev` et
   redémarrer : avec un canal actif, le contournement n'a plus lieu d'être. C'est
   la vraie raison de faire cette étape.

### Ce que ça débloque en plus

Une **vraie réservation OTA** pour le test 11, au lieu de simuler le canal :

```
https://secure.booking.com/book.html?hotel_id=10485037&test=1
```

Choisir des dates, réserver, carte **Visa 4111-1111-1111-1111**, CVC `123`,
expiration future. La réservation arrive alors par le canal — plus d'avertissement
OVERBOOKING, puisque les nuits ne sont pas déjà prises par une réservation
directe. Modification et annulation se font ensuite depuis la même interface.

### Si ça coince

- **« Channel Already Exists »** : ces propriétés sont partagées entre
  intégrateurs. Écrire à **support@channex.io** pour qu'ils libèrent la
  connexion. Ils demandent en retour de faire ses tests rapidement.
- Pas d'extranet sur ces comptes de test : API uniquement, utiles seulement pour
  les réservations, messages et avis.

## Le pré-vol de Channex — nos réponses

Ils exigent de pouvoir répondre « oui » aux cinq questions, **fichier et ligne à
l'appui** pour les deux dernières.

| Question | Réponse |
|---|---|
| Un changement de prix émet-il déjà un événement observé par la couche d'intégration ? | Oui — `CalendarEngine:624`, outbox → Kafka `calendar.updates` |
| Y a-t-il une file entre le PMS et le client Channex, ou l'API est-elle appelée depuis le handler de sauvegarde ? | File — `ChannexAriBatcher`, alimenté par `ChannexCalendarUpdateListener:75`. Le listener **enfile**, il n'appelle jamais l'API |
| Sur 429, le retry recule-t-il ? | Oui — ré-enfilement différé de 60 s, `MAX_ATTEMPTS = 5`, puis reprise horaire des mappings en erreur |
| D'où part `POST /availability` ? Fichier et ligne ? | `ChannexClient:1192`, appelé par `ChannexSyncService:284` |
| Si on supprimait tout le code de test de certification, le PMS pousserait-il encore ? | Oui — il n'existe aucun code dédié à la certification |

## Leurs anti-patterns — où on se situe

| Anti-pattern | Nous |
|---|---|
| Script, CLI ou collection Postman qui poste les valeurs du tableau | ✅ absent |
| Une « UI de certification » construite pour l'occasion | ✅ absente |
| Full sync sur minuterie au lieu de deltas | ✅ aucun full sync automatique |
| Un appel par date ou par tarif là où le test dit « 1 appel » | ✅ compression `date_from`/`date_to` |
| UUID ou valeurs codés en dur dans le code de production | ✅ tout passe par la couche de mapping |
| Logique d'intégration dans des fichiers de test | ✅ dans `integration/channex/` |

## Après la soumission du formulaire

Leur page d'accueil précise : **« Please copy into the email support@channex.io »**.
Le formulaire seul ne semble pas programmer l'appel — envoyer un message à
`support@channex.io` signalant la soumission évite d'attendre pour rien.
