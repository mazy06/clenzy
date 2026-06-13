# HANDOFF — Reprise de session (Hub Objets connectés + contexte projet)

> Fichier de passation pour reprendre dans une nouvelle session Claude Code.
> **Ne pas committer ce fichier** (le supprimer ou l'ignorer). Repo : `/Users/toufik/Desktop/env/projets/sinatech/clenzy`.
> Date de passation : 2026-06-03.

---

## 0. ACTION IMMÉDIATE (reprendre ici)

Il y a **3 commits locaux sur `main`, NON poussés**, working tree propre. Le **Hub des objets connectés (Phase 0)** est codé, **compile (0 erreur TS)**, mais **pas encore déployé**.

**Prochaine étape exacte :**
1. `rtk git push origin main` (rebase si rejeté : `rtk git pull --rebase origin main` puis push).
2. Créer la PR `main → production` (titre + corps en français, voir §5 pour le contenu).
3. Surveiller la CI (CI Frontend), merger quand vert, surveiller le CD Deploy clenzy-infra, confirmer `curl https://app.clenzy.fr/api/health` → 200.
4. Demander à l'utilisateur de valider visuellement (`/connected-objects` ou via l'entrée menu « Objets connectés »).

Voir §6 pour le **pattern exact** de déploiement + surveillance CI (background poll).

---

## 1. CONTRAINTES PERMANENTES (NON négociables)

- **Répondre en français** (chat, messages de commit, descriptions de PR). Le code/identifiants restent en anglais.
- **JAMAIS** ajouter « Generated with Claude Code » ni emoji robot dans les commits/PR.
- Chaque message de commit se termine par : `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- **Travailler directement sur `main`**, push, puis **PR `main → production`** + CI/CD pour déployer. Le déploiement prod ne se déclenche QUE sur la branche `production`.
- **JAMAIS de fix manuel sur la prod** (SQL ad-hoc, psql, docker manuel) sauf demande explicite. Tout passe par le CI/CD.
- **JAMAIS redémarrer/stopper un container Docker** soi-même. Si besoin, l'indiquer à l'utilisateur.
- **JAMAIS saisir de secrets/credentials** soi-même.
- **Préfixer les commandes shell avec `rtk`** (Rust Token Killer). Quirks : `rtk` ne passthrough pas `mvn` → utiliser `rtk proxy mvn …`. `rtk proxy grep` pour les greps. Éviter `VAR=$(...)` (le hook rtk casse la substitution) — lancer les commandes directement et piper.
- **Tâches frontend → utiliser les skills design** (impeccable, ui-ux-pro-max). Register Baitly = **product** (pas brand). Palette validée : primary `#6B8A9A`, accents `#4A9B8E` (vert), `#D4A574` (doré), `#C97A7A` (argile), `#7BA3C2` (bleu). Bans Impeccable : pas de side-stripe >1px, pas de gradient text, pas de glassmorphism par défaut, pas de hero-metric template, pas de grille 3-cartes identiques, pas de modal-first. Icônes **lucide via le barrel `src/icons`** (jamais d'emoji).
- **Liquibase** (pas Flyway). Changesets `server/src/main/resources/db/changelog/changes/NNNN__*.sql` + entrée dans `db.changelog-master.yaml`. **Prod : `SPRING_LIQUIBASE_ENABLED=true`** (invariant) → les changesets s'appliquent au boot après CD Deploy. (NB : une vieille note mémoire dit le contraire — c'est PÉRIMÉ, suivre le CLAUDE.md projet.)
- **Ne jamais lancer de preview** (`preview_start`) sauf demande explicite.

---

## 2. ÉTAT GIT ACTUEL

- Branche : `main`. Working tree **propre**.
- **3 commits locaux NON poussés** (`origin/main..HEAD`) :
  1. `b62c7baf feat(iot): Hub des objets connectes — Phase 0 (fusion frontend)` — 7 fichiers
  2. `178bc454 feat(iot): assistant d'ajout unifie + vue detail par logement (Phase 0)` — 4 fichiers
  3. `d2a2dd20 feat(iot): entree menu 'Objets connectes' + i18n (fr/en/ar)` — 4 fichiers
- ⚠️ `main` peut diverger d'`origin/main` (un workflow « Sync main with production » resynchronise main après chaque merge prod) → **push souvent rejeté** → `rtk git pull --rebase origin main` puis re-push. C'est normal.

---

## 3. CONTEXTE — Ce qui a DÉJÀ été déployé cette session (prod, confirmé OK par l'utilisateur)

1. **Refonte atelier des 8 modèles de documents PDF** (devis, facture + 6 : autorisation travaux, bon intervention, justificatif paiement, justificatif remboursement, mandat gestion, validation fin mission). PRs #190, #191. Design « atelier » (lin/encre/taupe, Fraunces + Space Grotesk, logo texte « clenzy. »). Seeds dans `server/src/main/resources/seed/document-templates/*.odt`.
2. **Fix aperçu 500** (PR #192) : `DefaultDocumentTemplateSeeder` re-parse désormais les tags au re-seed (le changeset 0163 avait inséré des tags incomplets — `intervention.lignes` manquant sur 6/8 templates → `[#list undefined]` → crash Freemarker). Self-heal au boot.
3. **Fix navigation** (PR #193) : `client/src/components/PageHeader.tsx` — le bouton retour fait `navigate(-1)` (retour historique, restaure l'onglet `?tab=N`) quand `window.history.state.idx > 0`, sinon `backPath`. **Transverse à tout le logiciel.**

Mécanisme `DefaultDocumentTemplateSeeder` (utile à connaître) : seed/re-seed les templates `system-seed` au boot, par checksum SHA-256, **sans écraser un template admin** (`createdBy != system-seed`). Le **devis** prod était `createdBy = mazytoufik@outlook.com` (upload manuel) → non écrasé → l'utilisateur l'a ré-uploadé manuellement (`~/Downloads/Devis Clenzy.odt`, version atelier propre).

---

## 4. LE HUB DES OBJETS CONNECTÉS (tâche active)

### 4.1 Demande utilisateur
Fusionner toutes les interfaces « objets connectés » (serrures, capteurs sonores, gestion clés, + futur caméras/thermostats) en **UN écran** de supervision + configuration, relié aux services des Settings (Nuki, Tuya, Minut, KeyNest…), ergonomique et UX/UI solide. Le streaming caméra (vidéo live) est un objectif explicite.

### 4.2 Décisions VALIDÉES par l'utilisateur (AskUserQuestion)
- **Architecture = PAR LOGEMENT** (axe principal = le logement, type d'objet en filtre secondaire).
- **Démarrage = Phase 0 « fusion frontend d'abord »** (réutilise les APIs existantes, zéro backend).
- **Caméras = designer maintenant, construire en Phase 2** (tuile « Bientôt » réservée dans l'UI, pas d'implémentation live encore).
- Puis : **déployer** une fois la profondeur faite (← on en est là).

### 4.3 Investigation de l'existant (résumé)
- **Frontend dashboard** (`client/src/modules/dashboard/`) : 3 « mini-apps » bespoke (`DashboardNoiseTab`, `DashboardSmartLockTab`, `DashboardKeyExchangeTab`) + `AnalyticsSimulator` (pricing, PAS IoT) + `ServicesStatusWidget`. Chacune réinvente *offres → config stepper → liste*. Hooks : `useNoiseDevices`, `useSmartLocks`, `useKeyExchange`.
- **Settings** (`client/src/services/integrations/servicesCatalog.ts` = source unique, 37 services / 11 catégories ; `IntegrationsSection.tsx`) : presque tout « Bientôt disponible ». Réellement câblés backend : **Nuki** (complet), **Tuya** (partiel), **Minut** (OAuth + webhook Kafka noise), **KeyNest** (client). + Brevo/Pennylane/Channex (hors IoT).
- **Backend** : entités `SmartLockDevice` (brand TUYA/NUKI, lockState, batteryLevel, propertyId), `NoiseDevice` (MINUT/TUYA), `NoiseAlert`, `KeyExchangePoint`/`Code`/`Event`. **Provider strategy** : interface `SmartLockProvider` (enum TUYA/NUKI/TTLOCK/YALE ; seul Nuki implémenté). Config org-level dans tables `*_connections` (tokens chiffrés). Devices **par logement** (`propertyId`) + org-scopé (Hibernate filter). **AUCUNE caméra/streaming nulle part** (0 occurrence camera/rtsp/hls/webrtc dans tout le repo) → 100% greenfield. Conversion PDF = microservice **Gotenberg** `clenzy-libreoffice:3000` (pas LibreOffice local).

### 4.4 Fichiers CRÉÉS (le module — tout compile, 0 erreur TS)
Module `client/src/modules/connected-objects/` :
- `types.ts` — modèle unifié `ConnectedDevice` (`uid`, `kind`, `id`, `name`, `propertyId`, `propertyName`, `roomName`, `provider`, `statusLevel` ok/warning/critical/offline/unknown, `statusLabel`, `primaryMetric`, `battery`, `online`, `alertCount`, `actions`, `raw`), `PropertyDeviceGroup`, `ProviderConnection`, `ConnectedObjectsKpis`. `DeviceKind` = `'lock'|'noise'|'keybox'|'camera'|'thermostat'`.
- `deviceRegistry.tsx` — `DEVICE_KINDS` (icône lucide, libellé, couleur Baitly, `available`), `DEVICE_KIND_ORDER`, `STATUS_COLORS`, `STATUS_LABELS`. caméra/thermostat = `available:false`.
- `useConnectedObjects.ts` — **agrégateur** : `useQuery(['connected-objects'])` qui `Promise.all` les 3 APIs (`smartLockApi.getAll`, `noiseDevicesApi.getAll`, `keyExchangeApi.getPoints`), mappe en `ConnectedDevice[]`, groupe par logement, calcule les KPIs. `refetchInterval: 30_000`. Expose `act(uid, 'lock'|'unlock')` (appelle smartLockApi + invalidate) et `actingUid`. Chaque fetch `.catch(() => [])` (résilient).
- `components/StatusPill.tsx` — pastille point+libellé (couleur = sens), `pulse` si online.
- `components/DeviceCard.tsx` — **carte unifiée** (badge icône type, nom, pièce, StatusPill, métrique, Wifi/WifiOff, action contextualisée : Verrouiller/Déverrouiller pour lock, « Gérer » sinon). `onAction`, `acting`.
- `components/AddDeviceWizard.tsx` — **assistant d'ajout unifié** (Dialog, 3 étapes : type → service/marque → logement+nom). Remplace les 3 steppers. Soumet vers `smartLockApi.create` / `noiseDevicesApi.create` / `keyExchangeApi.createPoint` selon le type. Props `{open, onClose, onAdded, defaultPropertyId}`.
- `ConnectedObjectsHub.tsx` — **page Hub** `/connected-objects` : PageHeader (action « Ajouter un objet » → wizard), bandeau « Services reliés » (chips dérivés des providers présents + « Gérer les intégrations » → /settings), KPIs (StatTile ×5), filtre par type (FilterChipRow), **grille groupée par logement** (en-têtes cliquables → vue détail), états vides pédagogiques, tuiles « Bientôt » (caméras/thermostats).
- `PropertyDevicesView.tsx` — **vue détail** `/connected-objects/property/:id` : objets du logement **groupés par pièce**, KPIs locaux, ajout pré-rempli (wizard avec `defaultPropertyId`).

Fichiers MODIFIÉS :
- `client/src/modules/AuthenticatedApp.tsx` — 2 routes ajoutées : `/connected-objects` et `/connected-objects/property/:id` (wrappées `<ErrorBoundary>`, imports statiques).
- `client/src/hooks/useNavigationMenu.tsx` — entrée menu `{icon:<Boxes/>, path:'/connected-objects', roles:[SUPER_ADMIN,SUPER_MANAGER,HOST,SUPERVISOR], permission:'properties:view', translationKey:'navigation.connectedObjects', group:'main'}` (après /properties). Import `Boxes` ajouté.
- `client/src/i18n/locales/{fr,en,ar}.json` — clé `navigation.connectedObjects` (« Objets connectés » / « Connected objects » / « الأجهزة المتصلة »).

### 4.5 Limitations connues / TODO (Phase 0 → à finir ou noter)
- ⚠️ Les **3 anciens onglets dashboard** (Noise/Locks/Keys) **existent toujours** — non supprimés volontairement (éviter de déstabiliser le dashboard). À basculer/rediriger vers le Hub dans une passe ultérieure.
- Le **bandeau « Services reliés »** dérive les providers de la présence d'objets (pas du vrai statut). Brancher `minutApi.getStatus()` / `tuyaApi.getStatus()` (+ statut Nuki/KeyNest) en Phase 1.
- L'**ajout keybox** dans le wizard est simplifié (KeyVault/KeyNest + storeName + guardianType INDIVIDUAL). La config riche (carte, horaires, recherche KeyNest) reste dans l'écran dédié existant.
- `DeviceCard` lit l'état serrure via `(device.raw as {lockState?}).lockState` — OK mais le **webhook Nuki backend est un TODO** (état lock pas live ; `getStatus` à la demande seulement).
- Pas de **restauration du scroll** dans les longues listes (seulement l'onglet via le fix nav). `ScrollRestoration` = suivi possible.
- `act()` ne gère que lock/unlock ; le « view »/« Gérer » des non-serrures navigue vers `/dashboard` (placeholder Phase 0).

### 4.6 Roadmap Phases suivantes
- **Phase 1** : vrai statut providers dans le bandeau (gating « Ajouter » par service connecté) ; implémenter le **webhook Nuki** backend (état live) ; read-model backend unifié `GET /api/devices` (`DeviceSummaryDto`) ; rediriger/supprimer les 3 anciens onglets dashboard.
- **Phase 2 (CAMÉRAS)** : entité `Camera` + provider ; passerelle média dans `clenzy-infra` (**MediaMTX / go2rtc** : RTSP/ONVIF → WebRTC faible latence ou HLS) ; `<CameraTile>` (snapshot poster + lecture à la demande, pas d'autoplay) ; Thermostats (Ecobee/Resideo/Tuya climate).
- **Phase 3** : automatisations par logement (code serrure auto à la résa, alerte bruit → WhatsApp guest — partiel existant), scènes.

---

## 5. CONTENU SUGGÉRÉ POUR LA PR `main → production`

**Titre** : `Hub Objets connectés — Phase 0 (supervision unifiée par logement)`

**Corps** (français, markdown) :
- Nouveau module `/connected-objects` : écran unique de supervision des objets connectés **groupé par logement**, réutilisant les APIs existantes (serrures, capteurs sonores, points de remise) — **zéro changement backend**.
- Modèle de données unifié + registre de types (caméras/thermostats réservés « Bientôt », Phase 2).
- Carte d'objet unique, pastille d'état, KPIs, bandeau services reliés, filtre par type, **assistant d'ajout unifié** (remplace 3 steppers), **vue détail par logement** (groupée par pièce).
- Entrée menu « Objets connectés » (gated `properties:view`) + i18n fr/en/ar.
- Respecte le design Baitly atelier (palette validée, primitives réutilisées, bans Impeccable). Typecheck client : 0 erreur.
- Les 3 anciens onglets dashboard restent en place (bascule prévue en Phase 1).

---

## 6. PATTERN DE DÉPLOIEMENT + SURVEILLANCE CI (à réutiliser tel quel)

1. **Push** : `rtk git push origin main` (rebase si rejet).
2. **PR** : `rtk gh pr create --base production --head main --title "…" --body "$(cat <<'EOF' … EOF)"`. (Repo GitHub = `mazy06/clenzy`.) Si une PR prod est déjà ouverte, push suffit (elle se met à jour).
3. **CI** : poll jusqu'au vert. Commande de poll (background) :
   ```bash
   for i in $(seq 1 26); do
     PENDING=$(rtk proxy gh pr view <PR#> --json statusCheckRollup -q '.statusCheckRollup[] | select(.status=="IN_PROGRESS" or .status=="QUEUED") | .name' 2>/dev/null)
     [ -z "$PENDING" ] && { echo "DONE"; break; }
     echo "[$i] $(echo "$PENDING" | paste -sd, -)"; sleep 30
   done
   rtk proxy gh pr view <PR#> --json mergeable,mergeStateStatus -q '"mergeable="+.mergeable+" state="+.mergeStateStatus'
   ```
   Checks frontend attendus : `TypeCheck & Build`, `Security Audit`, `K6 Performance Tests`, `Build & Push Docker Image`, `immutable-changesets`, `validate-structure`. `Trigger deploy via clenzy-infra` = SKIPPED sur la PR (normal, ne se déclenche que sur push production).
4. **Merge** : `rtk gh pr merge <PR#> --merge` (merge commit, **JAMAIS** `--delete-branch` car head=main).
5. **CD Deploy** : le merge pousse sur `production` → run **CI Frontend** (push) sur production → sa job finale déclenche le **CD Deploy** dans `mazy06/clenzy-infra`. Poll :
   ```bash
   # 1) attendre la fin du CI Frontend prod (récupérer son databaseId via gh run list --branch production)
   # 2) DEPLOY=$(rtk proxy gh run list -R mazy06/clenzy-infra --workflow "CD Deploy" --limit 1 --json databaseId -q '.[0].databaseId')
   # 3) poller gh run view $DEPLOY -R mazy06/clenzy-infra jusqu'à completed:success
   ```
6. **Santé** : `curl -s -m 12 -o /dev/null -w "%{http_code}" https://app.clenzy.fr/api/health` → attendre **200** (502 transitoire = fenêtre de boot, poller ~15 s).
7. Background : `rtk` peut mettre les longues commandes en tâche de fond → on est notifié à la fin (lire le fichier output).

---

## 7. RÉFÉRENCE TECHNIQUE (gotchas vérifiés)

- `apiClient.get<T>()` (`client/src/services/apiClient.ts`) renvoie **la donnée directement** (`Promise<T>`, pas de wrapper Axios).
- `propertiesApi.getAll()` → `Promise<Property[]>` (`Property = {id:number, name:string, …}`).
- `smartLockApi` : `getAll()→SmartLockDeviceDto[]`, `create()`, `delete()`, `getStatus(id)`, `lock(id)`, `unlock(id)`. Brand `'TUYA'|'NUKI'|'TTLOCK'|'YALE'`.
- `noiseDevicesApi` : `getAll()→NoiseDeviceDto[]`, `create()`, `delete()`, `getNoiseData`, `getAllNoiseData`. + `minutApi.getStatus()`/`tuyaApi.getStatus()` (`{connected, deviceCount, …}`).
- `keyExchangeApi.getPoints()→KeyExchangePointDto[]`, `createPoint(CreateKeyExchangePointDto {propertyId, provider:'KEYNEST'|'CLENZY_KEYVAULT', storeName, guardianType?, …})`.
- Icônes : barrel `client/src/icons` exporte des noms **lucide** ET des alias type-MUI. Dispo confirmés (entre autres) : `Lock, LockOpen, Volume2, Key, Camera, Thermometer, Wifi, WifiOff, BatteryWarning, BatteryLow, Boxes, Cpu, Home, LayoutGrid, ChevronRight, Plus, Activity, AlertTriangle, ShieldCheck`. (Pas de `DoorClosed`.) Icônes acceptent `size`/`strokeWidth`.
- Primitives réutilisables : `components/StatTile.tsx` (`{icon,label,value,color,hint?,loading?,onClick?}`), `EmptyState.tsx` (`{icon,title,description?,action?,secondaryAction?,tip?,variant?}`), `FilterChipRow.tsx` (générique `<T extends string>` : `{options:[{value,label,color,count}], value:T|'', onChange, allLabel, allColor, allCount}`), `PageHeader.tsx` (`{title,subtitle,iconBadge,backPath,backLabel,actions,onBack?,showBackButton?}`).
- Routing : `client/src/modules/AuthenticatedApp.tsx`, `<Route path element>` react-router v6, imports **statiques**, wrap `<ErrorBoundary>`.
- Menu : `client/src/hooks/useNavigationMenu.tsx` → `MENU_CONFIG_BASE` (items `{icon,path,roles,permission?,translationKey,group:'main'|'management'|'admin'}`). L'accès est filtré par **`permission`** (le champ `roles` est stocké mais PAS utilisé dans `hasMenuAccess`). i18n : `client/src/i18n/locales/{fr,en,ar}.json`.
- Typecheck client : `cd client && npx tsc -b --force 2>&1 | grep "error TS"` (vide = OK). ⚠️ `tsc -b` **sans `--force`** peut afficher des « (N errors) » périmés (artefacts incrémentaux pendant l'écriture) → toujours `--force` pour le compte réel. JSON locales : `node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/fr.json','utf8'))"`.

---

## 8. STACK (rappel)
Java 21 / Spring Boot 3.2 + React 18 / TS / MUI. Postgres 16 (pgvector), Redis 7, Kafka, Keycloak 24. Dev : back `localhost:8084`, front `localhost:3000`, Gotenberg `localhost:8083`. Prod : `app.clenzy.fr`. Repos GitHub : `mazy06/clenzy` (app) + `mazy06/clenzy-infra` (déploiement). PMS rebrandé **Baitly** (UI), package Java encore `com.clenzy.*`.

---

## 9. RÉSUMÉ EN UNE LIGNE
Pousser les 3 commits IoT → PR main→production → déployer (CI Frontend → CD Deploy → health 200) → faire valider `/connected-objects` par l'utilisateur. Puis Phase 1 (statut providers réel, webhook Nuki, read-model `/api/devices`, retrait des anciens onglets), puis Phase 2 (caméras + passerelle média).
