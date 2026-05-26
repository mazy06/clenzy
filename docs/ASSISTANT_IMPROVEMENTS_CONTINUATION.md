# Note de continuation — Améliorations assistant Clenzy

**Date** : 2026-05-26
**Branche** : `main` (clenzy)
**Statut** : 2 batches done sur 7, 4 items / 15 livrés (#1, #2, #3, #8, #14)
**Reste** : 11 items répartis en 5 batches (C → G)

---

## 1. Pourquoi cette note

Une session précédente a démarré l'implémentation de **15 améliorations** sur les features de l'assistant IA (RAG, briefings, portfolio, etc.). Elle a livré 2 commits cohérents puis s'est arrêtée pour préserver la qualité. Cette note permet à une nouvelle session de **reprendre proprement à partir du batch C** sans relire toute la conversation.

---

## 2. Contexte global

### Repo & branche
- Path : `/Users/toufik/Desktop/env/projets/sinatech/clenzy`
- Branche : `main` — l'utilisateur a explicitement demandé de commit directement sur `main` (cf. `feedback_work_directly_on_main` dans la mémoire auto). Pas de feature branch.
- Push sur main après chaque batch.

### Conventions critiques (à lire AVANT de coder)
- **CLAUDE.md** (racine) — règles projet importantes :
  - Liquibase, pas Flyway. Migrations `NNNN__description.sql` dans `server/src/main/resources/db/changelog/changes/` + entrée dans `db.changelog-master.yaml`. Dernière migration : **0144**. Prochaine = 0145.
  - **Ne JAMAIS lancer de preview** (`preview_start`) sauf demande explicite.
  - **Ne JAMAIS restart Docker** sans validation user.
  - **Pas de "Generated with Claude Code"** dans les commit messages.
  - **`rtk`** en préfixe pour les commandes git/mvn/npm (sinon `rtk proxy <cmd>` ou `/usr/bin/<cmd>`).
  - `@PreAuthorize` obligatoire sur chaque controller.
  - Tests obligatoires pour toute logique métier.

### Liste des 15 améliorations (ordre original)
1. ✅ RAG re-ranking (Voyage rerank-2-lite)
2. ✅ Haiku model pour briefings
3. ✅ Portfolio thresholds configurables + period comparison
4. ⏳ Memory selection by relevance
5. ⏳ Weather stale-while-revalidate + holidays API
6. ⏳ Auto-tune ivfflat scheduler
7. ⏳ Elasticity per-property + empirical
8. ✅ Portfolio patterns externalisés YAML
9. ⏳ Workflows multilingual
10. ⏳ Email MJML + WhatsApp custom
11. ⏳ JSON Schema validation workflow steps
12. ⏳ Retry briefings failed
13. ⏳ Memory expiration + last_accessed
14. ✅ Strict RAG citation prompt
15. ⏳ Vision token tracking + alerts

### Plan de batches restants
- **Batch C** : items 4 + 13 (Memory)
- **Batch D** : items 5 + 6 (Weather + Index)
- **Batch E** : item 7 (Simulation elasticity)
- **Batch F** : items 9 + 11 (Workflows)
- **Batch G** : items 10 + 12 + 15 (Notifications + Vision)

---

## 3. Ce qui a été fait (batches A & B)

### Commit `d0cb902e` — Batch A (items 1, 2, 14)

**#1 RAG Re-ranking**
- Nouveau package `server/src/main/java/com/clenzy/service/agent/kb/` :
  - `RerankProvider` (interface Strategy)
  - `VoyageRerankProvider` (impl Voyage AI `/v1/rerank`, réutilise la clé Voyage embeddings par défaut)
  - `NoOpRerankProvider` (fallback préservant l'ordre cosine)
  - `RerankService` (facade qui résout par config `clenzy.ai.rerank.provider`)
- `KbSearchService` modifié : pipeline 2 phases (over-fetch ×4, rerank, top-K, excerpt en dernier)
- Properties : `clenzy.ai.rerank.{enabled,provider,over-fetch-factor,voyage.{api-key,model,base-url}}`

**#2 Haiku pour briefings**
- `AgentContext` étendu avec `modelOverride` (nullable) + helper `withModelOverride()` + constructeur legacy préservé
- `AgentOrchestrator` propage `context.modelOverride()` dans `ChatRequest.model`
- `BriefingComposer` force `claude-haiku-4-5-20251001` via `clenzy.assistant.briefing.model`

**#14 Anti-hallucination RAG**
- System prompt section DOCUMENTATION réécrite avec 4 règles strictes (citation obligatoire, dire si la doc ne couvre pas, signaler contradictions, relevance indicative)
- Section auto-RAG renforcée

**Tests** : 26 nouveaux (RerankServiceTest 8, VoyageRerankProviderTest 6, KbSearchServiceTest +5, BriefingComposerTest +1, autres tests AgentOrchestrator/E2E/Confirmation mis à jour pour le constructeur). 81/81 verts.

### Commit `8fa3fd44` — Batch B (items 3, 8)

**#3 Portfolio config + period comparison**
- `PortfolioConfig` (`@ConfigurationProperties` prefix `clenzy.assistant.portfolio`) avec tous les seuils
- `AnalyzePortfolioTool` : nouvel arg `comparePrevious` (défaut `true`), extrait `computeMetrics` pour pouvoir le rappeler sur la fenêtre N-1, ajoute section `deltas` au payload

**#8 Patterns externalisés YAML**
- Package `server/src/main/java/com/clenzy/service/agent/portfolio/` :
  - `PortfolioPatternDetector` (interface Strategy)
  - `PortfolioPatternTemplate` (DTO YAML + évaluateur de règle simple `"var op number"`)
  - `PortfolioPatternRegistry` (charge `resources/patterns/portfolio.yaml`)
  - `PortfolioPatternEvaluator` (orchestre registry + detectors)
  - 2 détecteurs : `HighCancellationRateDetector`, `CitySatisfactionLowDetector`
- YAML : `resources/patterns/portfolio.yaml` (2 patterns initiaux)

**Tests** : 44 verts.

---

## 4. Patterns & conventions établis (à respecter)

### Architecture SOLID systématique

Tous les nouveaux services suivent ce moule :
1. **Interface Strategy** abstraite (`RerankProvider`, `PortfolioPatternDetector`, `EmbeddingProvider` existant)
2. **Multiples impls** Spring beans (`@Component`)
3. **Facade Service** qui résout par config + fail-soft
4. **Configuration** centralisée via `@ConfigurationProperties` ou `@Value`
5. **Tests unitaires** sur chaque impl + tests du service de routing

### Principe "fail-soft" partout

Si un service auxiliaire foire (embedding API down, Redis down, etc.), **le chat NE DOIT PAS casser**. Pattern :
```java
try {
    result = riskyOperation();
} catch (Exception e) {
    log.warn("X failed: {}", e.getMessage());
    return List.of();  // ou fallback
}
```

### Convention de packaging
- `service/agent/<feature>/` pour les modules cohérents (kb/, briefing/, workflow/, portfolio/)
- Modèles JPA dans `model/`, repos dans `repository/`
- Controllers dans `controller/`
- Schedulers dans `scheduler/`

### Convention de tests
- 1 test file par classe métier
- Mocker les dépendances externes (RestTemplate via `MockRestServiceServer`, repos via Mockito)
- Cas testés : happy path + 2-4 cas d'erreur + edge cases (null, empty, boundary)
- Tests d'intégration "smoke" sur les YAMLs réels du repo (cf. `WorkflowRegistryTest.productionDataset_loadsThreeWorkflows`)

### Convention de commits
Format établi :
```
refactor(assistant): <résumé court>

#X <titre item>
- <bullet point>

#Y <titre item>
...

Tests (N nouveaux)
- ...

Architecture SOLID respectee :
- OCP : ...
- DIP : ...
- SRP : ...
```

---

## 5. Pièges connus (gain de temps)

### Mockito
- `verifyNoInteractions(mock)` est strict : il échoue si une méthode stubée a été appelée. Préférer `verify(mock, never()).specificMethod()`.
- `Mockito.thenReturn(List.of(new Object[]{...}))` ne compile pas (inference variable issue). Solution : variable typée intermédiaire `List<Object[]> rows = new ArrayList<>(); rows.add(...);`
- Stubbing avec matchers (`any()`) override le stubbing spécifique précédent — toujours faire générique d'abord, spécifique ensuite.

### Tests HTTP
- `MockRestServiceServer.expect(requestTo(anyString()))` → erreur (`anyString()` est Mockito, pas Hamcrest). Utiliser `requestTo(org.hamcrest.Matchers.startsWith("https://"))`.

### Working directory
- Tests backend : depuis `/server` (`cd ... && mvn test`)
- Tests frontend : depuis `/client` (`rtk proxy npx vitest run ...`)
- `rtk tsc` doit aussi être depuis `/client`

### `AgentOrchestrator` constructeur
- Chaque nouveau service injecté = mise à jour des **3 tests** : `AgentOrchestratorTest`, `AgentE2EFlowTest`, `AgentConfirmationFlowTest`
- Pattern actuel pour les mocks "non utilisés" : `mock(com.clenzy.service.X.class)` inline

### Read avant Edit
- Le tool `Edit` exige un `Read` sur le fichier dans la session. Si l'Edit fail avec "File has not been read yet", faire un Read d'abord.

---

## 6. Vérifications avant chaque commit

```bash
# Backend compilation (rapide)
cd /Users/toufik/Desktop/env/projets/sinatech/clenzy/server
mvn -DskipTests test-compile

# Tests backend ciblés
mvn test -Dtest='ClassA,ClassB,ClassC'

# Frontend type check
cd /Users/toufik/Desktop/env/projets/sinatech/clenzy/client
rtk tsc --noEmit

# Frontend tests
rtk proxy npx vitest run path/to/test.tsx

# Git
cd /Users/toufik/Desktop/env/projets/sinatech/clenzy
rtk proxy git status
git add <specific files>
git commit -m "..."
rtk git push
```

---

## 7. Plan détaillé des 5 batches restants

### Batch C — Memory (items #4 + #13)

**Item #4 — Memory selection by relevance**
- Objectif : remplacer "top 30 entrées par récence" par "top 30 par cosine similarity avec le message user"
- Architecture :
  - Étendre `AssistantMemory` avec une colonne `embedding vector(1024)` (migration 0145, modèle pgvector déjà installé)
  - Au upsert : générer l'embedding du `memoryKey + memoryValue` via `EmbeddingService` existant
  - Nouvelle méthode `AssistantMemoryService.listMostRelevant(keycloakId, userMessage, limit)` :
    - Embed user message
    - Native query avec opérateur `<=>` similaire à `KbChunkRepository.searchByCosineSimilarity`
  - Dans `AgentOrchestrator.buildSystemPrompt(ctx, lastUserMessage)` :
    - Si `lastUserMessage` non null, appeler `listMostRelevant`
    - Sinon (resume after confirm), tomber sur `listForUser` (ordre par récence) → fallback safe
- Properties : `clenzy.assistant.memory.relevance-enabled` (défaut true)
- Tests :
  - `AssistantMemoryServiceTest` : nouveau test pour `listMostRelevant`
  - `AgentOrchestratorTest` : verify la nouvelle méthode est appelée quand user message présent

**Item #13 — Memory expiration**
- Migration 0146 : `ALTER TABLE assistant_memory ADD COLUMN last_accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, ADD COLUMN expires_at TIMESTAMP NULL`
- `AssistantMemoryService` : à chaque lecture (`listMostRelevant`/`listForUser`), bumper `last_accessed_at` (batch update pour éviter N updates par lecture — utiliser une query unique avec `IN (:ids)`)
- Nouveau `AssistantMemoryCleanupScheduler` (cron hebdo `"0 0 3 * * 1"` lundi 3am) :
  - Supprime les memories où `last_accessed_at < NOW() - INTERVAL '6 months'`
  - Supprime les memories où `expires_at < NOW()`
- Tests : `AssistantMemoryCleanupSchedulerTest` avec injection horloge

**Files attendus** :
- `server/src/main/resources/db/changelog/changes/0145__add_assistant_memory_embedding.sql`
- `server/src/main/resources/db/changelog/changes/0146__add_assistant_memory_expiration.sql`
- `server/src/main/java/com/clenzy/scheduler/AssistantMemoryCleanupScheduler.java`
- Modifications : `AssistantMemory.java`, `AssistantMemoryRepository.java`, `AssistantMemoryService.java`, `AgentOrchestrator.java`
- Tests : nouveau scheduler + service test enrichi

---

### Batch D — Weather + Index (items #5 + #6)

**Item #5 — Weather stale-while-revalidate + holidays API**
- Stale-while-revalidate dans `OpenMeteoClient` :
  - Garder le cache Redis 1h "fresh" mais étendre à 24h "stale"
  - Si l'appel HTTP échoue ET qu'on a un cache stale (entre 1h et 24h), retourner avec flag `stale: true`
  - Implémentation : 2 clés Redis ou TTL 24h + champ `cachedAt` dans le DTO sérialisé
- Jours fériés via API publique :
  - Étendre `LocalEventsRegistry` : nouveau bean `PublicHolidaysProvider` qui appelle `https://date.nager.at/api/v3/PublicHolidays/{year}/{country}` (gratuit, sans clé)
  - Cache Redis 7 jours (les jours fériés ne changent pas)
  - Concaténation dans `findByCityAndDateRange` : YAML statique + holidays API → résultat unifié
- Properties : `clenzy.assistant.events.public-holidays-enabled`, `clenzy.assistant.events.public-holidays-base-url`

**Item #6 — Auto-tune ivfflat scheduler**
- Nouveau `KbIndexTuningScheduler` (cron nocturne `"0 0 4 * * *"`) :
  - Query : `SELECT count(*) FROM kb_chunk WHERE embedding IS NOT NULL`
  - Calculer `optimal_lists = max(100, sqrt(count))` (formule pgvector recommandée)
  - Comparer à `lists` actuel (récupérable via `pg_indexes` + parsing du DDL — pas trivial)
  - Si écart > 50% : `REINDEX INDEX CONCURRENTLY idx_kb_chunk_embedding_cosine`
  - Logger l'action
- Alternative plus simple : juste re-index hebdomadaire sans check (toujours plus optimal après ingest)
- Tests : mock du `JdbcTemplate`, vérifier que REINDEX est appelé quand le seuil est franchi

**Files attendus** :
- `server/src/main/java/com/clenzy/integration/openmeteo/OpenMeteoClient.java` (modifier le cache)
- `server/src/main/java/com/clenzy/integration/holidays/PublicHolidaysClient.java` (nouveau)
- `server/src/main/java/com/clenzy/service/LocalEventsRegistry.java` (intégrer)
- `server/src/main/java/com/clenzy/scheduler/KbIndexTuningScheduler.java` (nouveau)

---

### Batch E — Simulation elasticity (item #7)

**Item #7 — Elasticity per-property + empirical**
- Migration 0147 : `CREATE TABLE property_pricing_config (id, property_id UNIQUE FK, elasticity_override DOUBLE PRECISION NULL, updated_at)`
- Entity + repository
- `SimulationService.simulatePricingChange` :
  - Avant de prendre `DEFAULT_ELASTICITY`, chercher dans la table override
  - Si pas d'override, **option** : calculer empiriquement
- Calcul empirique : nouveau `EmpiricalElasticityEstimator` :
  - Récupère l'historique 12 mois de réservations + changements de tarif (table `rate_overrides` ou similaire — à explorer)
  - Régression linéaire simple : `delta_occupancy / delta_price_pct` moyenné sur les paires observées
  - Garde dans une table `property_elasticity_estimates` (cache + audit), recalculé hebdo via scheduler
  - Si moins de 3 paires observées, retourner null (caller utilise le default 0.5)
- Tests : couvrir override > empirique > default

**Files attendus** :
- `server/src/main/resources/db/changelog/changes/0147__add_property_pricing_config.sql`
- `server/src/main/java/com/clenzy/model/PropertyPricingConfig.java`
- `server/src/main/java/com/clenzy/repository/PropertyPricingConfigRepository.java`
- `server/src/main/java/com/clenzy/service/agent/simulation/EmpiricalElasticityEstimator.java`
- `server/src/main/java/com/clenzy/service/SimulationService.java` (modifier)

---

### Batch F — Workflows (items #9 + #11)

**Item #9 — Workflows multilingual**
- Étendre `WorkflowDefinition.Step` : remplacer `String prompt` par `Map<String, String> prompts` (ex: `{"fr": "...", "en": "..."}`) OU garder `prompt` et ajouter `promptsByLang` Map nullable
- Modifier les 3 YAMLs existants : structure clé `prompts:` avec `fr:`, `en:`, `ar:`
- `WorkflowEngine.renderPrompt` : sélectionne via `context.language()` (default fr)
- Compat retro : si pas de `prompts` map, fallback sur `prompt` legacy
- Tests : `WorkflowEngineTest` avec context multilingue

**Item #11 — JSON Schema validation des workflow steps**
- Ajouter dep `com.networknt:json-schema-validator` au pom.xml
- `WorkflowEngine.collectData(...)` : si le step a `expectsData`, construire un JSON Schema implicite à partir des types déclarés + valider la réponse utilisateur (qu'on doit parser comme JSON ou string)
- Si validation fail : throw `WorkflowValidationException` qui propage au tool → erreur claire pour le LLM
- Alternative simple sans nouvelle dep : validateur fait main (verifier les types primitifs : string/number/boolean/string[])
- Tests : `WorkflowEngineTest` avec inputs valides/invalides

**Files attendus** :
- `server/src/main/java/com/clenzy/service/agent/workflow/WorkflowDefinition.java` (modifier Step)
- `server/src/main/resources/workflows/*.yaml` (3 fichiers)
- `server/src/main/java/com/clenzy/service/agent/workflow/WorkflowEngine.java` (renderPrompt + validation)
- `server/src/main/java/com/clenzy/service/agent/workflow/WorkflowValidationException.java` (nouveau)

---

### Batch G — Notifications + Vision (items #10 + #12 + #15)

**Item #10 — Email MJML + WhatsApp custom**
- Email MJML :
  - Ajouter dep MJML (option a : `com.github.maxiomtech:mjml-java` ; option b : appeler Brevo MJML API si dispo)
  - Créer template `resources/email-templates/briefing.mjml`
  - `BriefingDelivery.sendEmail` : compiler le MJML → HTML, injecter `{{title}}` `{{body}}` avant compile
- WhatsApp custom templates :
  - Migration 0148 : `CREATE TABLE org_whatsapp_templates (id, org_id, key VARCHAR, template_name, language)` pour mapper "briefing" → template Meta pré-approuvé
  - Sinon, garder `engagement_update` en fallback
  - `BriefingDelivery.sendWhatsApp` : lookup org template, fallback default

**Item #12 — Retry briefings failed**
- Nouveau `BriefingRetryScheduler` (cron horaire `"0 30 * * * *"` — décalé de 30min pour éviter le clash avec le scheduler principal) :
  - Query : `SELECT * FROM assistant_briefing_log WHERE status = 'FAILED' AND briefing_date = CURRENT_DATE AND sent_at > NOW() - INTERVAL '6 hours'`
  - Pour chaque : re-tente le dispatch avec le même `conversation_id` (déjà composé)
  - Update status en SENT ou laisse FAILED si re-échec
- Tests avec horloge mockée

**Item #15 — Vision token tracking**
- `AssistantMessage` a déjà `prompt_tokens` / `completion_tokens`. Ajouter une vue ou query :
  ```sql
  SELECT organization_id, SUM(prompt_tokens) FROM assistant_message
  WHERE attachments IS NOT NULL AND created_at >= NOW() - INTERVAL '30 days'
  GROUP BY organization_id
  ```
- Nouveau `VisionTokenUsageService.getMonthlyUsage(orgId)`
- Migration 0149 : table `org_vision_alerts` (id, org_id, threshold_tokens, last_alerted_at) pour configurer le seuil
- Scheduler hebdo : check si usage > seuil → notification admin via `NotificationService`
- Endpoint REST : `GET /api/admin/vision-usage` (admin only)

**Files attendus** :
- Migration 0148 (whatsapp templates), 0149 (vision alerts)
- `server/src/main/resources/email-templates/briefing.mjml` (nouveau)
- `server/src/main/java/com/clenzy/service/agent/briefing/BriefingDelivery.java` (modifier)
- `server/src/main/java/com/clenzy/scheduler/BriefingRetryScheduler.java` (nouveau)
- `server/src/main/java/com/clenzy/service/agent/vision/VisionTokenUsageService.java` (nouveau)
- `server/src/main/java/com/clenzy/scheduler/VisionUsageAlertScheduler.java` (nouveau)
- `server/src/main/java/com/clenzy/controller/VisionUsageAdminController.java` (nouveau)

---

## 8. Stack rapide / fichiers à lire en premier

Quand tu redémarres, lis dans cet ordre :
1. `CLAUDE.md` (racine) — règles projet
2. `docs/ASSISTANT_IMPROVEMENTS_CONTINUATION.md` — ce fichier
3. `server/src/main/java/com/clenzy/service/agent/AgentOrchestrator.java` — point central, beaucoup de dépendances injectées
4. `server/src/main/java/com/clenzy/service/agent/kb/RerankService.java` + `KbSearchService.java` — exemples du pattern Strategy/Facade établi dans le batch A
5. `server/src/main/java/com/clenzy/service/agent/portfolio/PortfolioPatternRegistry.java` — exemple du pattern YAML registry établi dans le batch B
6. `server/src/main/resources/db/changelog/db.changelog-master.yaml` — voir les migrations existantes (dernière = 0144)

---

## 9. Comment relancer

Première chose à faire dans la nouvelle session :
```bash
cd /Users/toufik/Desktop/env/projets/sinatech/clenzy
rtk git pull   # récupérer d8fd547c, 2c0889e6, etc.
rtk git log --oneline -10   # vérifier les commits récents
```

Vérifier que la base de tests passe encore :
```bash
cd server
mvn test -Dtest='AgentOrchestratorTest,KbSearchServiceTest,AnalyzePortfolioToolTest' 2>&1 | tail -10
```

Puis commencer par le **batch C** (items #4 + #13 Memory).

---

## 10. État de la table des tests

Au dernier commit (`8fa3fd44`) :
- Total tests assistant : ~190 nouveaux dans cette série
- Derniers résultats : 44/44 portfolio + 81/81 RAG/briefing + tous les tests existants verts
- Pas de TypeScript error sur le frontend

---

## 11. Si tu dois faire une décision design

L'utilisateur a une forte préférence pour :
- **SOLID** (OCP, DIP, SRP)
- **Tests en parallèle** du code
- **Refactor adjacent** autorisé si nécessaire pour respecter les standards
- **Fail-soft** (rien ne doit casser le chat)
- **Scalable** : pas de hardcoding, properties + YAML pour la config

Si un choix ambigu se présente :
1. Privilégier la séparation Strategy + Facade
2. Externaliser ce qui peut changer (seuils, labels, templates)
3. Ajouter des tests pour les cas d'erreur autant que pour le happy path
4. Demander si vraiment bloqué (rare — l'utilisateur est en mode autonomous)

---

**Bonne suite.**
