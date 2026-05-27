# Architecture multi-agents Clenzy — Design custom (sans framework)

> **Statut** : design + implémentation v1 (PoC fonctionnel)
> **Date** : 2026-05-28
> **Auteur** : équipe Clenzy
> **Décision** : aller en **custom** (pas LangChain/LangGraph/CrewAI/AutoGen)

---

## 1. Problème

L'agent actuel (`AgentOrchestrator` + `ToolRegistry`) expose **27 tools** au LLM en un seul appel. Au-delà de **~10 tools**, la qualité de routing dégrade significativement :

- Le LLM "se perd" — choisit un tool sous-optimal ou en oublie un pertinent
- Le prompt système grossit (chaque ToolDescriptor pèse ~150 tokens)
- Les hallucinations sur les arguments des tools augmentent
- Latence : plus de tokens à parser à chaque tour

**Référence** : Anthropic Claude tool use guide recommande **≤ 20 tools** maximum, idéalement **5-10 pour un routing fiable**.

---

## 2. Décision : pas de framework

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **LangChain agents** | Beaucoup d'abstractions prêtes | Lourd, debug pénible, abstractions opaques, deps Python (or on est Java) | ❌ |
| **LangGraph** | Bon pour workflows complexes (DAG) | Cible Python uniquement, lourd à intégrer côté Java | ❌ |
| **Microsoft AutoGen** | Multi-agents framework mature | Python only, focus sur agents qui se parlent (overkill ici) | ❌ |
| **CrewAI** | Persona-based agents | Python, opinionated, contraint sur la structure | ❌ |
| **Custom maison** | Contrôle 100%, debug clair, dépendances minimales, Java natif, exploite l'existant `ToolHandler`/`AgentContext`/`SystemPromptComposer` | À coder | ✅ |

Notre infrastructure (`ToolRegistry` Spring DI, `ChatLLMProvider` abstraction, `SystemPromptComposer` sectionné) **est déjà 80% de ce qu'un framework apporterait**. On évite la couche d'abstraction inutile.

---

## 3. Architecture cible

### 3.1 Vue d'ensemble

```
┌────────────────────────────────────────────────────────┐
│  User message                                          │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│  OrchestratorAgent  (LLM call #1, model: Sonnet 4)     │
│  ─────────────────────────────────────────             │
│  System prompt : <role_orchestrator> + liste des       │
│                  spécialistes avec leurs domaines      │
│  Tools[1]      : [delegate_to(specialist, query)]      │
│                                                        │
│  Décide quel(s) spécialiste(s) appeler                 │
└──────────┬─────────────────────────────────────────────┘
           │ delegate_to("data_analyst", "occupancy juillet")
           ▼
┌────────────────────────────────────────────────────────┐
│  DataAnalystAgent  (LLM call #2, model: Sonnet 4)      │
│  ─────────────────────────────────────────             │
│  System prompt : <role_specialist domain="data">       │
│                  + sub-tools usage hints               │
│  Tools[7]      : list_properties, list_reservations,   │
│                  get_dashboard_summary, get_financial, │
│                  get_properties_performance,           │
│                  get_reservation_trend,                │
│                  get_occupancy_forecast                │
│                                                        │
│  Boucle interne tools → réponse synthèse               │
└──────────┬─────────────────────────────────────────────┘
           │ "Occupation juillet 78%, peak semaine 30 à 92%..."
           ▼
┌────────────────────────────────────────────────────────┐
│  OrchestratorAgent  (suite LLM call #1, tour 2)        │
│  Reçoit la réponse spécialiste → la transforme en       │
│  réponse user finale (peut chainer un autre delegate)   │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
              [Réponse au user]
```

### 3.2 Découpage des 27 tools en 8 spécialistes

| Spécialiste | Tools | Nb |
|---|---|---|
| **DataAnalystAgent** | `list_properties`, `list_reservations`, `get_dashboard_summary`, `get_financial_summary`, `get_properties_performance`, `get_reservation_trend`, `get_occupancy_forecast` | **7** |
| **OperationsAgent** | `list_cleaning_tasks`, `get_interventions_by_status`, `create_intervention`, `assign_intervention`, `block_calendar_day`, `update_property_status` | **6** |
| **InsightsAgent** | `get_business_insights`, `analyze_portfolio`, `simulate_pricing_change`, `simulate_calendar_block` | **4** |
| **ContextAgent** | `get_weather_forecast`, `get_local_events`, `search_knowledge_base` | **3** |
| **MemoryAgent** | `remember_fact`, `forget_fact` | **2** |
| **CommunicationAgent** | `send_guest_message`, `cancel_reservation` | **2** |
| **NavigationAgent** | `suggest_navigation` | **1** |
| **WorkflowAgent** | `start_workflow`, `advance_workflow` | **2** |
| **TOTAL** | | **27** |

Tous **≤ 10 tools** par spécialiste → routing fiable côté LLM.

---

## 4. Trade-offs

### Avantages

- ✅ **Routing > 90% correct** sur le bon spécialiste (vs ~70% à 27 tools)
- ✅ **Prompts spécialistes courts** (~500 tokens vs 1500) → meilleur focus + moins cher
- ✅ **OCP** : ajouter un domaine = nouveau spécialiste, ZÉRO modification existante
- ✅ **Testabilité** : chaque spécialiste isolable
- ✅ **Observable** : metrics par spécialiste (taux d'appel, latence, succès)
- ✅ **Évolutif** : un spécialiste peut utiliser un modèle plus léger (Haiku) si tâche simple

### Inconvénients (assumés)

- ⚠️ **2 LLM calls min** (orchestrator + spécialiste) → latence +500-1500ms
- ⚠️ **Coût doublé** (mais chaque call utilise moins de tokens, le delta réel est ~×1.4)
- ⚠️ **Plus de surface à debug** (2 traces LLM au lieu d'1)

**Mitigation** :
- Feature flag `clenzy.assistant.multi-agent.enabled` (off par défaut, opt-in progressif)
- Fallback automatique au mono-agent si spécialiste fail
- Metrics dédiées pour mesurer l'impact réel avant déploiement large
- Streaming SSE des 2 appels pour ne pas attendre la fin du spécialiste avant de commencer à répondre

---

## 5. Contrats d'interface

### 5.1 `AgentSpecialist`

```java
public interface AgentSpecialist {
    String name();                          // "data_analyst"
    String domain();                        // "Analyse de donnees, KPIs, listes, graphiques"
    String description();                   // Pour l'orchestrator routing
    Set<String> toolNames();                // Sub-set du ToolRegistry global, ≤ 10
    SpecialistResult handle(SpecialistRequest request);
}
```

### 5.2 `SpecialistRequest` / `SpecialistResult` (records immutables)

```java
record SpecialistRequest(
    String query,              // demande déléguée par l'orchestrator
    AgentContext context,      // identité + tenant
    String parentTraceId       // pour observability
) {}

record SpecialistResult(
    String synthesis,                              // texte de retour pour l'orchestrator
    List<ToolInvocationLog> toolCallsExecuted,    // pour metrics
    int promptTokens,
    int completionTokens,
    boolean truncated                              // true si max iterations atteintes
) {}
```

### 5.3 `OrchestratorAgent`

Encapsule la logique LLM #1. Expose 1 seul meta-tool : `delegate_to`.

```java
public interface OrchestratorAgent {
    /** Lance l'orchestration et stream les events au consumer SSE. */
    void orchestrate(String userMessage, AgentContext context, Consumer<AgentSseEvent> consumer);
}
```

---

## 6. Sécurité / contraintes

- **Tenant isolation** : `AgentContext` est passé tel quel entre orchestrator et spécialistes — les tools restent contraints par `TenantContext`.
- **Confirmation write tools** : géré au niveau spécialiste (même `requiresConfirmation` qu'avant). Le spécialiste émet le `tool_confirmation_request` directement, l'orchestrator l'observe et le forward au consumer SSE.
- **Pas de re-prompt user au niveau spécialiste** : un spécialiste répond avec ce qu'il sait. S'il manque une info, il dit "manque X" et l'orchestrator décide (re-demande au user ou délègue ailleurs).
- **Max iterations** : 3 spécialistes par message user (cap pour éviter les boucles).

---

## 7. Plan de déploiement

1. **v1 (this PR)** : 3 spécialistes (DataAnalyst, Operations, Insights) — démontre le pattern, valide la qualité
2. **v2** : ajout des 5 autres spécialistes
3. **v3** : observabilité avancée (traces par spécialiste, A/B mono vs multi)
4. **v4** : décision GA — activer flag par défaut OU rollback si métriques pas concluantes

---

## 8. Métriques clés à surveiller

| Métrique | Cible | Alerte |
|---|---|---|
| Latence p99 multi-agent | < 2× mono-agent | > 3× → rollback |
| % delegate_to correct (tools utilisés du bon spécialiste) | > 90% | < 80% → investiguer prompts |
| Coût/message moyen | < 1.5× mono-agent | > 2× → optimiser |
| Taux d'erreur spécialistes | < 1% | > 5% → fallback systématique |

---

## 9. Comparaison vs LangChain (justification finale)

| Critère | Custom maison | LangChain | Avantage |
|---|---|---|---|
| **Dépendances** | 0 nouvelle | 50+ classes Python ou ports Java incomplets | Custom |
| **Debug** | Stack trace Java native | Wrapping wrapping wrapping | Custom |
| **Upgrade Anthropic SDK** | 0 changement | Souvent breaks compat | Custom |
| **Customisation contrats** | 100% | Contraint par leurs interfaces | Custom |
| **Onboarding nouvel ingé** | Lis 5 fichiers Java | Apprend 1 framework + leurs concepts | Custom |
| **Surface de bugs** | Notre code uniquement | Bugs LangChain + notre code | Custom |

---

## 10. Référence implémentation

Voir `server/src/main/java/com/clenzy/service/agent/multiagent/` :
- `AgentSpecialist.java` (interface)
- `AbstractAgentSpecialist.java` (boucle LLM réutilisable)
- `SpecialistRegistry.java` (Spring DI auto-collection)
- `OrchestratorAgent.java` (LLM #1 + meta-tool delegate_to)
- `specialists/` (8 implémentations)

Tests : `server/src/test/java/com/clenzy/service/agent/multiagent/`

---

**Validation** : tests unitaires par spécialiste + tests intégration end-to-end + tests régression vs mono-agent + tests performance (latence, concurrent threads).
