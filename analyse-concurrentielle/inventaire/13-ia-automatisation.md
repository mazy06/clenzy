# Inventaire interne — Domaine 13 : IA & automatisation

> **Source de vérité :** code `server/src/main/java/com/clenzy/` (packages `service/agent/`, `config/ai/`, `config/AiProperties.java`).
> **Méthode :** lecture de fichiers + relecture de l'inventaire fourni (statut + preuve fichier). Date : 2026-06-13.
> **Score domaine (nous) :** **2 / 3** (socle conversationnel/RAG solide, mais peu tissé aux opérations métier ; pas de détection d'anomalies ; agentique d'action présente mais derrière flags / confirmations).

---

## 1. Vue d'ensemble

Clenzy possède une **brique IA conversationnelle propriétaire et techniquement avancée** : un assistant agent `AgentOrchestrator` **multi-provider** (Anthropic / OpenAI / Bedrock), un **RAG pgvector à 2 étages** (embeddings + reranking), une **mémoire long terme**, **27 tools** d'action exposés à l'agent, et un **moteur d'automatisations** (`WorkflowEngine`) ainsi qu'une **architecture multi-agent** (orchestrateur + spécialistes) déjà codée.

La nuance décisive pour le benchmark : presque tout ce qui relève de **l'IA d'action autonome** (multi-agent, IA pricing, IA messagerie/autopilot) est **derrière feature flag OFF en production**, et la chaîne IA n'est **pas tissée dans les workflows métier exposés au client** (pricing, inbox guest, opérations). Clenzy est donc fort en **IA conversationnelle interne** (copilote gestionnaire) mais ne livre pas l'**IA agentique productisée orientée guest/revenu** que les leaders 2025-2026 (Guesty, Hostaway, Jurny) mettent en avant. **Détection d'anomalies métier = absente.**

---

## 2. Assistant conversationnel multi-provider

| Élément | Statut | Preuve |
|---|---|---|
| Orchestrateur d'assistant | ✅ Implémenté | `service/agent/AgentOrchestrator.java` |
| Routeur LLM multi-provider | ✅ Implémenté | `config/ai/ChatLLMRouter.java` (`@Primary`), `ChatLLMProvider.java` |
| Provider Anthropic | ✅ | `config/ai/AnthropicChatProvider.java` (défaut `claude-sonnet-4-20250514`) |
| Provider OpenAI-compatible | ✅ | `config/ai/OpenAiChatProvider.java` (OpenAI / NVIDIA / Bedrock générique) |
| Provider Bedrock par défaut | ✅ | `AiProperties.Bedrock` (`amazon.nova-lite-v1:0`, activé par défaut) |
| Streaming (SSE) | ✅ | `service/agent/AgentToolLoopRunner.java`, `AgentSseEvent.java` |
| Budget de tokens par org | ✅ | `AiProperties.TokenBudget` (100k tokens/mois/org, `enforced=true`) |
| Composition de prompt structurée | ✅ | `service/agent/AgentPromptComposer.java`, package `prompt/sections/` |

**Constat.** L'assistant est un **copilote interne** (côté gestionnaire / staff), pas un agent guest-facing. Multi-provider mature, budgeté, streamé. C'est le point fort « infrastructure IA ».

---

## 3. RAG pgvector 2-étages (knowledge base)

| Élément | Statut | Preuve |
|---|---|---|
| Recherche knowledge base | ✅ Implémenté | `service/agent/kb/KbSearchService.java` |
| Embeddings (provider configurable) | ✅ | `EmbeddingService.java`, `VoyageEmbeddingProvider.java`, `OpenAIEmbeddingProvider.java` |
| **Reranking (2e étage)** | ✅ | `RerankService.java`, `VoyageRerankProvider.java`, `NoOpRerankProvider.java` (repli) |
| Ingestion de documents | ✅ | `IngestionService.java` (.md, découpage par `##`, re-chunk ~500 tokens, idempotent) |
| Stockage vectoriel | ✅ | tables `kb_document` + `kb_chunk` (`vector(1024)`, index ivfflat cosine, migration 0143) |
| Auto-injection RAG | ✅ | recherche kb sur le dernier message user, injection chunks > seuil (`relevance-threshold` 0.70) |
| Tool dédié | ✅ | `service/agent/tools/SearchKnowledgeBaseTool.java` |

**Constat.** RAG **réel à 2 étages** (embeddings + rerank), org-scopé, avec ingestion idempotente. Techniquement au-dessus de la moyenne du marché. **Mais branché à l'assistant interne uniquement** — pas à l'inbox guest (cf. domaine 6, où Hostaway/Hospitable ont un Knowledge Hub alimentant les réponses guest).

---

## 4. 27 tools d'action (agentique)

Inventaire des tools exposés à l'agent (`service/agent/tools/`, **27 fichiers** confirmés) :

| Catégorie | Tools |
|---|---|
| **Lecture / analytics** | `GetDashboardSummaryTool`, `GetBusinessInsightsTool`, `GetFinancialSummaryTool`, `GetPropertiesPerformanceTool`, `GetReservationTrendTool`, `GetOccupancyForecastTool`, `AnalyzePortfolioTool` |
| **Réservations / calendrier** | `ListReservationsTool`, `CancelReservationTool`, `BlockCalendarDayTool`, `SimulateCalendarBlockTool` |
| **Propriétés / portfolio** | `ListPropertiesTool`, `UpdatePropertyStatusTool` |
| **Opérations terrain** | `CreateInterventionTool`, `AssignInterventionTool`, `GetInterventionsByStatusTool`, `ListCleaningTasksTool` |
| **Pricing (simulation)** | `SimulatePricingChangeTool` |
| **Communication** | `SendGuestMessageTool` |
| **Mémoire long terme** | `RememberFactTool`, `ForgetFactTool` |
| **Connaissance / contexte externe** | `SearchKnowledgeBaseTool`, `GetLocalEventsTool`, `GetWeatherForecastTool` |
| **Workflow** | `StartWorkflowTool`, `AdvanceWorkflowTool` |
| **Navigation UI** | `SuggestNavigationTool` |

**Constat.** L'agent peut **exécuter des actions** (créer/assigner une intervention, bloquer un jour, annuler une résa, envoyer un message guest), pas seulement répondre. C'est de l'**IA d'action**, mais déclenchée par le gestionnaire dans le chat (human-in-the-loop), **pas proactive/autonome** : il n'y a pas d'agent qui surveille les conversations/opérations et agit de lui-même (contrairement à Guesty ReplyAI Autopilot / AI Task Creation, Jurny NIA). Certaines actions sensibles passent par confirmation (`PendingToolStore.java`, `ConfirmationRequiredException`).

---

## 5. Mémoire long terme

| Élément | Statut | Preuve |
|---|---|---|
| Service mémoire | ✅ Implémenté | `service/AssistantMemoryService.java` |
| Entité / persistance | ✅ | `model/AssistantMemory.java`, `repository/AssistantMemoryRepository.java` |
| Nettoyage planifié | ✅ | `scheduler/AssistantMemoryCleanupScheduler.java` |
| Tools de gestion | ✅ | `RememberFactTool` / `ForgetFactTool` |

**Constat.** Mémoire persistante de faits cross-session. Différenciateur rare sur le marché PMS (la plupart des assistants sont stateless par session).

---

## 6. Moteur d'automatisations & multi-agent

| Élément | Statut | Preuve |
|---|---|---|
| Moteur de workflow | ✅ Implémenté | `service/agent/workflow/WorkflowEngine.java`, `WorkflowRegistry`, `WorkflowValidator`, `WorkflowService` |
| Réglages de workflow | ✅ | `WorkflowSettingsService.java` |
| **Multi-agent (orchestrateur + spécialistes)** | ⚠️ Partiel — **flag OFF** | `service/agent/multiagent/OrchestratorAgent.java`, `SpecialistRegistry.java`, dir `specialists/` ; flag `clenzy.assistant.multi-agent.enabled=false` (`AgentOrchestrator.java:127`) |
| Simulation (sandbox d'action) | ✅ | dir `service/agent/simulation/` (`SimulatePricingChangeTool`, `SimulateCalendarBlockTool`) |
| Briefing | ✅ | dir `service/agent/briefing/` |

**Constat.** L'**architecture multi-agent** (un orchestrateur qui délègue à des spécialistes) **est codée** mais **désactivée par défaut en production**. C'est exactement le paradigme que vendent Jurny (NIA, réseau d'agents) et Guesty (Agent Hub / Agent Center, juin 2026) — Clenzy a la brique mais ne la livre pas activée.

---

## 7. Vision (analyse d'images)

| Élément | Statut | Preuve |
|---|---|---|
| Upload d'images dans le chat | ✅ | `POST /api/assistant/upload` (jusqu'à 3 images/message, ≤ 5 MB) |
| Réinjection en content blocks Anthropic | ✅ | base64 `type:"image"` via `PhotoStorageService.retrieve` |
| **Suivi des tokens vision** | ✅ | `service/agent/vision/VisionTokenUsageService.java` |
| **Intégration métier de la vision** | ⚠️ Minimale | suivi des coûts seulement ; pas de cas d'usage métier (ex. contrôle qualité ménage par photo, état des lieux automatisé, détection de dégâts) |

**Constat.** La vision est techniquement branchée (Claude Vision) mais **se limite au chat + comptabilité de tokens**. Aucun usage métier productisé (contrairement à la tendance « inspection IA par photo » émergente côté opérations).

---

## 8. IA tissée aux modules métier (transversal)

| Capacité IA métier | Statut | Preuve / Renvoi |
|---|---|---|
| **IA de pricing** | ⚠️ Présente mais **flag OFF** | `AiPricingService` + `clenzy.ai.features.pricing-ai=false` (`AiProperties:118`) — cf. domaine 4 |
| **IA de messagerie (suggestion de réponse)** | ⚠️ Câblée mais **flag OFF + pas d'autopilot** | `AiMessagingService.generateSuggestedResponseAi()` + `clenzy.ai.features.messaging-ai=false` (`AiProperties:119`) — cf. domaine 6 |
| **IA d'analytics** | ⚠️ Flag OFF | `clenzy.ai.features.analytics-ai=false` (`AiProperties:120`) |
| **Analyse de sentiment** | ⚠️ Flag OFF + lexicale basique | `clenzy.ai.features.sentiment-ai=false` (`AiProperties:121`) ; `analyzeSentiment()` à base de mots-clés, pas de modèle |
| **Détection d'anomalies métier** (paiement/fraude/bruit) | ❌ **Absente** | aucun service dédié (`*Anomaly*` / `*Fraud*` inexistant). `IncidentDetectionScheduler` ne fait que du **health check d'infrastructure** (Postgres/Redis/Kafka/Stripe/SMTP), pas de la détection de fraude/anomalie métier |
| **Auto-réponse guest (autopilot)** | ❌ Absente | pas de mode d'envoi autonome — cf. domaine 6 |
| **Multi-langue (assistant)** | ✅ | héritée du LLM ; `TranslationService` (DeepL/Google, 30 langues) côté messagerie templates |

**Constat clé.** Les capacités IA orientées **revenu et guest** existent dans le code mais sont **dormantes (flags OFF)** et **non tissées au parcours client**. La **détection d'anomalies** (le différenciateur sécurité 2025 : fraude paiement, screening guest, alertes maintenance — Guesty PayProtect/Verify, Hostaway fraud detection, Jurny Guest Screening) **n'existe pas**.

---

## 9. Synthèse pour le scoring

| Capacité | État Clenzy |
|---|---|
| Assistant conversationnel multi-provider | ✅ Implémenté (Anthropic/OpenAI/Bedrock, streaming, budget) |
| RAG / knowledge base | ✅ Implémenté (pgvector 2-étages, rerank, ingestion idempotente) — interne seulement |
| Tools d'action agentiques | ✅ Implémenté (27 tools), mais human-in-the-loop, non proactif |
| Mémoire long terme | ✅ Implémenté (rare sur le marché) |
| Moteur d'automatisations (workflow) | ✅ Implémenté |
| Architecture multi-agent | ⚠️ Codée mais **flag OFF** |
| IA de pricing | ⚠️ Présente, **flag OFF** (cf. domaine 4) |
| IA de messagerie (copilote draft) | ⚠️ Câblée, **flag OFF** (cf. domaine 6) |
| Auto-réponse / autopilot guest | ❌ Absent |
| **Détection d'anomalies (fraude/paiement/bruit)** | ❌ **Absente** |
| Vision (usage métier) | ⚠️ Minimale (suivi tokens seulement) |
| Résumés (conversation/avis) | ❌ Non documenté (pas de tool/feature dédié) |
| Multi-langue | ✅ (LLM + TranslationService 30 langues) |

**Score auto-évalué du domaine : 2/3.** Infrastructure IA conversationnelle/RAG **supérieure à la moyenne** (multi-provider, rerank, mémoire, 27 tools), mais le palier décisif 2025-2026 — **IA agentique autonome productisée** (autopilot guest, agents proactifs, détection d'anomalies/fraude) — est soit **dormant (flags OFF)**, soit **absent**. Clenzy a les briques d'un futur leader IA mais ne les **livre pas activées**.
