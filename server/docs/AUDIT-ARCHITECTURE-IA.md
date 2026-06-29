# Audit architecture IA — Baitly (2026-06-27)

> Objectif : vérifier qu'il existe **UNE seule architecture / logique IA**, sans mécanisme parallèle.
> Le superviseur multi-agent (LangGraph + CopilotKit) doit fonctionner avec l'existant (config, assistant,
> design booking engine, autres features). Audit mené en lecture seule (6 sous-systèmes, agents parallèles).

---

## 1. Verdict en une phrase

La **source de vérité (config en base)** est bien unique et partagée par tout le monde. En revanche, **les couches au-dessus se dédoublent** : deux résolveurs de clé/modèle, deux familles de providers, un gating appliqué de façon inégale, et **un seul vrai mécanisme parallèle hors config : les embeddings/RAG**. Bonne nouvelle : **le superviseur multi-agent N'EST PAS parallèle** — il réutilise déjà le moteur assistant existant.

## 2. Architecture cible (ce vers quoi tout doit converger)

```
                         ┌─────────────────────────────────────────┐
SOURCE DE VÉRITÉ UNIQUE  │  Config DB plateforme                     │
                         │  PlatformAiModel · PlatformAiFeatureModel │
                         │  PlatformAiFeatureProvider · OrgAiApiKey  │
                         │  AiTokenBudget (toggle + budget)          │
                         └───────────────────┬───────────────────────┘
                                             │  (lecture)
RÉSOLUTION               ┌───────────────────▼───────────────────────┐
                         │  1 résolveur : BYOK org → modèle assigné    │
                         │  à la feature (dispo) → repli modèle dispo  │
                         │  → AiNotConfiguredException                 │
                         └───────────────────┬───────────────────────┘
PROVIDER                 ┌───────────────────▼───────────────────────┐
                         │  one-shot (AiProvider) | streaming (Chat…)  │
                         └───────────────────┬───────────────────────┘
CONSOMMATEURS            │ design booking · pricing · sentiment ·     │
                         │ messaging · analytics · content · assistant│
                         │ multi-agent · superviseur · embeddings/RAG │
                         └─────────────────────────────────────────────┘
```

## 3. Ce qui est DÉJÀ unifié (le bon)

- **Stockage de la gouvernance** : toutes les features (8 valeurs de `AiFeature`) et tous les consommateurs lisent la **même config DB** (tables `platform_ai_*`, `org_ai_api_keys`) via `PlatformAiConfigService` / les repos. Pas de second stockage de « quel modèle pour quelle feature ».
- **Les 9 services « features »** (Design, SiteGeneration, SiteContent, PropertyContent, WelcomeGuide, Sentiment, Analytics, Messaging, Pricing) suivent **tous** le même pattern canonique : `requireFeatureEnabled` → `resolveKey` → `requireBudget` → `route` → `recordUsage`. Aucun n'instancie de client HTTP propre ni n'appelle un provider en direct.
- **`AiKeyResolver`** est désormais **DB-only** (BYOK → modèle de la feature si dispo → autre modèle configuré dispo → `AiNotConfiguredException`) ; plus de repli env. Filtre les modèles `UNAVAILABLE`.
- **Le superviseur multi-agent live** passe par le moteur assistant Java existant (voir §5).

## 4. Mécanismes parallèles / écarts (classés par sévérité)

### 🔴 P0 — Correctness & gouvernance (à régler en priorité)

**P0-A — Deux résolveurs avec une divergence dangereuse.**
`AiKeyResolver` (toutes features) et `AssistantTargetResolver` (assistant) **réimplémentent la même précédence** (BYOK → modèle feature → repli) **mais divergent** :
- `AssistantTargetResolver` **n'exclut PAS les modèles `UNAVAILABLE`** (il ne teste que « clé non vide »), alors que `AiKeyResolver.isUsable()` les exclut. → **l'assistant peut router vers un modèle que le scheduler de dispo a marqué mort.**
- Fail-safe divergent : `AiKeyResolver` **lève** `AiNotConfiguredException` ; `AssistantTargetResolver` renvoie une **cible à clé null** (échec délégué au provider).
- Repli divergent : catalogue entier vs BYOK Anthropic codé en dur.

**P0-B — L'assistant n'applique NI toggle NI budget.**
Le flux assistant PMS (`AssistantController` → `AgentOrchestrator` → `AgentToolLoopRunner`) **n'appelle jamais** `requireFeatureEnabled(ASSISTANT_CHAT)` ni `requireBudget(ASSISTANT_CHAT)` — il ne fait que `recordUsage` **après** l'appel. Désactiver la feature ou dépasser le budget **n'arrête pas** l'assistant. Or **la même feature `ASSISTANT_CHAT` EST correctement gatée** quand elle est consommée via le chemin standard (`PublicConciergeService`, `GuestChatService` passent par `AiProviderRouter`). → incohérence nette : la barrière existe pour tout le monde sauf l'assistant PMS.

### 🟠 P1 — Vrai parallèle + duplication structurelle

**P1-A — Embeddings / RAG = le seul vrai mécanisme parallèle.**
`service/agent/kb/EmbeddingService` + `VoyageEmbeddingProvider` / `OpenAIEmbeddingProvider` / `VoyageRerankProvider` résolvent **provider + clé via `@Value` env** (`clenzy.ai.embeddings.*`, `clenzy.ai.rerank.*`), **totalement hors** de la config DB et de `AiKeyResolver`. C'est le contournement le plus net de la source unique. (Ni `application.yml` ni les compose clenzy-infra ne définissent ces clés → en prod, fail-fast à la 1ʳᵉ invocation si non configurées.)

**P1-B — Deux familles de providers + résolution dupliquée.**
`AiProvider` (one-shot, `AiRequest`→`AiResponse`, routé par `AiProviderRouter`) **vs** `ChatLLMProvider` (streaming + tools, `ChatRequest`→`ChatEvent`, routé par `ChatLLMRouter`/`FailoverChatLLMProvider`). **Le split streaming/one-shot est légitime** (l'assistant a besoin de SSE + tool-calling multi-tour). **Ce qui ne l'est pas** : la **logique de résolution** est dupliquée (P0-A), et la gestion d'erreur **410/EOL** est centralisée côté one-shot (`AiProviderErrorHandler`) mais **réimplémentée inline** dans chaque chat provider.

### 🟡 P2 — Hygiène / vestiges (source de vérité « presque » unique)

- **P2-A — Double-gate env** : les 5 services anciens (Pricing/Messaging/Analytics/Sentiment/Design) ont un **2ᵉ interrupteur** env (`clenzy.ai.features.*`, `clenzy.ai.enabled`) au-dessus du toggle DB ; les 4 récents non. Une feature activée en DB peut être bloquée « en silence » par le flag env (défaut `false`).
- **P2-B — UI de config incomplète** : `CONTENT` et `STUDIO_ASSIST` (utilisées en prod) **ne sont pas** dans `AI_FEATURES` du panneau admin → non assignables/togglables depuis l'UI.
- **P2-C — Modèles codés en dur hors DB** : `"claude-sonnet-4"` (`MultiAgentFlowRunner` tracking), `"claude-haiku-4-5-20251001"` (`BriefingComposer`, **prime sur le modèle résolu DB**), défauts dupliqués `AiProperties` ↔ `PlatformAiConfigService.ProviderDefaults`.
- **P2-D — Vestiges env dormants** : enum `KeySource.PLATFORM` jamais émis mais toujours câblé ; clé/modèle env dans les surcharges « sans clé » des providers + `getOrCreateClient` (chemins secondaires, hors résolveurs DB) ; `AssistantTargetResolver.defaultBaseUrl()` lit la baseURL depuis l'env.
- **P2-E — `OpenAiProvider` (one-shot) ne prend pas de baseUrl** → impossible de cibler NVIDIA/proxy en one-shot par ce provider ; contournement par `BedrockProvider` (qui est un client OpenAI-compatible générique mal nommé). `jsonMode` activé sur 1 seul des 8 call-sites qui parsent du JSON.

## 5. Le superviseur multi-agent (la question centrale) — ✅ conforme

- **Seam unique** `SupervisionProvider` (front). Deux implémentations : `MockSupervisionProvider` (défaut prod) et `AgUiSupervisionProvider` (live), bascule via `isSupervisionLiveEnabled()`.
- **Le chemin live n'est PAS parallèle** : `AgUiSupervisionProvider` fait un `POST /api/agui/run` (SSE, JWT Keycloak) → `AgUiController` (Java) **réutilise tel quel `AgentOrchestrator`** → `AssistantTargetResolver` → **config DB `ASSISTANT_CHAT`**. Même moteur, même source de vérité que l'assistant.
- **Le runtime Node CopilotKit** (`copilot-runtime`, conteneurs dev/prod) est un **simple proxy de transport AG-UI** : aucun SDK LLM, aucune clé API dans son environnement ; il relaie vers `AGUI_BACKEND_URL=…/api/agui/run`. Il **n'appelle aucun LLM en propre**.
- **Conséquence** : le superviseur **fonctionne déjà avec l'existant** (assistant + config). Il **hérite** seulement des défauts de l'assistant (P0-A résolveur dupliqué + P0-B pas de gating). Mineur : deux transports live coexistent (`/agui-spike` via le runtime Node vs le direct `AgUiSupervisionProvider`) → à consolider sur un seul.

## 6. Plan d'unification recommandé (priorisé)

1. **P0-A (cohérence dispo, coût quasi nul)** : faire que `PlatformAiConfigService.getActiveModelForFeature` / `findUsableModelByProvider` **filtrent `availabilityStatus != UNAVAILABLE`** — ou faire déléguer `AssistantTargetResolver` à `AiKeyResolver`. Gain immédiat : l'assistant cesse de pouvoir router vers un modèle mort.
2. **P0-B (gouvernance)** : insérer `requireFeatureEnabled(ASSISTANT_CHAT)` + `requireBudget(ASSISTANT_CHAT, source)` à l'entrée du flux assistant (`AgentOrchestrator.handleMessage` ou `AssistantController`). Aligne l'assistant sur toutes les autres features.
3. **P1-A (embeddings)** : ajouter une feature `AiFeature.EMBEDDINGS` (et rerank) et faire résoudre provider+clé par la **config DB** via le résolveur unique, au lieu des `@Value` env. `EmbeddingService` devient un consommateur du resolver.
4. **P1-B (résolveur unique)** : extraire **un seul résolveur** produisant une **liste ordonnée de cibles** `ResolvedTarget(provider, model, apiKey, baseUrl, source)` (superset de `ResolvedKey` + `ChatTarget`). Le one-shot consomme l'élément 0 ; le streaming consomme la chaîne (failover). `ASSISTANT_CHAT` devient une feature comme les autres. Conserver les 2 abstractions provider (streaming/one-shot), mais factoriser le 410/EOL via `AiProviderErrorHandler`.
5. **P2 (hygiène)** : supprimer le double-gate env (`clenzy.ai.features.*`) au profit du toggle DB seul ; ajouter `CONTENT`/`STUDIO_ASSIST` à l'UI de config ; retirer les modèles codés en dur (`BriefingComposer`, `MultiAgentFlowRunner`) + le vestige `KeySource.PLATFORM` ; fusionner `OpenAiProvider`+`BedrockProvider` (one-shot) et renommer `BedrockProvider` ; uniformiser `jsonMode`.

## 7. Annexe — fichiers clés par couche

- **Config (source unique)** : `model/AiFeature.java`, `PlatformAiModel.java`, `PlatformAiFeatureModel.java`, `PlatformAiFeatureProvider.java`, `OrgAiApiKey.java`, `AiTokenBudget.java` ; `service/PlatformAiConfigService.java`, `service/AiTokenBudgetService.java` ; UI `client/src/modules/settings/PlatformAiConfigSection.tsx`.
- **Résolution** : `service/AiKeyResolver.java`, `service/AiProviderRouter.java`, `service/agent/AssistantTargetResolver.java`.
- **Providers** : one-shot `config/ai/{AiProvider,AnthropicProvider,OpenAiProvider,BedrockProvider,AiProviderErrorHandler}.java` ; streaming `config/ai/{ChatLLMProvider,AnthropicChatProvider,OpenAiChatProvider,ChatLLMRouter}.java`, `service/agent/FailoverChatLLMProvider.java`.
- **Assistant / superviseur** : `controller/{AssistantController,AgUiController}.java`, `service/agent/{AgentOrchestrator,AgentToolLoopRunner,MultiAgentFlowRunner}.java`, `service/agent/multiagent/*`, `service/agent/briefing/BriefingComposer.java` ; front `client/src/modules/supervision/*`, `copilot-runtime/server.mjs`.
- **Embeddings/RAG (parallèle)** : `service/agent/kb/{EmbeddingService,VoyageEmbeddingProvider,OpenAIEmbeddingProvider,VoyageRerankProvider}.java`.
