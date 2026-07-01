# Superviseur d'agents IA — passage des données mockées aux données réelles

> Objectif : faire passer la constellation d'agents (panneau Planning) du **mock**
> aux **vraies données** du moteur multi-agent, **y compris l'activité ambiante**
> (comètes/journal réels), et basculer le mode live par défaut.
>
> Document de pilotage. Mis à jour au fil des phases.

## Constat (vérifié contre le code, pas le rapport d'audit)

Le rapport initial sous-estimait le backend. État **réel** :

- `GET /api/agui/pending` **fonctionne** → renvoie `List<PendingActionDto>` depuis
  Redis (`AgUiController.pending` → `PendingToolStore.listForUser`). Ce n'était PAS
  un stub vide.
- `STATE_SNAPSHOT.agentActivity{specialist,phase,toolName,task}` **est déjà émis**
  (`AgentSseEventToAgUi` case `agent_activity`, alimenté par `OrchestratorAgent.emitActivity`).
  → la constellation **s'allume** en live quand l'orchestrateur tourne.
- Le HITL (validation inline) **fonctionne** : `POST /api/agui/run` + `resume`
  (`resolvePendingAction` côté front).
- `AgUiSupervisionProvider` (provider réel) est **complet** côté flux conversationnel.

Ce qui bloquait / manque réellement :

1. **(Phase 1 — FAIT)** Bug de contrat sur `/agui/pending` : le front attendait la
   forme `AgUiInterrupt` (`.id`) alors que le backend renvoie `PendingActionDto`
   (`.toolCallId`) → la réhydratation des validations renvoyait **toujours null**.
2. **Snapshot initial** : `getSnapshot()` construit le roster localement (mock `calm`)
   et n'a aucune source réelle pour `feed`, `dayMetrics`, ni la file persistante `pending[]`.
3. **Activité ambiante** : les agents n'agissent QUE pendant un run déclenché par
   l'opérateur (chat). **Aucun runtime autonome** en arrière-plan → en live sans chat,
   la constellation reste calme. Les comètes scriptées du mock n'ont pas d'équivalent réel.
4. **Métriques** (`timeSaved`, `autoActions`) : aucune source / persistance.
5. **Autonomie globale / pause / file « Attend ta validation » persistante** : no-op
   structurels côté provider réel (pas de backend).

---

## Phase 1 — Wiring minimal + bascule live ✅ FAIT

Frontend uniquement, aucun changement backend.

- `AgUiSupervisionProvider.fetchPendingAction` : parse la **vraie** forme
  `PendingActionDto` (`toolCallId`/`toolName`/`description`/`argsSummary`) au lieu
  d'`AgUiInterrupt`. Ajout du type `PendingActionDtoShape` + mapper
  `pendingDtoToAgentAction` (+ `parseArgsSummary` best-effort).
- `supervisionFlags.isSupervisionLiveEnabled` : **live par défaut**, opt-out
  explicite via `VITE_SUPERVISION_LIVE=false|0` ou `sessionStorage`.

**Vérifié** : `tsc --noEmit` propre.

**Caveat assumé** : tant que la Phase 3 n'est pas livrée, la constellation live est
**au repos** sans chat opérateur (comportement attendu, pas un bug).

---

## Phase 2 — De-mock du snapshot + attribution des actions ✅ FAIT

But : retirer la dernière **fuite de mock** en mode live (le header `dayMetrics` et les
métriques d'agents venaient encore de `buildPropertySnapshot('calm')`) et rattacher
chaque action en attente au bon agent.

### Livré
- **Backend** : `PendingActionDto` enrichi d'un champ `specialistName` (nullable, null
  en mono-agent), alimenté depuis `MultiAgentPendingContext.specialistName()` au
  `PendingToolStore.put` (best-effort Redis, hors chemin critique). Permet au front de
  rattacher une action au bon agent constellation.
- **Frontend** (`AgUiSupervisionProvider.getSnapshot`) :
  - `dayMetrics` **honnêtes** : `awaiting` = nb d'actions en attente, `autoActions: 0`,
    `timeSaved: '—'` (plus de valeurs mock). Chiffres réels d'`autoActions`/`timeSaved`
    → Phase 3 (quand l'activité sera persistée).
  - Agents : `metrics: []` (plus de métriques mock), statut **`wait`** pour les agents
    qui ont une action en attente (mappés via `specialistName` → `mapSpecialistToAgent`).
  - `fetchPending()` récupère la **liste complète** (pas juste la 1re action).

**Vérifié** : `tsc` propre · `mvn package -DskipTests` (jar OK) · `PendingToolStorePersistenceTest` 6/6 verts.

### Reporté en Phase 3 (volontairement — YAGNI)
- **Persistance de l'activité** (table `supervision_activity` + feed + métriques réelles)
  et **endpoint snapshot dédié** `GET /api/supervision/property/{id}` : inutiles tant
  qu'aucune activité n'est produite hors chat. Ils prennent leur sens AVEC le runtime
  autonome (Phase 3), qui les alimentera. On les livre donc **avec** la Phase 3.
- **`validatePending`/`editPending` depuis la file** (resume ciblé par `toolCallId`) :
  à câbler quand la file persistante sera affichée (aujourd'hui la validation passe par
  la carte inline `pendingAction`, qui fonctionne).

---

## Phase 3 — Config & catalogue (3-A) puis runtime autonome (3-B)

> Décisions produit prises : déclenchement **event-driven** (Outbox/Kafka + debounce),
> **tout le parc** (→ plafond budget LLM obligatoire), modèle **Nemotron Nano 9B V2**,
> autonomie **`suggest` par défaut**. Config exposée dans **Settings > IA** avec
> **master + par-agent + autonomie**, sur un **catalogue de modules extensible**.

### Phase 3-A — Config + catalogue de modules + UI Settings ✅ FAIT

**Livré & vérifié** (`mvn package`, `ArchitectureRulesTest`, `PendingToolStorePersistenceTest`, `tsc`, JSON locales) :
- Backend : `SupervisionAutonomy` (enum) · entités `SupervisionSettings` (master org)
  + `SupervisionModuleSettings` (org×module, clé string extensible) · repos ·
  `SupervisionModuleRegistry` (catalogue 5 built-in) · `SupervisionConfigService`
  (config effective = overrides org sur défauts catalogue) · `SupervisionConfigController`
  (`GET`/`PUT /api/ai/supervision/config`, org-scopé, écriture admins d'org) · migration `0288`.
- Frontend : hook `useSupervisionConfig` · section `AgentSupervisionSection` dans
  Settings > IA (sous-tab « Superviseur » : master + pause + par-module enable/autonomie) ·
  **gating** du panneau Planning (`canSupervise = canView && config.enabled`) · i18n fr/en/ar.
- **Défaut OFF** : la constellation est masquée tant que l'org ne l'active pas dans
  Settings > IA → aucun effet de bord pour les utilisateurs actuels.

#### (spéc d'origine, pour mémoire)

Fondation du runtime : il faut savoir *quels modules sont actifs et à quel niveau
d'autonomie* avant de faire agir quoi que ce soit. C'est aussi la demande explicite
(toggle dans Settings > IA).

**Catalogue de modules (extensible)** — « module » = un agent de la constellation.
Catalogue de départ : `com`, `rev`, `ops`, `fin`, `rep` (built-in), conçu pour
accueillir des modules **importés** plus tard. Chaque module : `key`, label par
défaut, autonomie par défaut, `builtin`.

**Persistance (org-scopée)** — à confirmer contre l'existant (réutiliser un mécanisme
de settings/feature-flag org s'il existe, sinon créer) :
- master : `constellation_enabled` + `paused` par org.
- par module : `enabled` + `autonomy_level` (suggest/notify/full) par (org, module_key).
- Modules importés : référencés par `module_key` (string) → un module ajouté au
  catalogue slotte sans changement de schéma.

**Backend** : entités + repos + `SupervisionModuleRegistry` (catalogue) +
`SupervisionConfigService` (config effective par org, défauts depuis le catalogue) +
`SupervisionConfigController` (`GET`/`PUT /api/supervision/config`, `@PreAuthorize`,
org-scopé). Migration Liquibase (prochain n° **0288**, table au pluriel, index `org_id`).

**Frontend** : nouvelle sous-section « Superviseur d'agents (constellation) » dans
l'onglet IA (master toggle + liste des modules : enable + select autonomie) + hook
`useSupervisionConfig`. **Gating** : le panneau Planning ne s'affiche que si
`constellation_enabled`, et ne montre que les modules `enabled`. i18n fr/en/ar.

### Phase 3-B.1 — Persistance activité + feed/métriques réels ✅ FAIT

Substrat (sans LLM) que la boucle autonome alimentera, et déjà un de-mock réel : le
feed/journal et le compteur d'actions ne sont plus mock mais issus de l'activité
persistée (produite aujourd'hui pendant un chat opérateur).

**Livré & vérifié** (`mvn package`, `ArchitectureRulesTest` 1/1, `AgUiControllerSecurityTest` 5/5, `tsc`) :
- Backend : entité `SupervisionActivity` + repo · migration `0289` · mapping
  specialist→module dans `SupervisionModuleRegistry` · `SupervisionActivityService`
  (record best-effort + `getSnapshot` ownership-checked via `OrganizationAccessGuard`) ·
  `SupervisionController` (`GET /api/ai/supervision/activity/{propertyId}`) · **tap**
  best-effort dans `AgUiController` (un agent « agit » → une ligne d'activité).
- Frontend : `getSnapshot` lit le feed + `autoActions` réels (`fetchActivity`) et les
  fusionne (plus de feed vide ni de compteur à zéro arbitraire).

### Phase 3-B.2 — Boucle de scan autonome (LLM)

#### Étape 1 — Scan MANUEL ✅ FAIT

Prouve la boucle de bout en bout (vrai LLM → vraie activité → vraies suggestions
dans la file HITL), **déclenché par l'opérateur**, sans coût auto.

**Livré & vérifié** (`mvn package`, `ArchitectureRulesTest` 1/1, `AgUiControllerSecurityTest` 5/5, `tsc`, JSON) :
- Backend : `SupervisionScanService` (revue proactive via `AgentOrchestrator.handleMessage`,
  consumer qui **persiste l'activité** + compte les suggestions ; gating master/pause ;
  ownership propriété) + endpoint `POST /api/ai/supervision/scan/{propertyId}` (synchrone).
- Frontend : `runSupervisionScan` + bouton **« Scanner »** dans le panneau (mode live),
  qui recharge le snapshot après coup (feed/suggestions réels apparaissent). i18n fr/en/ar.
- ⚠️ Un scan **consomme des tokens** (LLM réel) et requiert un modèle IA configuré pour
  l'org. Les actions sensibles proposées ne s'exécutent pas (mode `suggest` → file HITL).

#### Étape 2 — Budget configurable + moteur autonome (default-off) ✅ FAIT

**Livré & vérifié** (`mvn package`, `ArchitectureRulesTest` 1/1, `AgUiControllerSecurityTest` 5/5,
`PendingToolStorePersistenceTest` 6/6, `tsc`, JSON) :
- **Budget configurable** (PAS en dur) : champ `dailyScanBudget` (scans auto/jour/org),
  réglable dans **Settings > IA** (migration `0290` · entité/DTO/service · UI number field · i18n).
- **Garde-budget** `SupervisionScanQuota` : compteur Redis journalier **atomique** (script Lua
  INCR/EXPIRE/DECR, pas de check-then-act).
- **Moteur autonome** `SupervisionAutonomousScanner` (`@Scheduled`) : par org activée (non
  pause, budget>0) → `TenantScopedExecutor.runAsOrganization` → balayage des logements borné
  par le budget → `SupervisionScanService.autonomousScan` (contexte **système**, sans JWT) qui
  journalise l'activité.
- **Kill-switch serveur** : `clenzy.supervision.autonomous.enabled=false` par défaut — rien ne
  tourne tant que non activé (le chemin LLM autonome doit être vérifié en réel avant).

#### Étape 3 — Déclenchement event-driven ✅ FAIT

**Livré & vérifié** (`mvn package`, `ArchitectureRulesTest` 1/1, `AgUiControllerSecurityTest` 5/5) :
- `SupervisionTriggerService` : set Redis « dirty » par org (`markDirty`/`drainDirty`),
  debounce/coalescing **naturel** (N événements → 1 entrée → 1 scan).
- `SupervisionCalendarTriggerListener` : **nouveau `@KafkaListener`** sur `calendar.updates`
  (groupId dédié `clenzy-supervision-trigger`, **additif** — zéro modif des services cœur) →
  sur `BOOKED`/`CANCELLED`, `markDirty(orgId, propertyId)`. Best-effort (pas de DLT).
- `SupervisionAutonomousScanner` devient **event-driven pur** : draine le dirty set et ne
  scanne **que** les logements concernés (plus de balayage complet), borné par le budget.

#### Étape 4 — File de suggestions org-scopée ✅ FAIT

**Livré & vérifié** (`mvn package`, `ArchitectureRulesTest` 1/1, `AgUiControllerSecurityTest` 5/5, `tsc`) :
- Backend : entité `SupervisionSuggestion` + repo · migration `0291` · `SupervisionSuggestionService`
  (record dédupliqué + TTL 7j · list non-expirées · dismiss ownership-org) · endpoints
  `GET /suggestions/{propertyId}` + `POST /suggestions/{id}/dismiss` · **routage** : un scan
  AUTONOME (système) enregistre ses propositions en file org-scopée (attribuées au dernier
  module actif) ; un scan OPÉRATEUR garde le HITL inline (pas de doublon).
- Frontend : `getSnapshot` lit les suggestions → remplit la file persistante `pending`
  (« Attend ta validation ») ; `validatePending`/`editPending` **rejettent** côté serveur.

→ La boucle complète est prête : événement → dirty → scan autonome → **suggestion org-scopée
visible par les opérateurs** dans le panneau Planning.

#### Activation (ops — décision utilisateur)

Reste UNIQUEMENT, avant de flipper `clenzy.supervision.autonomous.enabled=true` :
- vérifier le chemin LLM **sans JWT** (contexte système) en environnement réel (NPE éventuels) ;
- (optionnel) sources d'événements additionnelles : message voyageur reçu → `markDirty`.

### 3.1 Boucle de scan planifiée
- `@Scheduled` (cadence à décider) + **`TenantScopedExecutor`** (contexte tenant hors
  HTTP, cf. règle audit Z2-EFFETS) → pour chaque propriété éligible, exécuter
  l'orchestrateur avec un **prompt de scan** (« passe en revue messages en attente,
  créneaux à faible demande, ménages à planifier… et propose des actions »).
- L'`activitySink` alimente `supervision_activity` (feed réel) ; toute action sensible
  proposée → file persistante `pending` (suggestion en attente de validation).
- **Jamais d'appel HTTP externe dans une transaction** ; effets post-commit.

### 3.2 Streaming ambiant vers le front
Le scan tourne côté serveur sans navigateur connecté. Pour l'afficher en direct :
- **Option A (simple, recommandée pour démarrer)** : `getSnapshot` + **polling** de
  `feed`/`pending`/`dayMetrics` (Phase 2.2) toutes les ~15–30 s dans `subscribe()`.
- **Option B (temps réel)** : canal SSE/WebSocket par org/propriété poussant les
  `StreamEvent` ambiants. Plus lourd (gestion connexions, scaling).

### 3.3 Décisions PRODUIT / COÛT à trancher (bloquantes pour 3.1)
- **Cadence** du scan (ex. toutes les 15 min ? à l'heure ? déclenché par événement
  réservation/message plutôt que cron ?).
- **Périmètre** : toutes les propriétés de toutes les orgs ? opt-in par org/propriété ?
  (un scan LLM par propriété × N propriétés × fréquence = **coût récurrent**).
- **Budget LLM** : plafond de tokens/jour par org ; modèle à utiliser (les scans
  peuvent tourner sur un modèle moins cher).
- **Autonomie** : quelles actions sont **autonomes** (notify/full) vs **suggest-only** ?
  Mapping sur `AutonomyLevel` (`suggest`/`notify`/`full`) déjà dans les types.
- **Garde-fous** : déduplication des suggestions (ne pas re-proposer la même baisse de
  tarif à chaque scan), TTL, opt-out global (le « pause » du panneau).

> Sans ces décisions, 3.1 ne doit pas être implémenté : un scan LLM mal cadré sur tout
> le parc = coût non maîtrisé. Les arbitrages ci-dessus sont à valider avant code.

### 3.4 Persistance autonomie / pause
Table `supervision_settings` (org + property + agent → `AutonomyLevel`, `paused`).
Câble `setGlobalAutonomy` / `setAgentAutonomy` / `setPaused` (no-op aujourd'hui).

**Vérif Phase 3** : tests unitaires sur la boucle de scan (dédup, budget, tenant
isolation) ; `mvn package` ; observation des métriques Micrometer (coût/latence).

---

## Ordre recommandé

1. **Phase 1** ✅ (live correct, réhydratation HITL).
2. **Phase 2** : snapshot + file + métriques honnêtes (valeur immédiate, risque faible).
3. **Phase 3** : runtime autonome — **après** validation des décisions produit/coût 3.3.
