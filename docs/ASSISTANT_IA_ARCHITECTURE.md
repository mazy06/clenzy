# Assistant IA Clenzy — Architecture & Documentation Technique

> Documentation complète de la feature **Assistant IA conversationnel** : architecture, workflow, fonctionnement métier et technique.
> **Date** : 2026-05-27
> **Périmètre** : core agent + 27 tools + KB RAG + simulations + briefings + vision + workflows + memory + frontend chat

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture globale](#2-architecture-globale)
3. [Modèle de données](#3-modèle-de-données)
4. [Core Agent : orchestrator + LLM provider](#4-core-agent--orchestrator--llm-provider)
5. [Tool framework](#5-tool-framework)
6. [Inventaire des 27 tools](#6-inventaire-des-27-tools)
7. [Knowledge Base RAG (pgvector)](#7-knowledge-base-rag-pgvector)
8. [Memory long-terme](#8-memory-long-terme)
9. [Simulations pricing & calendrier](#9-simulations-pricing--calendrier)
10. [Workflows procéduraux](#10-workflows-procéduraux)
11. [Briefings proactifs](#11-briefings-proactifs)
12. [Vision (images)](#12-vision-images)
13. [Frontend chat](#13-frontend-chat)
14. [Sécurité & multi-tenant](#14-sécurité--multi-tenant)
15. [Configuration & déploiement](#15-configuration--déploiement)
16. [Limites connues & TODOs](#16-limites-connues--todos)

---

## 1. Vue d'ensemble

### 1.1 Promesse métier

L'**Assistant IA Clenzy** est un agent conversationnel multimodal intégré au PMS, capable de :

- **Comprendre** les questions métier (FR/EN/AR) sur les propriétés, réservations, finances, opérationnel
- **Exécuter** des actions concrètes (créer une intervention, assigner un technicien, bloquer un calendrier, envoyer un message guest)
- **Simuler** des scénarios « what-if » (changement de prix, blocage calendrier) avec un modèle économique
- **Mémoriser** les préférences et faits long-terme de l'utilisateur (4 scopes)
- **Citer** la documentation Clenzy via RAG (pgvector) — anti-hallucination strict
- **Orchestrer** des workflows multi-étapes guidés (onboarding propriété, clôture de mois, préparation haute saison)
- **Envoyer** des briefings proactifs daily/weekly via 3 canaux (in-app, email, WhatsApp)
- **Analyser** des images (factures, dégradations, plans) via Claude Vision
- **Suggérer** la navigation vers les bonnes pages du PMS

### 1.2 Stack technique

| Couche | Technologie |
|---|---|
| LLM | Anthropic Claude Sonnet 4 (vision, agent) + Claude Haiku 4.5 (briefings, plus rapide) |
| Embeddings | Voyage AI `voyage-3-large` (1024d) ou OpenAI `text-embedding-3-large` (swappable). Choix qualité > coût (surcoût négligeable à notre volume). |
| Re-ranking | Voyage `rerank-2` (cross-encoder) ou NoOp (fallback) |
| Vector store | PostgreSQL 16 + pgvector (extension `vector(1024)`, index `ivfflat cosine`) |
| Streaming | SSE (Server-Sent Events) — pool dédié 10-100 threads |
| Persistance | JPA/Hibernate + Liquibase migrations (0145-0150) |
| Cache | Redis (météo, holidays, RAG hot queries) |
| Schedulers | Spring `@Scheduled` (briefings, retry, memory cleanup, vision alerts, elasticity recompute) |
| Frontend | React 18 + TypeScript + MUI + EventSource SSE consumer |
| Image storage | S3 ou BYTEA selon profile (`PhotoStorageService`) |

### 1.3 Endpoints publics

| Endpoint | Méthode | Description |
|---|---|---|
| `/api/assistant/chat` | POST (SSE) | Envoi message + stream réponse |
| `/api/assistant/conversations` | GET | Liste conversations user |
| `/api/assistant/conversations/{id}/messages` | GET | Historique d'une conversation |
| `/api/assistant/tool-confirm` | POST (SSE) | Confirme/refuse une action write |
| `/api/assistant/upload` | POST multipart | Upload image (vision) |
| `/api/assistant/attachments/{key}` | GET | Récupère image (avec ownership check) |
| `/api/assistant/briefing-prefs` | GET/PUT | Préférences briefing |
| `/api/admin/kb/ingest` | POST multipart | Ingestion doc (admin) |
| `/api/admin/vision/usage/{orgId}` | GET | Stats vision token usage (admin) |

---

## 2. Architecture globale

### 2.1 Diagramme de composants

```
┌──────────────────────────────────────────────────────────────────┐
│  Frontend (React + TS)                                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐│
│  │   AssistantPage  │  │ ChatInput +      │  │ ToolResultWid- ││
│  │   (chat UI)      │  │ MessageList      │  │ get (11 types) ││
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬───────┘│
│           └──────── useAgent hook (SSE consumer) ──────┘        │
└──────────────────────────────┬───────────────────────────────────┘
                               │ POST SSE stream
┌──────────────────────────────▼───────────────────────────────────┐
│  Backend (Spring Boot 3.2 + Java 21)                            │
│                                                                  │
│  ┌──────────────────────┐                                       │
│  │ AssistantController  │  ← REST endpoint + SSE emit           │
│  └──────────┬───────────┘                                       │
│             │                                                    │
│  ┌──────────▼─────────────────────────────────────────────────┐ │
│  │             AgentOrchestrator                              │ │
│  │  (boucle tool-calling max 5 itérations)                    │ │
│  │                                                            │ │
│  │   1. resolve/create Conversation                           │ │
│  │   2. persist user message + attachments                    │ │
│  │   3. build system prompt (memory + RAG injection)          │ │
│  │   4. for each turn:                                        │ │
│  │      - call LLM (streaming)                                │ │
│  │      - parse text + tool_calls                             │ │
│  │      - if write tool → pause + ask confirmation            │ │
│  │      - else execute tools, persist results, continue       │ │
│  │   5. emit done                                             │ │
│  └─┬────────────────────────┬────────────────────────────────┬─┘ │
│    │                        │                                │   │
│  ┌─▼──────────────┐  ┌──────▼────────────┐  ┌───────────────▼─┐ │
│  │ AnthropicChat  │  │  ToolRegistry +   │  │  KbSearchService│ │
│  │ Provider       │  │  27 ToolHandler   │  │  + Embedding +  │ │
│  │ (SSE Anthropic │  │  beans            │  │  Rerank         │ │
│  │ Messages API)  │  │                   │  │  (pgvector)     │ │
│  └────────────────┘  └─┬─────────────────┘  └─────────────────┘ │
│                        │                                         │
│                ┌───────┴───────┬───────────┬──────────────┐    │
│             ┌──▼──┐  ┌─────▼──┐  ┌──▼────┐  ┌─────────▼──┐  │
│             │read │  │write   │  │simul. │  │workflow    │  │
│             │tools│  │tools   │  │tools  │  │tools       │  │
│             │(14) │  │(7+conf)│  │(2)    │  │(2)         │  │
│             └─────┘  └────────┘  └───────┘  └────────────┘  │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Schedulers (Spring @Scheduled)                         │ │
│  │  • BriefingScheduler (cron horaire)                     │ │
│  │  • BriefingRetryScheduler (horaire)                     │ │
│  │  • AssistantMemoryCleanupScheduler (lundi 3h UTC)       │ │
│  │  • VisionUsageAlertScheduler                            │ │
│  │  • ElasticityRecomputeScheduler                         │ │
│  │  • KbIndexTuningScheduler                               │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
       │                       │                    │
   ┌───▼────┐           ┌──────▼──────┐      ┌─────▼─────┐
   │ Postgres│           │ Redis cache │      │ Anthropic │
   │ pgvector│           │ (weather,   │      │ + Voyage  │
   │ +tables │           │ holidays,   │      │ + OpenMeteo│
   │ tenant  │           │ KB hits)    │      │ APIs      │
   │ filter  │           │             │      │           │
   └─────────┘           └─────────────┘      └───────────┘
```

### 2.2 Flow end-to-end d'un message

```
[User tape un message]
  │
  ▼
[1] Frontend POST /api/assistant/chat
    body: { conversationId?, message, attachments[]?, currentPage?, selectedPropertyId? }
    → connexion SSE ouverte
  │
  ▼
[2] AssistantController construit AgentContext :
    - organizationId (depuis TenantContext)
    - keycloakId (depuis JWT)
    - language (FR/EN/AR depuis JWT locale)
    - currentPage, selectedPropertyId (UI context)
  │
  ▼
[3] Thread pool SSE dédié exécute orchestrator.handleMessage()
    (non-blocking, libère le thread Tomcat)
  │
  ▼
[4] AgentOrchestrator :
    a. Crée/résout Conversation
    b. Persiste AssistantMessage(role=user, content, attachments JSON)
    c. Charge historique complet (toutes messages assistant + tool)
    d. Résout API key : BYOK org si présent, sinon plateforme
    e. Construit system prompt enrichi :
       - DEFAULT_SYSTEM_PROMPT (persona + catalogue tools + règles)
       - + Memory : top 30 entries via cosine similarity sur user message
       - + RAG : top 4 chunks KB si relevance > 0.70 (auto-inject)
    f. Lance runToolLoop avec ChatRequest
  │
  ▼
[5] runToolLoop (max 5 itérations) :
    for iter in 0..4:
      a. AnthropicChatProvider.streamChat()
         → POST /v1/messages avec stream:true
         → parse SSE events Anthropic (message_start, content_block_delta...)
         → émet ChatEvent au Consumer
      b. Frontend reçoit text_delta SSE → affiche texte progressif
      c. Si LLM réclame des tools :
         - Vérifier requiresConfirmation flag
         - Si write tool → PendingToolStore.add() + emit tool_confirmation_request
                          → PAUSE, attend POST /tool-confirm
         - Sinon → exécuter immédiatement, persister tool_result
      d. Persist assistant message (texte + tool_calls + tokens)
      e. Pas de tool_calls → emit done → return
  │
  ▼
[6] Si confirmation reçue :
    POST /api/assistant/tool-confirm { toolCallId, confirmed: bool }
    → resumeAfterConfirmation()
       - récupère pending tool depuis store
       - si confirmed : execute le tool
       - sinon : crée tool_result "Action annulée par l'utilisateur"
       - relance runToolLoop avec le résultat
  │
  ▼
[7] Frontend affiche le résultat :
    - text_delta → MessageBubble texte
    - tool_call_executed avec displayHint → routeur vers ToolResultWidget
      (KpiSummaryWidget, DataTableWidget, BarChartWidget, etc.)
    - done → status='idle', input réactivé
```

---

## 3. Modèle de données

### 3.1 Tables principales

| Table | Colonnes clés | Index/Contraintes |
|---|---|---|
| `assistant_conversation` | id, organization_id, keycloak_id, title, model, created_at, updated_at, archived_at | `organizationFilter` Hibernate, idx (keycloak_id, created_at desc) |
| `assistant_message` | id, conversation_id, organization_id, role (`user`/`assistant`/`tool`), content (TEXT), tool_calls (JSONB), attachments (JSONB), tool_call_id, prompt_tokens, completion_tokens, finish_reason, created_at | FK conversation_id, idx (conversation_id, created_at asc), `organizationFilter` |
| `assistant_memory` | id, organization_id, keycloak_id, memory_key, memory_value, scope (`preference`/`fact`/`goal`/`project`), embedding `vector(1024)`, created_at, updated_at, last_accessed_at, expires_at | UNIQUE (keycloak_id, memory_key), idx ivfflat cosine sur embedding, idx partial `WHERE expires_at IS NOT NULL` |
| `assistant_briefing_pref` | id, organization_id, keycloak_id, enabled, frequency (`DAILY_MORNING`/`WEEKLY_SUNDAY`/`ONLY_ALERTS`), time_local, timezone, channels (JSONB: `["in_app","email","whatsapp"]`) | UNIQUE (keycloak_id) |
| `assistant_briefing_log` | id, organization_id, keycloak_id, briefing_date, frequency, conversation_id, channels (JSONB), status (`SENT`/`FAILED`/`SKIPPED`/`RETRYING`), error_message, sent_at | UNIQUE (keycloak_id, briefing_date) → idempotence |
| `assistant_workflow_run` | id, organization_id, keycloak_id, workflow_id, current_step_idx, status (`ACTIVE`/`COMPLETED`/`ABANDONED`), collected_data (JSONB), created_at, completed_at, **@Version** | Optimistic locking |
| `kb_document` | id, organization_id (nullable = global), title, source_path, content_hash, ingested_at | UNIQUE (source_path, organization_id) |
| `kb_chunk` | id, document_id, chunk_index, content, embedding `vector(1024)`, token_count, created_at | idx ivfflat cosine, FK document_id |
| `org_ai_api_key` | id, organization_id, provider (`openai`/`anthropic`/`voyage`), api_key (AES-256 encrypted), model_override, is_valid, last_validated_at | UNIQUE (organization_id, provider) |
| `org_whatsapp_template` | id, organization_id, template_key, body, variables (JSONB) | UNIQUE (organization_id, template_key) |
| `org_vision_alert` | id, organization_id (UNIQUE), monthly_token_threshold, last_alerted_at | Opt-in alerts par org |
| `property_pricing_config` | id, property_id, base_elasticity, recompute_window_days | per-property override |
| `property_elasticity_estimate` | id, property_id, elasticity, sample_size, computed_at, ttl_days | cache empirique recalculé périodiquement |

### 3.2 Multi-tenancy

Toutes les entities ci-dessus déclarent un **`@Filter` Hibernate `organizationFilter`** activé automatiquement par le `TenantFilter` (Spring Security chain). Concrètement :

```java
@Entity
@FilterDef(name = "organizationFilter", parameters = @ParamDef(name = "orgId", type = Long.class))
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class AssistantConversation { ... }
```

→ Toute query JPA inclut automatiquement `WHERE organization_id = :currentOrgId`. **Aucune fuite cross-tenant possible** via les repositories standards.

**Exception** : la query native `AssistantMemoryRepository.searchByCosineSimilarity()` bypasse le filtre Hibernate (native SQL) — donc elle inclut manuellement `WHERE organization_id = :orgId` (fix critique audit 2026-05).

### 3.3 Migrations Liquibase

| ID | Description |
|---|---|
| `0143` | `CREATE EXTENSION vector` (pgvector) |
| `0144` | tables `kb_document` + `kb_chunk` |
| `0145` | colonne `embedding vector(1024)` sur `assistant_memory` |
| `0146` | colonnes `last_accessed_at` + `expires_at` sur `assistant_memory` |
| `0147` | tables `property_pricing_config` + `property_elasticity_estimate` |
| `0148` | table `org_whatsapp_template` |
| `0149` | table `org_vision_alert` |
| `0150` | colonne `version` (optimistic locking) sur `assistant_workflow_run` |

---

## 4. Core Agent : Orchestrator + LLM Provider

### 4.1 `AgentOrchestrator` (cœur)

**Fichier** : `server/src/main/java/com/clenzy/service/agent/AgentOrchestrator.java` (~46 KB)

**Constantes clés** :

```java
MAX_TOOL_ITERATIONS = 5      // safety net contre boucles infinies
MAX_TOKENS_PER_TURN = 4096   // limite réponse LLM
DEFAULT_TEMPERATURE = 0.3    // mode déterministe (moins de créativité)
MAX_MEMORY_ENTRIES = 30      // memory entries injectées dans system prompt
RAG_TOP_K = 4                // chunks KB auto-injectés
RAG_RELEVANCE_MIN = 0.70     // seuil minimum (cosine similarity)
```

**Méthodes publiques** :

| Méthode | Rôle |
|---|---|
| `handleMessage(conversationId, userMessage, attachments, context, sseConsumer)` | Point d'entrée principal. Persiste user msg, lance la boucle tool-calling, stream les events. |
| `resumeAfterConfirmation(toolCallId, confirmed, context, sseConsumer)` | Reprend une boucle interrompue par une demande de confirmation. |
| `loadConversation(conversationId, keycloakId)` | Charge l'historique complet (ownership check inclus). |
| `archiveConversation(conversationId, keycloakId)` | Soft-archive. |

**Boucle interne `runToolLoop()`** (méthode privée principale) :

```java
for (int iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
    LoopOutcome outcome = streamOneTurn(request, conversation, apiKey, consumer);

    if (outcome.isError()) { emit error → return; }

    persist(assistantMessage(text + tool_calls + tokens));

    if (outcome.toolCalls.isEmpty()) {
        emit done(finishReason) → return;
    }

    if (anyToolRequiresConfirmation(outcome.toolCalls)) {
        pendingToolStore.add(toolCallId, futureHistory, args);
        emit tool_confirmation_request → PAUSE (return);
    }

    for (toolCall in outcome.toolCalls) {
        ToolHandler handler = registry.find(toolCall.name());
        ToolResult result = handler.execute(toolCall.args(), context);
        persist(toolMessage(toolCallId, result));
        emit tool_call_executed(displayHint, payload);
        request.appendMessage(toolMessage);
    }
    // continue loop with new request
}
```

**System prompt construction** :

Le `buildSystemPrompt(context, userMessage)` concatène :

1. **Section Memory** (si memory enabled) : `## Memoire utilisateur\n- preference: ...\n- fact: ...\n`
2. **Section RAG** (si user message non-blank et chunks > seuil) : `## Contexte documentation pertinente\n[snippet 1] (source: titre)\n[snippet 2] (source: titre)\n` avec instruction "Cite tes sources via [titre](path) si tu utilises ces snippets"
3. **DEFAULT_SYSTEM_PROMPT** : persona Clenzy, catalogue de tous les tools avec descriptions courtes, règles output (markdown OK, format dates FR DD/MM/YYYY, etc.), carte des routes PMS pour `suggest_navigation`

### 4.2 `AnthropicChatProvider` (LLM driver)

**Fichier** : `server/src/main/java/com/clenzy/config/ai/AnthropicChatProvider.java` (~21 KB)

**Interface implémentée** : `ChatLLMProvider` (peut être swappée pour OpenAI/Mistral à terme).

**Streaming SSE Anthropic** :

```
POST https://api.anthropic.com/v1/messages
Headers:
  x-api-key: ${apiKey}     ← plateforme ou BYOK org
  anthropic-version: 2023-06-01
  content-type: application/json
Body:
  model: claude-sonnet-4-20250514 (ou override)
  max_tokens: 4096
  temperature: 0.3
  stream: true
  system: <enriched prompt>
  messages: [...history]
  tools: [...descriptors JSON]
```

**Parsing du stream SSE** :

| Event Anthropic | Action |
|---|---|
| `message_start` | capture `usage.input_tokens` initial |
| `content_block_start` (type=text) | initialise accumulateur texte |
| `content_block_start` (type=tool_use) | initialise accumulateur tool args |
| `content_block_delta` (text_delta) | accumule + émet `ChatEvent.TextDelta` |
| `content_block_delta` (input_json_delta) | accumule les args tool (string concat) |
| `content_block_stop` | flush du tool_use accumulé → `ChatEvent.ToolCallRequest` |
| `message_delta` | capture `stop_reason` final + `output_tokens` |
| `message_stop` | émet `ChatEvent.Done(text, tokens, model, finishReason)` |

**BYOK (Bring Your Own Key)** :

- Résolu via `OrgAiApiKey` (table org_ai_api_key, encrypted AES-256)
- Si présent pour l'org courante : utilise cette clé + le `modelOverride` éventuel
- Sinon fallback sur `ANTHROPIC_API_KEY` env var (plateforme)
- Si **les deux sont absents** : court-circuit avec message clair "Aucune clé API Anthropic configurée. Renseignez votre clé dans Settings > IA > Connexion ou configurez ANTHROPIC_API_KEY côté plateforme."

**Fail-soft** :

- Erreur réseau → `ChatEvent.Error` propagé au frontend via SSE (pas de retry auto)
- Status 410 Anthropic (modèle EOL) → `ChatEvent.ModelDeprecated` spécifique pour UI claire
- 4xx/5xx → message d'erreur côté frontend, conversation préservée

---

## 5. Tool framework

### 5.1 Interface `ToolHandler`

```java
public interface ToolHandler {
    String name();                          // ex: "list_reservations"
    ToolDescriptor descriptor();            // JSON schema + requiresConfirmation
    ToolResult execute(JsonNode args, AgentContext context);
}
```

**Règle d'or** : un tool **ne touche JAMAIS** la BDD directement. Il délègue à un **Service Spring** existant qui porte les filtres tenant, l'autorisation et la logique métier.

### 5.2 `ToolRegistry`

Spring DI auto-discovery : tous les beans `@Component implements ToolHandler` sont collectés à l'init. Le registry valide :
- Unicité des `name()` (échec boot si conflit)
- Cohérence entre `name()` et `descriptor().name()`

→ Pour ajouter un tool : créer un nouveau `@Component` dans `service/agent/tools/`, c'est tout.

### 5.3 `ToolResult` (record)

```java
record ToolResult(String content, String displayHint, boolean isError) {
    static ToolResult success(String json, String hint) { ... }
    static ToolResult error(String msg) { ... }
}
```

**`displayHint`** : "list", "table", "summary", "knowledge", "simulation", "workflow", "weather", "events", "portfolio", "insights", "navigation" → routé côté frontend vers le bon widget.

### 5.4 Flow exécution tool

1. LLM émet `tool_call: { name: "list_properties", args: {...} }`
2. Orchestrateur résout `ToolHandler handler = registry.find("list_properties")`
3. Si `handler.descriptor().requiresConfirmation() == true` → PAUSE + ask user
4. Sinon : `ToolResult result = handler.execute(args, context)`
5. Persiste `AssistantMessage(role=tool, content=result.content(), tool_call_id=...)`
6. Émet `tool_call_executed(displayHint, result.content)` en SSE
7. Append au context LLM pour le prochain tour

---

## 6. Inventaire des 27 tools

### 6.1 Read tools (14 — sans confirmation)

| Tool | Inputs | Output | Cas d'usage |
|---|---|---|---|
| `list_properties` | city?, status?, type?, limit≤50 | liste de propriétés | "Mes propriétés à Paris" |
| `list_reservations` | propertyId?, status?, dateRange?, limit | réservations paginées | "Réservations en juillet" |
| `list_cleaning_tasks` | propertyId?, status?, from?, limit | tâches ménage | "Ménages à faire demain" |
| `get_dashboard_summary` | — | KPIs portfolio | "Comment vont mes biens ?" |
| `get_financial_summary` | propertyId?, months | revenue/expense/profit bar chart | "Bilan financier 6 mois" |
| `get_properties_performance` | limit, metric (revenue/ratings) | top N (bar chart) | "Top 5 par revenu" |
| `get_business_insights` | propertyId | anomalies + recos | "Insights pour Appt Bastille" |
| `get_reservation_trend` | propertyId, months | line chart évolution | "Tendance résa 12 mois" |
| `get_occupancy_forecast` | propertyId, days≤90 | % occupation prévisionnel | "Occupation aoùt prochain" |
| `get_interventions_by_status` | propertyId?, daysBack | pie chart statuts | "Interventions en cours" |
| `get_weather_forecast` | city OR propertyId, days≤7 | météo (cache Redis 3h) | "Météo Bordeaux week-end" |
| `get_local_events` | city, from, to | jours fériés + festivals + sport | "Événements Cannes juillet" |
| `analyze_portfolio` | daysBack | KPIs cross-property + patterns | "Analyse mon portefeuille" |
| `search_knowledge_base` | query, topK≤10 | top K chunks doc Clenzy | "Comment configurer iCal ?" |

### 6.2 Write tools (7 — avec confirmation)

| Tool | Inputs requis | Validation | Side-effect |
|---|---|---|---|
| `create_intervention` | propertyId, title, type, scheduledDate | type ∈ enum, date valide, propertyId ∈ org | INSERT Intervention + notification staff |
| `assign_intervention` | interventionId, assignedToUserId | user actif, intervention ∈ org | UPDATE assignation + notif assignee |
| `cancel_reservation` | reservationId, cancellationReason | résa non déjà annulée, ownership | Soft-delete + logique refund Stripe |
| `update_property_status` | propertyId, newStatus | newStatus ∈ {ACTIVE, INACTIVE, ARCHIVED}, ownership | Toggle online/offline channels OTA |
| `send_guest_message` | reservationId, templateId, variables | template existe, variables cohérentes | Envoi SMS/Email/WhatsApp (Twilio/Brevo) |
| `block_calendar_day` | propertyId, from, to | dates valides, pas de conflit booking | INSERT CalendarDay BLOCKED + sync OTA |
| `forget_fact` | key | key existe en mémoire user | DELETE AssistantMemory (irréversible) |

### 6.3 Simulation tools (2 — sans confirmation)

| Tool | Inputs | Calcul | Output |
|---|---|---|---|
| `simulate_pricing_change` | propertyId, pctChange ∈ [-50, +50], from?, to? | ADR × (1+pct), occ × (1-elasticity×pct), revenue projeté | baseline vs scenario + recommendation |
| `simulate_calendar_block` | propertyId, from, to | revenue historique même période N-1 | revenue perdu estimé + break-even occ |

### 6.4 Workflow tools (2)

| Tool | Inputs | Output |
|---|---|---|
| `start_workflow` | workflow_id (onboard_property, end_of_month_closing, prepare_high_season) | Step #1 (prompt + champs attendus) |
| `advance_workflow` | run_id, user_response (JSON) | Step #N+1 ou COMPLETED |

### 6.5 Memory + Navigation (2)

| Tool | Inputs | Output |
|---|---|---|
| `remember_fact` | key, value, scope (preference/fact/goal/project) | confirmation + embedding stocké |
| `suggest_navigation` | route, label | bouton cliquable vers /route dans le chat |

---

## 7. Knowledge Base RAG (pgvector)

### 7.1 Pourquoi RAG

Les LLM ont une date de cutoff et ne connaissent pas la doc Clenzy spécifique. Le **RAG (Retrieval-Augmented Generation)** :

1. Convertit chaque morceau de doc en vecteur 1024d (embedding sémantique)
2. À chaque message user, cherche les morceaux les plus similaires (cosine similarity)
3. Injecte les morceaux pertinents dans le system prompt
4. Le LLM peut citer la doc avec **anti-hallucination strict** (instruction "cite [titre](path)")

### 7.2 Architecture

```
[Doc Markdown .md]
      │
      ▼
[IngestionService]
      │
      ├─ extract title (1er # H1)
      ├─ split par ## H2 (sections)
      ├─ re-chunk si > 2000 chars (~500 tokens)
      ├─ embed batch (EmbeddingProvider)
      └─ persist KbDocument + KbChunk[]

[User message]
      │
      ▼
[KbSearchService]
      │
      ├─ embedService.embedAsVectorString(query)
      ├─ pgvector cosine search (over-fetch topK × 4)
      ├─ RerankService.rerank (optionnel, cross-encoder Voyage)
      ├─ filter relevance ≥ 0.70
      └─ return top-K KbSearchHit
              │
              ▼
[AgentOrchestrator.buildSystemPrompt]
      └─ inject section "## Contexte documentation pertinente" si chunks > 0
```

### 7.3 Providers swappables

Config : `clenzy.ai.embeddings.provider=voyage|openai`

| Provider | Modèle | Dim | Batch | Coût |
|---|---|---|---|---|
| `VoyageEmbeddingProvider` | `voyage-3-large` | 1024 | 128 | ~$0.18/1M tokens |
| `OpenAIEmbeddingProvider` | `text-embedding-3-large` | 1024 (param) | 2048 | ~$0.13/1M tokens |

Pour le re-ranking :

| Provider | Modèle | Note |
|---|---|---|
| `VoyageRerankProvider` | `rerank-2` cross-encoder | Améliore précision top-K |
| `NoOpRerankProvider` | identity | Fallback si rerank désactivé ou erreur |

### 7.4 Auto-injection vs tool explicit

| Mode | Quand | Visibilité au LLM |
|---|---|---|
| **Auto-injection** | À chaque message user | Invisible — chunks dans system prompt |
| **Tool `search_knowledge_base`** | LLM décide quand | Visible — résultat structuré, le LLM contrôle topK |

**Anti-hallucination** : Le system prompt contient "Cite tes sources via [titre](path) si tu utilises ces snippets — n'invente jamais une procédure non documentée".

### 7.5 Ingestion admin

POST multipart `/api/admin/kb/ingest` accepte un fichier `.md`. Si même `source_path` existe → **réingestion idempotente** (supprime anciens chunks, recrée). Estimation coût : doc 5 KB ≈ 2 chunks ≈ 1 000 tokens ≈ **$0.00002**.

Scheduler `KbIndexTuningScheduler` recalcule le param ivfflat `lists` selon le nombre total de chunks (sqrt(N) approximation).

---

## 8. Memory long-terme

### 8.1 Modèle 4 scopes

| Scope | Exemples | Usage typique |
|---|---|---|
| `preference` | "langue préférée: français", "couleur de ton préférée: bleu" | Adapter le ton de réponse |
| `fact` | "Appartement Bastille a 2 chambres", "Le client est allergique aux fumeurs" | Contextualiser sans relire historique |
| `goal` | "Atteindre 80% d'occupation en juillet" | Suivi d'objectifs métier |
| `project` | "Refonte calendrier Q3 en cours" | Continuité multi-conversations |

### 8.2 Sélection par pertinence (embedding)

À chaque message user :

```java
List<AssistantMemory> relevant = memoryService.listMostRelevant(
    orgId, keycloakId, userMessage, limit=30
);
```

**Cascade** :
1. Si `EmbeddingService` disponible + message non-blank → embed query → query native pgvector cosine sur les memories de l'user → top 30
2. Sinon (provider down ou message vide) → fallback `listForUser` triées par `last_accessed_at desc`

**Effet de bord** : `last_accessed_at` est bumped en batch sur les memories retournées (purge naturelle des memories mortes).

### 8.3 Cleanup automatique

`AssistantMemoryCleanupScheduler` (lundi 3h UTC) :

```sql
DELETE FROM assistant_memory
WHERE last_accessed_at < NOW() - INTERVAL '6 months'
   OR (expires_at IS NOT NULL AND expires_at < NOW());
```

→ Pas de croissance infinie. L'utilisateur peut aussi forcer un oubli via `forget_fact`.

### 8.4 Multi-tenant safety

La query native (qui bypasse Hibernate Filter) inclut **explicitement** `WHERE organization_id = :orgId` → pas de fuite cross-org possible (fix critique audit 2026-05).

---

## 9. Simulations pricing & calendrier

### 9.1 `SimulatePricingChangeTool`

**Question type** : "Que se passe-t-il si je baisse le prix de 10% en juillet ?"

**Algorithme** :

```
ADR_baseline       = revenue / nuits_occupées
ADR_scenario       = ADR_baseline × (1 + pctChange)
Occupancy_baseline = nuits_occupées / jours_période
Occupancy_scenario = Occupancy_baseline × (1 - elasticity × pctChange)
Revenue_baseline   = ADR_baseline × Occupancy_baseline × jours
Revenue_scenario   = ADR_scenario × Occupancy_scenario × jours
Δ Revenue          = Revenue_scenario - Revenue_baseline
Recommendation     = "✓ Hausse de prix recommandée" si Δ > 0 sinon "⚠ Baisse réduit le revenu"
```

**Resolution de l'élasticité** :

1. Lookup `PropertyElasticityEstimate.elasticity` (cache empirique)
2. Fallback : `0.5` (valeur industrie moyenne)

### 9.2 `EmpiricalElasticityEstimator`

Calcule **empiriquement** l'élasticité prix-demande d'une propriété sur les 12 derniers mois.

**Méthode** :

1. Fetch CONFIRMED reservations [today−12mo, today]
2. Bucket par `YearMonth` (pro-rata nuits si stay multi-mois)
3. Calc mensuel : `ADR = revenue/nuits`, `occupancy = nuits/jours_mois`
4. Build paires (mois T, mois T+1) :
   ```
   deltaAdr% = (ADR_{T+1} - ADR_T) / ADR_T
   deltaOcc% = (Occ_{T+1} - Occ_T) / Occ_T
   ```
5. Filtre pairs : `|deltaAdr%| ≥ 2%` (seuil minimum de changement)
6. Si ≥ 3 paires significatives :
   ```
   elasticity = mean(-deltaOcc% / deltaAdr%)
   clamped ∈ [0.1, 1.5]
   ```
7. Sinon : `Optional.empty()` → orchestrator utilise fallback 0.5

**Optimisations** :
- Bucket O(N×M) pas O(N×jours) → 100× plus rapide sur historiques chargés
- Guards : `if (prevAdr <= 0) continue;`, `if (deltaAdr == 0) continue;` (anti div/0)

**Limites assumées** :
- Pas de contrôle saisonnalité (un pic juillet pourrait être attribué à un changement de prix)
- Moyenne arithmétique, pas régression linéaire (acceptable sur 11 paires max)
- Pas de détection d'outliers

**Recompute** : `ElasticityRecomputeScheduler` rafraîchit les estimates obsolètes (> 30 jours) en arrière-plan.

### 9.3 `SimulateCalendarBlockTool`

**Question** : "Combien je perds si je bloque [from, to] ?"

**Calcul** : revenue historique sur la même période l'année précédente (fallback : `N jours × ADR moyen`). Output : revenue perdu + occupation supplémentaire nécessaire pour break-even.

---

## 10. Workflows procéduraux

### 10.1 Définition YAML

Les workflows sont déclaratifs, stockés dans `server/src/main/resources/workflows/*.yaml`.

Exemple `onboard_property.yaml` :

```yaml
id: onboard_property
name: "Onboarding nouvelle propriété"
steps:
  - id: type_property
    prompts:
      fr: "Quel type de bien (Appartement, Maison, Studio) ?"
      en: "What type of property?"
      ar: "ما نوع العقار؟"
    expects_data:
      type: string
      enum: [APARTMENT, HOUSE, STUDIO]
  - id: address
    prompts:
      fr: "Adresse complète ?"
    expects_data:
      type: string
      minLength: 10
  - id: confirm
    prompts:
      fr: "Confirmer la création de {{summary}} ?"
    action: create_property  # tool à invoquer après collection
```

### 10.2 `WorkflowEngine` (sans état)

Opère sur `AssistantWorkflowRun` (state) :

| Méthode | Rôle |
|---|---|
| `collectData(run, def, userResponse)` | Valide la réponse contre `expects_data` (JSON schema), merge dans `collected_data` |
| `advanceStep(run, def)` | Incrémente `current_step_idx` ou marque `COMPLETED` |
| `renderPrompt(step, run, language)` | Interpole les variables `{{summary}}`, `{{collectedData.x}}` dans la traduction adéquate |
| `executeStepAction(step, run, language)` | Si `action` déclarée, retourne suggestion structurée pour le LLM (tool + args pré-remplis) |

### 10.3 Concurrence (optimistic locking)

L'entity `AssistantWorkflowRun` porte un `@Version` (colonne `version` ajoutée en migration 0150). Si deux requêtes tentent d'avancer le même run simultanément (ex: user ouvre 2 onglets), seule l'une réussit, l'autre reçoit `OptimisticLockException` → l'agent peut re-prompter "réessayez".

### 10.4 Validation stricte

`WorkflowValidator` valide la réponse user contre le JSON schema de `expects_data` :
- Type mismatch → `WorkflowValidationException` → le LLM re-prompt avec le message d'erreur formaté
- Pas de "garbage in" silencieux

### 10.5 Multilingue (FR/EN/AR)

Le `language` du `AgentContext` (extrait du JWT locale ou du fallback `fr`) sélectionne la traduction du prompt. Cascade : `language → fr → first available`.

---

## 11. Briefings proactifs

### 11.1 Concept métier

Recevoir chaque matin un **résumé personnalisé** des KPIs et alertes du portfolio, sans avoir à ouvrir le PMS. 3 canaux possibles, configurables par l'utilisateur.

### 11.2 Configuration user

L'utilisateur règle ses préférences dans **Settings > IA > Briefings** :

| Champ | Options |
|---|---|
| Activé | on/off |
| Fréquence | `DAILY_MORNING` / `WEEKLY_SUNDAY` / `ONLY_ALERTS` |
| Heure locale | `HH:mm` (ex: 08:00) |
| Timezone | `Europe/Paris` (auto-détecté) |
| Canaux | `["in_app", "email", "whatsapp"]` (multi-select) |

### 11.3 Flow technique

```
[BriefingScheduler] (cron horaire @Scheduled("0 0 * * * *"))
    │
    ├─ list_all_enabled() → PrefsEnabled[]
    ├─ for each pref:
    │    ├─ localTime = now() in pref.timezone
    │    ├─ if localTime.HH != pref.timeLocal.HH → skip
    │    ├─ if today == DAILY_MORNING OR (WEEKLY_SUNDAY && isSunday)
    │    │    │
    │    │    ├─ INSERT briefing_log (UNIQUE keycloak_id + date) → idempotence
    │    │    │   (DataIntegrityViolation → already done → skip)
    │    │    │
    │    │    ├─ BriefingComposer.compose() :
    │    │    │    ├─ AgentOrchestrator.handleMessage(systemPrompt briefing)
    │    │    │    │   → utilise Claude Haiku 4.5 (plus rapide pour briefing)
    │    │    │    │   → tools restreints (read-only)
    │    │    │    │   → output: texte assistant + conversationId
    │    │    │    └─ rename conversation TZ-aware (ex: "Briefing 28 mai 2026")
    │    │    │
    │    │    ├─ BriefingDelivery.dispatch() :
    │    │    │    ├─ in_app  → NotificationService.notify(user, link to conv)
    │    │    │    ├─ email   → EmailTemplateLoader.load(briefing.html) + send via Brevo
    │    │    │    └─ whatsapp→ Twilio API + template per-org (org_whatsapp_template)
    │    │    │   (isolation : un canal qui plante n'empêche pas les autres)
    │    │    │
    │    │    └─ UPDATE log (status SENT, channels_delivered, conversation_id)

[BriefingRetryScheduler] (cron horaire)
    │
    ├─ findFailedSince(now - 24h) WHERE status = FAILED
    ├─ for each log:
    │    ├─ CAS atomique : tryAcquireRetry(log_id, current_status=FAILED → new_status=RETRYING)
    │    │   (évite double-retry si 2 instances scheduler tournent en HA)
    │    ├─ if acquired: replay delivery for missing channels only
    │    └─ update status (SENT ou FAILED après N tentatives)
```

### 11.4 Anti-hallucination strict

Le system prompt briefing utilise **Claude Haiku 4.5** (plus rapide, moins cher) avec instruction "donne uniquement les faits issus des tools, ne projette rien sans données".

---

## 12. Vision (images)

### 12.1 Cas d'usage métier

- Upload photo de **dégradation** dans un logement → l'assistant crée automatiquement une intervention maintenance avec description
- Upload **facture fournisseur** → extraction des montants, fournisseur, date
- Upload **plan d'aménagement** → suggestions de mobilier

### 12.2 Limites Anthropic

- **5 MB max** par image
- Formats : `image/jpeg`, `image/png`, `image/gif`, `image/webp`
- Modèle requis : **Claude 3.5 Sonnet+** (le défaut projet `claude-sonnet-4-20250514` est compatible)
- Max **3 images** par message (limite UX frontend `ChatInput.tsx`)

### 12.3 Flow upload

```
[User drop image dans ChatInput]
    │
    ├─ useImageUpload hook : compression Canvas si > 2 MB
    │   (resize max 1600px, JPEG q=0.85 — pas de dépendance npm)
    ├─ POST /api/assistant/upload (multipart)
    ├─ Backend : PhotoStorageService.store(bytes) → storageKey
    └─ Response : AttachmentRef { storageKey, mediaType, url, name }

[User envoie message]
    │
    ├─ Frontend inclut attachments[] dans le body POST /chat
    ├─ Backend : pour chaque ref, PhotoStorageService.retrieve(key) → bytes
    └─ Inject dans content blocks Anthropic :
        { type: "image", source: { type: "base64", media_type, data: <b64> } }
```

### 12.4 Tracking & alertes

`VisionTokenUsageService` agrège les `prompt_tokens` des messages avec `attachments IS NOT NULL` sur 30 jours glissants par org.

`VisionUsageAlertScheduler` :
- Pour chaque org avec `org_vision_alert.monthly_token_threshold` défini
- Compare l'usage 30j vs seuil
- Si dépassement → notification admin + cool-down sur `last_alerted_at` (pas de spam, CAS atomique)

Endpoint admin `GET /api/admin/vision/usage/{orgId}` retourne `{ usage, window_days, computed_at }`.

### 12.5 Sécurité ownership

`GET /api/assistant/attachments/{storageKey}` valide via **query native** que le `storageKey` appartient bien à une conversation du user courant (chain `storageKey → message.attachments → conversation.keycloak_id`). 404 silencieux si mismatch (évite l'énumération).

---

## 13. Frontend chat

### 13.1 Arborescence

```
client/src/modules/assistant/
├── AssistantPage.tsx          (page racine, layout 3 zones)
├── components/
│   ├── MessageList.tsx        (virtualized scroll)
│   ├── MessageBubble.tsx      (user droite / assistant gauche)
│   ├── ChatInput.tsx          (textarea + voice + upload)
│   ├── ToolCallCard.tsx       (recap tool invoqué)
│   ├── ToolConfirmationDialog.tsx (write tools)
│   └── ConversationListSidebar.tsx
└── widgets/
    ├── ToolResultWidget.tsx       (routeur par displayHint)
    ├── KpiSummaryWidget.tsx       ("summary")
    ├── DataTableWidget.tsx        ("list", "table")
    ├── BarChartWidget.tsx         ("chart-bar")
    ├── LineChartWidget.tsx        ("chart-line")
    ├── PieChartWidget.tsx         ("chart-pie")
    ├── InsightsWidget.tsx         ("insights")
    ├── NavigationCardWidget.tsx   ("navigation")
    ├── PortfolioOverviewWidget.tsx ("portfolio")
    ├── WeatherWidget.tsx          ("weather")
    ├── EventsWidget.tsx           ("events")
    ├── SimulationWidget.tsx       ("simulation")
    ├── WorkflowWidget.tsx         ("workflow")
    └── KnowledgeWidget.tsx        ("knowledge")
```

### 13.2 SSE consumption

Hook `useAgent.ts` :

```typescript
async function sendMessage(text, attachments) {
  setStatus('streaming');
  const response = await fetch('/api/assistant/chat', {
    method: 'POST',
    headers: { Accept: 'text/event-stream' },
    body: JSON.stringify({ conversationId, message: text, attachments })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value);
    // parse "data: {...}\n\n" lines
    const events = parseSseBuffer(buffer);
    for (const event of events) {
      switch (event.type) {
        case 'conversation_created': setConversationId(event.id); break;
        case 'text_delta':           appendToDraft(event.text); break;
        case 'tool_call_executed':   addToolResult(event); break;
        case 'tool_confirmation_request': setPendingConfirmation(event); break;
        case 'done':                 setStatus('idle'); break;
        case 'error':                setStatus('error'); setError(event.message); break;
      }
    }
  }
}
```

### 13.3 Widgets : exemple `SimulationWidget`

Reçoit le payload JSON du tool `simulate_pricing_change` :

```json
{
  "baseline": { "adr": 120, "occupancyRate": 0.72, "bookedNights": 22, "revenue": 2640 },
  "scenario": { "adr": 108, "occupancyRate": 0.79, "bookedNights": 24, "revenue": 2592 },
  "elasticity": 0.65,
  "elasticitySource": "empirical",
  "deltaRevenue": -48,
  "deltaOccupancy": 0.07,
  "pctRevenueChange": -1.8,
  "recommendation": "Baisse à éviter : 7% d'occupation en plus ne compense pas les 10% de prix perdus"
}
```

Affichage : carte comparative côte à côte (baseline vs scenario), badge delta coloré (rouge si négatif), texte recommendation en gras.

---

## 14. Sécurité & multi-tenant

### 14.1 Récap des couches

| Couche | Mécanisme |
|---|---|
| **Authentification** | Keycloak JWT (cookie HttpOnly `clenzy_auth`) |
| **Autorisation controller** | `@PreAuthorize("isAuthenticated()")` sur `AssistantController` |
| **Autorisation tools** | Tools délèguent aux Services Spring qui portent les checks rôles + ownership |
| **Multi-tenant** | `TenantFilter` extrait `organizationId` du JWT → `TenantContext` (ThreadLocal) → Hibernate `organizationFilter` activé |
| **Confirmation write tools** | `requiresConfirmation=true` force un POST /tool-confirm explicite user |
| **Audit** | `AuditLogService` trace toutes les actions write tools |
| **API keys** | Plateforme : env var. BYOK : AES-256 encrypted in `org_ai_api_key`. Jamais loggées en clair. |

### 14.2 Native queries (point de vigilance)

Les query natives **bypassent** le filtre Hibernate. La règle stricte : **toute query native sur une table tenant-scoped DOIT inclure manuellement** `WHERE organization_id = :orgId` en paramètre.

→ Vérifié pour `AssistantMemoryRepository.searchByCosineSimilarity()` (fix critique audit).

### 14.3 Ownership des attachments

`GET /api/assistant/attachments/{key}` valide en SQL natif :

```sql
SELECT 1
FROM assistant_message m
JOIN assistant_conversation c ON m.conversation_id = c.id
WHERE m.attachments @> ?::jsonb
  AND c.keycloak_id = ?
  AND c.organization_id = ?
LIMIT 1;
```

→ 404 (pas 403) si mismatch pour éviter l'énumération de storage keys.

---

## 15. Configuration & déploiement

### 15.1 Variables d'environnement (plateforme)

```bash
# LLM
ANTHROPIC_API_KEY=sk-ant-...                    # défaut plateforme (fallback BYOK)

# Embeddings (un seul fournisseur actif)
clenzy.ai.embeddings.provider=voyage            # ou openai
clenzy.ai.embeddings.voyage.api-key=pa-...
clenzy.ai.embeddings.openai.api-key=sk-...
clenzy.ai.embeddings.relevance-threshold=0.70   # auto-injection RAG

# Re-ranking
clenzy.ai.rerank.enabled=true
clenzy.ai.rerank.provider=voyage                # ou noop
clenzy.ai.rerank.voyage.api-key=pa-...

# Memory
clenzy.assistant.memory.relevance-enabled=true
clenzy.assistant.memory.cleanup-enabled=true

# Briefings
clenzy.assistant.briefing.retry-enabled=true
clenzy.assistant.briefing.model=claude-haiku-4-5 # plus rapide pour briefings

# Vision
clenzy.assistant.vision.enabled=true
```

### 15.2 BYOK config (par organisation)

UI : **Settings > IA > Connexion**. L'admin org peut :
- Saisir sa propre clé Anthropic (testée à la save via `/v1/messages` ping)
- Override le modèle utilisé (ex: `claude-opus-4-20250514` pour plus de qualité)
- Désactiver le BYOK → fallback plateforme

Stockage : `OrgAiApiKey.apiKey` chiffré AES-256 (`EncryptedFieldConverter`).

### 15.3 Docker (dev)

L'image PostgreSQL **doit être `pgvector/pgvector:pg15`** (pas `postgres:15` standard) — sinon la migration 0143 (CREATE EXTENSION vector) échoue au boot.

Voir `clenzy-infra/docker-compose.dev.yml`.

### 15.4 Schedulers actifs

| Scheduler | Cron | Rôle |
|---|---|---|
| `BriefingScheduler` | `0 0 * * * *` (horaire) | Émet les briefings selon prefs user |
| `BriefingRetryScheduler` | `0 30 * * * *` (horaire +30min) | Retry des briefings FAILED (CAS atomique) |
| `AssistantMemoryCleanupScheduler` | `0 0 3 * * 1` (lundi 3h UTC) | Purge memories stales > 6 mois ou expirées |
| `VisionUsageAlertScheduler` | `0 0 9 * * 1` (lundi 9h) | Alerte si org dépasse son quota vision |
| `ElasticityRecomputeScheduler` | `0 0 4 * * 0` (dimanche 4h) | Recalcule élasticité empirique > 30 jours |
| `KbIndexTuningScheduler` | `0 0 2 1 * *` (1er du mois) | Recalcule param ivfflat `lists` selon volume |

---

## 16. Limites connues & TODOs

### 16.1 Implémenté mais perfectible

1. **Token budget non-enforcé** : `AiProperties.TokenBudget.enforced=true` configurable mais pas de logique de blocage dans `AgentOrchestrator` (passive monitoring uniquement).
2. **PendingToolStore in-memory** : les tools en attente de confirmation expirent à la fin de la session (pas de persistance BDD). Si user ferme l'onglet pendant la confirmation, le tool est perdu.
3. **Élasticité empirique sans contrôle saisonnalité** : moyenne arithmétique des paires (T, T+1), peut être biaisée par un mois exceptionnel. À terme, régression linéaire multi-variée recommandée.
4. **Pas de retry exponential backoff Anthropic** : erreur réseau → propagée au frontend qui peut re-envoyer. Le SDK HTTP a un retry basique mais pas configuré.
5. **Workflows en mémoire** : les définitions YAML sont chargées au boot (`@PostConstruct`), pas de hot-reload sans restart.

### 16.2 Roadmap potentielle

- **Architecture multi-agents** : orchestrator + spécialistes ≤10 tools chacun (décharger la limite cognitive du LLM au-delà de ~10 tools)
- **Multi-tour confirmation** : "tu confirmes ces 5 interventions ?" au lieu d'une à la fois
- **Memory hierarchique** : org-shared memory (preferences team) en plus de user-scoped
- **Tool sandboxing** : limites par user (rate limit, max writes/jour)
- **A/B testing prompts** : framework pour comparer 2 system prompts en prod

### 16.3 Points de vigilance opérationnels

- **Coût LLM** : Sonnet 4 ≈ $3/1M input, $15/1M output. Un briefing Haiku 4.5 ≈ $0.001 par user/jour (~$30/mois pour 1000 users).
- **Coût embeddings** : ingestion doc 5 KB ≈ $0.00002. Auto-RAG par message ≈ $0.000002. Négligeable.
- **Latence p99** : streaming SSE Anthropic ≈ 500ms first token, ~2s pour réponse complète sans tools. Avec 2 tool calls : 4-6s.
- **Quota Anthropic** : tier 4 par défaut (4000 RPM, 400k TPM). Suffisant pour ~100 users actifs simultanés.

---

## Glossaire

| Terme | Définition |
|---|---|
| **Agent** | LLM augmenté avec tools (function calling) capable d'exécuter des actions |
| **BYOK** | Bring Your Own Key — chaque org peut utiliser sa propre clé API |
| **CAS** | Compare-And-Swap — opération atomique pour éviter les races (UPDATE conditionnel) |
| **Cosine similarity** | Mesure d'angle entre 2 vecteurs (1 = identique, 0 = orthogonal). Utilisée pour la similarité sémantique d'embeddings. |
| **Embedding** | Vecteur dense (1024d ici) représentant le sens sémantique d'un texte |
| **Function calling** | Capacité du LLM à demander l'exécution d'une fonction externe avec args structurés |
| **HA** | High Availability — tolérance à 2+ instances tournant simultanément |
| **MCP** | Model Context Protocol (Anthropic standard pour tools) — non utilisé ici, on a notre propre framework |
| **PMS** | Property Management System (Clenzy) |
| **RAG** | Retrieval-Augmented Generation — injection de contexte pertinent dans le prompt |
| **SSE** | Server-Sent Events — streaming HTTP unidirectionnel server → client |
| **Tool** | Fonction exposée au LLM avec JSON schema d'arguments |
| **Tenant** | Organisation client du SaaS (cloisonnement strict des données) |

---

**Fin du document** — pour questions ou évolutions, contacter l'équipe Clenzy.
