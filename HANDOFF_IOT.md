# HANDOFF — Objets connectés (Phases 0→3), reprise nouvelle session

> Passation pour reprendre dans une **nouvelle session Claude Code**. Repo app : `/Users/toufik/Desktop/env/projets/sinatech/clenzy`. Repo infra : `/Users/toufik/Desktop/env/projets/sinatech/clenzy-infra`.
> Date : 2026-06-04. **Ne PAS committer ce fichier** (le supprimer/ignorer). Remplace l'ancien `HANDOFF_IOT_HUB.md` (périmé).

---

## 0. ACTION IMMÉDIATE (reprendre ici)

Tout est **codé + vérifié + commité en local sur `main`** (app), **rien n'est poussé ni déployé**. La Phase 2 (caméras + thermostats) est **complète bout-en-bout**, la Phase 3 a (a) et (b) faits. **Prochaine étape : Phase 3 (c) — le moteur d'exécution des automatisations** (voir §6, plan détaillé). Le déploiement (#14) se fera **à la toute fin, quand tout fonctionne** (consigne utilisateur).

Ordre conseillé : **(c) moteur d'automatisations** → puis éventuellement **(c+) scènes IoT** (actions device) → puis **déploiement**.

---

## 1. CONTRAINTES PERMANENTES (non négociables)

- **Répondre en français** (chat, commits, PR). Code/identifiants en anglais.
- **JAMAIS** « Generated with Claude Code » ni emoji robot dans commits/PR. Terminer chaque commit par : `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **AUCUN déploiement** tant que l'utilisateur ne le dit pas — il a explicitement dit « on déploie à la fin quand tout fonctionne ». Commits locaux sur `main` OK.
- **Travailler directement sur `main`** (app). Le déploiement prod = PR `main → production` + CI/CD (déclenché uniquement sur `production`).
- **JAMAIS de fix manuel prod** (SQL ad-hoc, psql, docker) sauf demande explicite.
- **JAMAIS redémarrer/stopper un container Docker** soi-même.
- **Préfixer les commandes avec `rtk`**. Quirks : `rtk` ne passthrough pas `mvn` → `rtk proxy mvn`. Pour les commits multi-lignes : `rtk proxy git commit -F <fichier>` (le `rtk git commit` filtré refuse plusieurs `-m`, mais `rtk proxy git commit -m … -m …` en raw git accepte). Éviter `VAR=$(...)` (le hook rtk casse la substitution) et les longs pipes chaînés (broken pipe).
- **JAMAIS lancer de preview** (`preview_start`) sauf demande explicite → vérifier via `tsc`/`mvn`.
- **Icônes** : barrel `client/src/icons` → **noms sémantiques façon MUI** (ex `Boxes` n'existe PAS, c'est `Inventory2` ; `Plus`→`Add`, `Camera`→`PhotoCamera`, `Thermometer`→`Thermostat`, `Trash2`→`Delete`). **Toujours vérifier le nom exporté réel** avant d'importer (grep `(as |^[[:space:]]+)NomMUI,` dans `src/icons/index.ts`).
- **Liquibase** (pas Flyway). Changesets `server/src/main/resources/db/changelog/changes/NNNN__*.sql` + entrée YAML dans `db.changelog-master.yaml`. Prochain numéro libre : **0176** (0174=cameras, 0175=thermostats déjà pris). Prod : `SPRING_LIQUIBASE_ENABLED=true` (invariant) → les changesets s'appliquent au boot après CD Deploy.
- **Design** : register Baitly = **product**. Palette : primary `#6B8A9A`, accents `#4A9B8E` (vert), `#D4A574` (doré), `#C97A7A` (argile/caméra), `#7BA3C2` (bleu). Bans Impeccable (pas de side-stripe >1px, gradient text, glassmorphism par défaut, etc.).

---

## 2. ÉTAT GIT

### App (`clenzy`) — branche `main`, ~12-13 commits locaux NON poussés
Du plus ancien au plus récent (par feature) :
1. `fix(iot)` — alignement des 16 imports d'icônes sur les noms sémantiques du barrel (le 1er handoff prétendait « 0 erreur TS » à tort).
2. `refactor(iot)` — retrait des 3 onglets dashboard (Noise/SmartLock/KeyExchange) → migrés sous le Hub `/connected-objects/{noise,locks,keys}` (écrans wrapper `IotManagementScreens.tsx`).
3. `feat(iot) Phase 1` — webhook Nuki (NukiWebhookService persiste lockState+batterie), read-model `GET /api/devices` (+ `/providers`), statut providers réel, fix `SmartLockDeviceDto.brand`.
4. `feat(iot) Phase 2 UI` cameras (mock) → puis `fix(test)` → puis Phase 2 UI thermostats (mock).
5. `chore(iot) polish` — flèche `←`→icône, retrait plumbing mort `onNavigateTab`, i18n écrans fr/en/ar, test `DeviceAggregationService` ; + `i18n(ar)` sous-titres dashboard.
6. `feat(iot) #11 cameras backend` (ad2fcb55) — entité Camera, migration 0174, CRUD `/api/cameras`, read-model.
7. `feat(iot) #12 thermostats backend` (7e195118) — entité Thermostat, migration 0175, CRUD + lecture/pilotage Tuya, read-model.
8. `feat(iot) #11/#12 frontend CRUD` (33d28a0e) — camerasApi/thermostatsApi, écrans branchés sur le vrai backend (fini le mock), wizard étendu, deviceRegistry available:true, mocks supprimés.
9. `feat(iot) #11 go2rtc app/front` (61d8a460) — CameraStreamService client API go2rtc, CameraTile lecteur WebRTC iframe.
10. `feat(iot) Phase 3 (b)` (47d2bab4) — alerte bruit → WhatsApp guest.
11. `test(iot)` (f553d609) — couverture tests (28 cas) : `ThermostatServiceTest` (parsing DP Tuya), `CameraServiceTest` (chiffrement RTSP + go2rtc), `CameraStreamServiceTest`, `CameraControllerTest`/`ThermostatControllerTest`/`DeviceControllerTest`, + 2 cas WhatsApp dans `NoiseAlertNotificationServiceTest`.

Vérifié partout : `mvn package` (jar produit) + `tsc -b --force` (0 erreur). Tests verts. **Push souvent rejeté** (un workflow « Sync main with production » resync main) → `rtk git pull --rebase origin main` puis re-push, c'est normal.

### Infra (`clenzy-infra`) — ⚠️ branche `hotfix/redeploy-prod`, working tree SALE
- **Mes changements go2rtc sont dans le working tree mais NON committés** : `docker-compose.dev.yml`, `docker-compose.prod.yml`, `nginx/nginx.conf.template` (modifiés, ajout service go2rtc + proxy `/media/`), `go2rtc/go2rtc.yaml` (nouveau).
- ⚠️ Le repo a AUSSI des **changements pré-existants NON liés** (`docker-compose.staging.yml`, `start-dev.sh`, autres untracked) = travail hotfix de l'utilisateur. **Ne PAS mélanger.** L'utilisateur revoit le diff et committe go2rtc lui-même côté infra.

---

## 3. CE QUI EST FAIT (Phases 0→3b)

- **Phase 0** : Hub `/connected-objects` (supervision unifiée par logement), déployé en prod (PR #194). Onglets dashboard migrés sous le Hub.
- **Phase 1** : webhook Nuki (état live), read-model unifié `GET /api/devices` + `GET /api/devices/providers` (statut connexion Minut/Tuya/Nuki réel, KeyNest présence), fix provider serrures (`brand`).
- **Phase 2 — caméras (#11)** : COMPLET. Backend (entité Camera, migration 0174, CRUD `/api/cameras`, URL RTSP chiffrée AES-256-GCM, read-model kind `camera`) + frontend CRUD (liste, ajout via wizard avec champ URL RTSP, suppression) + **go2rtc** (CameraStreamService enregistre/retire les flux via l'API go2rtc à la création/suppression ; CameraTile = lecteur WebRTC iframe `webrtcUrl`). Infra go2rtc = dans `clenzy-infra` (non committée).
- **Phase 2 — thermostats (#12)** : COMPLET. Backend Tuya (entité Thermostat, migration 0175, CRUD + `refreshStatus`/`setTargetTemp` via TuyaApiService, read-model kind `thermostat`) + frontend (liste réelle, ajout via wizard, suppression, **pilotage de consigne ±0.5°C**).
- **Phase 3 (a)** code serrure auto à la résa : **DÉJÀ FAIT avant cette session** — `AccessCodeResolverService.resolveForReservation()` génère le code (Tuya `createTemporaryPassword` validité check-in→check-out, ou `KeyExchangeCode` lié à la résa), injecté dans le message guest par `GuestMessagingService`. (Optionnel : pré-génération en cache Redis.)
- **Phase 3 (b)** alerte bruit → WhatsApp guest : FAIT (commit `47d2bab4`). `NoiseAlertNotificationService.dispatchWhatsAppGuest()` envoie via `TwilioApiService.sendWhatsApp(guest.phone, body)`, gate sous `config.isNotifyGuestMessage()`, marque `notifiedWhatsapp`. ⚠️ **Caveat** : hors fenêtre WhatsApp 24h, Meta exige un **template approuvé** → à brancher pour la prod (le message transactionnel court actuel peut être rejeté hors session). Un flag de config dédié `notifyWhatsapp` (au lieu de réutiliser `isNotifyGuestMessage`) serait plus propre (nécessite migration + DTO).

---

## 4. CE QUI RESTE

1. **Phase 3 (c) — moteur d'exécution des automatisations** (voir §6, plan détaillé). C'est la prochaine étape.
2. **Phase 3 (c+) — scènes IoT** (optionnel/après) : étendre `AutomationAction` à des actions DEVICE (déverrouiller au check-in, régler le thermostat…) + exécuteur device. Greenfield.
3. **`clenzy-infra`** : l'utilisateur revoit/committe les changements go2rtc (branche hotfix sale — voir §2).
4. **Validation go2rtc** (au déploiement) : enregistrement des flux (API go2rtc), embedding `stream.html` derrière nginx `/media`, ICE WebRTC (ports 8555 TCP/UDP), image `alexxit/go2rtc:1.9.4`, candidats STUN. **Non testé bout-en-bout** (pas de go2rtc qui tourne en dev ici).
5. **#14 Déploiement** (à la fin) : push `clenzy` → PR `main→production` → CI/CD → health `app.clenzy.fr/api/health`=200 ; + commit/déploiement `clenzy-infra` pour go2rtc. Surveiller la CI (`rtk proxy gh pr checks <PR#> --repo mazy06/clenzy --watch`).

---

## 5. RÉFÉRENCE ARCHITECTURE (IoT)

### Read-model unifié (clé de voûte)
- `DeviceController` `/api/devices` (liste `DeviceSummaryDto`) + `/api/devices/providers` (`ProviderStatusDto`). `@PreAuthorize("isAuthenticated()")`.
- `DeviceAggregationService.getDevices(userId)` : **réutilise les services par type** (`smartLockService.getUserDevices`, `noiseDeviceService.getUserDevices`, `keyExchangeService.getPoints`, `cameraService.getUserCameras`, `thermostatService.getUserThermostats`) → mappe en `DeviceSummaryDto` (kind `lock|noise|keybox|camera|thermostat`). Scoping = filtre Hibernate `organizationFilter` (isolation org).
- ⚠️ **Le constructeur de `DeviceAggregationService` grossit à chaque nouveau type** → `DeviceAggregationServiceTest` casse (param constructeur). **À chaque ajout de service injecté quelque part, vérifier les tests qui font `new XxxService(...)`** (mocks Mockito). Pattern récurrent cette session (Nuki, Device, NoiseAlert).

### Entités IoT (toutes org-scopées via `@Filter organizationFilter`)
- `SmartLockDevice` (brand TUYA/NUKI/TTLOCK/YALE, lockState, batteryLevel) — `SmartLockService` (Tuya pour lock/unlock/status), `NukiWebhookService` (état live via webhook `/api/webhooks/nuki/bridge-callback`).
- `NoiseDevice` (MINUT/TUYA), `NoiseAlert` (+ `NoiseAlertService.evaluateNoiseLevel`, `NoiseAlertNotificationService` fan-out in-app/email/guest-email/**guest-whatsapp**), `NoiseAlertScheduler` (poll 5 min).
- `KeyExchangePoint`/`Code`/`Event` (KEYNEST/CLENZY_KEYVAULT).
- `Camera` (migration 0174 ; `rtsp_url_encrypted`, `stream_name` unique go2rtc) — `CameraService` + `CameraStreamService` (client go2rtc).
- `Thermostat` (migration 0175 ; current/target temp en cache, mode heat/cool/eco/off) — `ThermostatService` (Tuya `getDeviceStatus`/`sendCommand`).
- Connexions org-level (tokens chiffrés via `TokenEncryptionService.encrypt/decrypt`, AES-256-GCM) : `MinutConnection`/`TuyaConnection` (lookup `findByUserId`), `NukiConnection` (`findByOrganizationId`).

### go2rtc (caméras)
- Infra : service `go2rtc` (image `alexxit/go2rtc:1.9.4`) dans dev+prod compose, conf `go2rtc/go2rtc.yaml` (API 1984, WebRTC 8555 + STUN), proxy nginx `location /media/` → `clenzy-go2rtc:1984` (strip `/media`, upgrade WS).
- App : `CameraStreamService` (config `clenzy.go2rtc.api-url` défaut `http://clenzy-go2rtc:1984`, `clenzy.go2rtc.public-url` défaut `/media`). `registerStream(name, rtsp)` = `PUT /api/streams?name=&src=` ; `removeStream(name)` = `DELETE /api/streams?src=` ; best-effort (timeouts 2s/3s, log si indispo). `webrtcUrl(name)` = `{public}/stream.html?src={name}`.
- Front : `CameraTile` rend `<iframe src={webrtcUrl}>` à la lecture à la demande.

### Frontend Hub
- `useConnectedObjects.ts` : consomme `GET /api/devices` (1 appel) avec **repli** sur l'agrégation legacy 3-appels si indispo ; + `providers` (statut réel, repli présence). `act(uid, lock/unlock)`.
- `deviceRegistry.tsx` : `DEVICE_KINDS` (icône/couleur/available). camera+thermostat **available:true** désormais.
- `ConnectedObjectsHub.tsx` : KPIs, bandeau « Services reliés » (statut réel), filtre par type, grille par logement, `MANAGE_ROUTE_BY_KIND` (noise/lock/keybox/camera/thermostat → écrans dédiés).
- `AddDeviceWizard.tsx` : ADDABLE = lock/noise/keybox/camera/thermostat ; `defaultKind` (pré-sélection) ; champ RTSP pour camera, ID Tuya pour thermostat.
- Écrans dédiés : `cameras/CamerasScreen.tsx`+`CameraTile.tsx`, `thermostats/ThermostatsScreen.tsx`+`ThermostatTile.tsx`, `screens/IotManagementScreens.tsx` (noise/locks/keys = anciens onglets dashboard).
- APIs : `services/api/{camerasApi,thermostatsApi,devicesApi,smartLockApi,noiseApi,keyExchangeApi}.ts`. `apiClient.get<T>()` renvoie la data directement (préfixe `/api`).

---

## 6. PLAN DÉTAILLÉ — PHASE 3 (c) : moteur d'automatisations

**Constat (investigation cette session)** : l'infra existe DÉJÀ, le moteur d'exécution manque.

### Existe déjà (NE PAS recréer)
- `AutomationRule` (entité) : `triggerType`, `triggerOffsetDays`, `triggerTime`, `conditions` (JSONB), `actionType` (SEND_MESSAGE/SEND_CHECKIN_LINK/SEND_GUIDE), `deliveryChannel` (EMAIL/SMS/WHATSAPP), `template` FK, org-scopé.
- `AutomationTrigger` (enum) : RESERVATION_CONFIRMED, CHECK_IN_APPROACHING, CHECK_IN_DAY, CHECK_OUT_DAY, CHECK_OUT_PASSED, REVIEW_REMINDER.
- `AutomationExecution` (entité + repo) : logs d'exécution.
- `OutboxPublisher.publishReservationEvent(eventType, reservationId, propertyId, orgId, payload)` + `OutboxRelay` (poll outbox 2s → Kafka topic `KafkaConfig.TOPIC_CALENDAR_UPDATES`, retry, cleanup).
- `GuestMessagingService.sendForReservation(...)` (envoi message multi-canal, résout le code d'accès via `AccessCodeResolverService`).
- `NotificationService.sendByOrgId(...)` (notif sans TenantContext, pour schedulers).

### À CONSTRUIRE
1. **Publier l'event à la création de résa** : dans `ReservationService.save()` (~ligne 165, après `notifyReservationCreated`), appeler `outboxPublisher.publishReservationEvent("RESERVATION_CREATED", saved.getId(), saved.getProperty().getId(), orgId, payloadJson)`. ⚠️ Vérifier que ce n'est pas déjà fait. (~5 min)
2. **Consumer Kafka** : `@KafkaListener(topics = TOPIC_CALENDAR_UPDATES)` → si eventType=`RESERVATION_CREATED`, déclencher les `AutomationRule` actives avec trigger `RESERVATION_CONFIRMED` pour cette résa (exécution immédiate). (~1j)
3. **Scheduler temporel** : `AutomationExecutionScheduler` `@Scheduled` (cron quotidien ~8h) → pour CHECK_IN_APPROACHING/CHECK_IN_DAY/CHECK_OUT_DAY/CHECK_OUT_PASSED/REVIEW_REMINDER, trouver les réservations dont la date matche (`checkIn == today + triggerOffsetDays`, etc.), exécuter l'action. Logguer `AutomationExecution` (idempotence : ne pas ré-exécuter une règle déjà jouée pour une résa). (~2j)
4. **Evaluator de conditions JSONB** : schéma simple `{"propertyIds":[...], "minNights":N, "maxNights":N, "guestLanguage":"fr"}` (filtrage optionnel). (~1j)
5. **Dispatch d'action** : SEND_MESSAGE → `GuestMessagingService.sendForReservation(reservation, rule.getTemplate(), orgId, rule.getDeliveryChannel())`. (~1j)
6. **Tests** (services + scheduler) + éventuels hooks UI (gestion des règles — probablement hors scope backend).

### Fichiers clés (chemins relatifs `server/src/main/java/com/clenzy/`)
`service/ReservationService.java` (hooks save/cancel), `service/OutboxPublisher.java`, `service/OutboxRelay.java`, `service/GuestMessagingService.java`, `service/access/AccessCodeResolverService.java`, `model/AutomationRule.java`, `model/AutomationTrigger.java`, `model/AutomationExecution.java`, `service/NotificationService.java`, `config/KafkaConfig.java`.

### (c+) Scènes IoT (après, si demandé)
Étendre `AutomationAction` (ou un nouvel enum `DeviceActionType`) : UNLOCK_DOOR, SET_THERMOSTAT_TEMP, SET_THERMOSTAT_MODE… + un `DeviceActionExecutor` qui appelle `smartLockService.sendLockCommand` / `thermostatService.setTargetTemp` selon le device ciblé (par propertyId + kind). Déclencheurs identiques (check-in/out). Greenfield.

---

## 7. GOTCHAS VÉRIFIÉS

- **Vérification compile** : backend `rtk proxy mvn -f server/pom.xml -q -DskipTests package` (produit le jar = build Docker OK ; ⚠️ `-DskipTests` compile QUAND MÊME les tests → un test cassé fait échouer). Pour exécuter un test : `… -Dtest='NomTest' test`. ⚠️ `ls target/clenzy-platform-1.0.0.jar` peut lister un **vieux** jar même si le build a échoué → toujours lire la sortie mvn pour `BUILD FAILURE`/`.java:[`. Frontend : `cd client && npx tsc -b --force 2>&1 | grep "error TS"` (vide=OK ; `--force` obligatoire, le cache incrémental ment).
- **Ajout d'un param constructeur à un @Service** → casse les tests qui le `new …()`. Chercher `new XxxService` dans `src/test`, ajouter le `@Mock` + l'arg. (Cassé 3× cette session : Nuki, DeviceAggregation, NoiseAlert.)
- **DTO** : `record` pour les nouveaux (règle projet), même si le domaine IoT historique a des POJO. Validation `@NotBlank/@NotNull` sur les records de création + `@Valid` au controller.
- **Liquibase** : `splitStatements: true` pour du SQL simple (CREATE TABLE/INDEX), `false` seulement pour des blocs `DO $$` PL/pgSQL. Valider le YAML master : `python3 -c "import yaml; yaml.safe_load(open('…db.changelog-master.yaml'))"`.
- **JSON i18n** : clés imbriquées (`connectedObjects.cameras.title`) — la chaîne pointée n'apparaît jamais littéralement dans le JSON. Valider : `node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/fr.json','utf8'))"`. Le namespace `connectedObjects` est inséré avant `navigation` dans fr/en/ar.
- **Sécurité** : `/api/cameras`, `/api/thermostats`, `/api/devices` → sous `/api/**` (rôle requis) + `@PreAuthorize`. Webhooks publics (`/api/webhooks/nuki/**`) déjà en `permitAll` dans `SecurityConfigProd` + exemptés du TenantFilter.
- **Tuya** : `TuyaApiService.getDeviceStatus(deviceId)` → DPs `{code,value}` ; `sendCommand(deviceId, List<Map<String,Object>>)`. Échelle température variable selon modèle → heuristique `>60 ⇒ /10` dans `ThermostatService` (à affiner par modèle). Passer par une variable typée `List<Map<String,Object>> commands = List.of(Map.of(...))` (sinon inférence de type casse).

---

## 8. STACK (rappel)
Java 21 / Spring Boot 3.2 + React 18 / TS / MUI. Postgres 16 (pgvector), Redis, Kafka (KRaft), Keycloak 24. Dev : back `localhost:8084`, front `localhost:3000` (Vite — suffit pour voir le front sans Docker, mais les caméras/thermostats nécessitent le backend qui tourne). Prod : `app.clenzy.fr`. Repos GitHub : `mazy06/clenzy` + `mazy06/clenzy-infra`. PMS rebrandé **Baitly** (UI), package Java `com.clenzy.*`.

---

## 9. RÉSUMÉ EN UNE LIGNE
Phases 0-2 complètes (Hub + caméras go2rtc + thermostats Tuya), Phase 3 (a)+(b) faites — **prochaine étape : Phase 3 (c) moteur d'automatisations** (l'infra `AutomationRule`/Outbox/Kafka existe, construire scheduler + consumer + wiring `ReservationService`), puis scènes IoT (c+), puis **déploiement** (app + clenzy-infra/go2rtc) à la fin. Rien n'est poussé/déployé.
