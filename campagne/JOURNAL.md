# Campagne multi-agent Baitly — Journal

> Journal de bord de la campagne d'analyse/amélioration/monétisation du système multi-agent.
> Orchestrateur : Architecte en chef (Claude Fable 5). Tenu à jour à chaque étape.

## 2026-07-01 — Lancement de la campagne / Phase 0

- **Cadrage** : mission reçue (8 phases, gates de validation explicites). Axes : efficience tokens/coût, monétisation à l'usage (crédits, Stripe), richesse d'outils, couverture métier 16 domaines, différenciation agentique-native.
- **Correction de prémisse (constat immédiat, avant sous-agents)** : le brief suppose une couche agentique « Spring AI ». **Faux** — aucune dépendance `spring-ai` dans `server/pom.xml`. La couche agentique est un framework custom maison sous `server/src/main/java/com/clenzy/service/agent/` (`AgentOrchestrator`, `AgentToolLoopRunner`, `ToolRegistry`, `MultiAgentFlowRunner`, `multiagent/OrchestratorAgent` + specialists, ~80 outils). Conséquence : les recommandations Phase 1+ devront trancher « rester custom vs migrer Spring AI » (décision structurante → DECISIONS.md).
- **Sous-agents Phase 0 lancés en parallèle** (5 mandats) :
  1. Cartographie couche agentique runtime (graphe, agents, routage, contexte/mémoire, HITL).
  2. Inventaire catalogue d'outils (~80) + sécurité/auth/idempotence.
  3. Audit économique (metering existant `AssistantUsageService`/`LlmPricingService`, prompt caching, quotas, monétisation actuelle, baseline coût par run).
  4. Couverture métier 16 domaines × 3 segments (PMS classique vs couche agentique).
  5. Supervision « Constellation » (data-contract front, transport temps réel existant, HITL, replay) + instruction de la décision transport post-LangGraph.
- État du working tree au lancement : modifs non commitées (refonte supervision : UI constellation + cartes HITL + scanners déterministes backend, migration 0293). L'audit porte sur cet état courant.

## 2026-07-01 — Phase 0 terminée → Gate 0

- 5 rapports de sous-agents reçus et consolidés dans `00-audit.md`. Contre-vérifications orchestrateur sur 4 divergences (prompt caching Anthropic bien implémenté ; migration `0072__create_ai_token_tables.sql` bien existante ; Liquibase pas Flyway ; 60 outils réels).
- Constats majeurs : (1) framework agentique custom mature — PAS Spring AI ; (2) 6 leviers tokens déjà livrés (commit bc98774e), gros gains restants = routage petit modèle + tiering specialists + rolling summary + vision ; (3) metering par appel LLM déjà persisté (`ai_token_usage`) mais AUCUN lien usage↔facturation ; (4) 4 domaines métier à zéro (fiscalité, screening, stocks, crise) ; (5) Constellation sur SSE, pas de replay — reco Option C (SSE + agent_run/agent_step async + replay).
- **Gate 0 posée** : en attente du « OK phase 0 » + décisions D-001 (transport, reco Option C) et D-002 (calendrier custom vs Spring AI).

## 2026-07-01 — Gate 0 validée (« OK » utilisateur) → Phase 1 → Gate 1

- D-001 tranchée : Option C hybride (SSE + agent_run/agent_step async + replay ; STOMP en incrément si multi-client avéré). D-002 : options comparées produites en Phase 1, reco Option 1 (consolider le custom).
- Vérifications complémentaires orchestrateur : Micrometer IA existe (`AgentToolMetrics` : `assistant.tokens{provider,model,type}`, `assistant.tool.executions{tool,outcome}`) ; `SpecialistResult` porte tokens in/out par specialist ; `AiTargetResolver.resolvePrimary(org, feature, contextModelOverride)` = point d'accroche du tiering.
- Livrable `01-optimisation-tokens.md` produit : 9 leviers restants chiffrés (L1 routage court-circuit -30/-45 %, L2 tiering par rôle -25/-40 % multi-agent, L3 scoping V2, L4 vision, L5 rolling summary, L6 réservation pré-vol → Phase 2, L7 observabilité d'abord, L8/L9 marginaux) ; matrice tâche→modèle 3 tiers config-driven ; 3 architectures de contexte comparées (reco : B maintenant, C adossée à D-001) ; plan priorisé « mesurer → router → tiérer → dégraisser → mémoire → encadrer → cibler ». Effet cumulé attendu : coût/interaction -55 à -70 %.
- **Gate 1 posée** : en attente du « OK phase 1 ».

## 2026-07-02 — Gate 1 validée (« OK phase 1 ») → Phase 2 → Gate 2

- Vérifications marché (doc Stripe) : credit grants OK mais applicables uniquement à des prix metered ; Billing 0,5-0,8 % ; rachat Metronome 01/2026 (veille). Ancrages code : forfaits essentiel/confort/premium (`PricingConfigService`), `WebhookController`, `StripeGateway`.
- Livrable `02-facturation-usage.md` produit : rate card versionnée (débit tarif plein, cache en marge = D-104), ledger append-only `ai_usage_ledger` (run_id/step réutilisant agent_run de D-001, idempotency_key, coût réel séparé du débit), poches `ai_credit_grant` (SUBSCRIPTION cycle / TOPUP 12 mois, FIFO expiration), sous-budget autonomie `ai_autonomy_budget` (cap premium, socle débité 0 mais tracé), solde chaud Redis Lua fail-closed (pattern SupervisionScanQuota), séquence pré-vol→réservation→re-check inter-tours→réconciliation, intégration Stripe Variante 1 (tiroir-caisse pur, reco vs Meters — D-004), réconciliation double marge/revenu, UX Constellation (jauge 2 poches, estimation pré-action, ledger étiqueté), grille forfaits +9/+29/+79 € avec 500/2 000/8 000 crédits, checklist 11 pièges, 4 scénarios.
- Nouvelles décisions posées : D-003 (BYOK → reco taux réduit 30 %), D-004 (Stripe tiroir-caisse pur — écart assumé vs brief §2.5).
- **Gate 2 posée** : en attente du « OK phase 2 » + arbitrages D-003/D-004 + calibration grille (prix/dotations).

## 2026-07-02 — Gate 2 validée (« OK phase 2 ») → Phase 3 → Gate 3

- D-003 (BYOK taux réduit 30 %) et D-004 (Stripe tiroir-caisse pur) tranchées sur reco.
- Livrable `03-architecture-agents.md` produit : roster cible 17 agents (10 existants dont 4 étendus — Revenue⊂Insights, Réservations/Housekeeping⊂Operations, Réputation⊂Communication — + 7 nouveaux : Distribution, Maintenance, Conformité, Propriétaire, Marketing, Screening, Incident, Stocks, Upsell), principe « un agent sans outils est un chatbot » (domaines à zéro conditionnés aux services PMS, vague 3), correction du brief sur les tiers (orchestrateur = standard, fort réservé à Revenue/Conformité/Incident/arbitrage), schéma cible Mermaid (routeur L1 + déclencheurs Kafka/cron + gate autonomie×crédits + agent_run/Constellation), patterns (deltas archi C, sous-flux déterministes Java, HITL unifié pending_action, arbitre à règles), matrice autonomie 4 niveaux × 3 segments avec invariant sécurité, variantes A/B comparées → reco B (3 vagues).
- **Gate 3 posée** : en attente du « OK phase 3 ».

## 2026-07-02 — Gate 3 validée (« OK phase 3 ») → Phase 4 → Gate 4

- Livrable `04-catalogue-outils.md` produit : 7 principes de conception (dont `mutating` et `estimatedCredits` ajoutés au ToolDescriptor, descriptions ≤150 chars, montants jamais client-trusted), mapping complet 17 agents → outils (≤10/agent, E/N), 32 nouveaux outils priorisés par vague avec service d'ancrage réel (V1 = services existants : initiate_refund/modify_dates/owner_statement/pricing_rules/request_review/translate/credit_balance ; V2 = mutateurs channel/litiges/préventif/payout/incident ; V3 = conditionnés aux services PMS neufs), gabarit de spec complet (exemple initiate_refund), checklist sécurité 9 points (tenant prouvé pas supposé, idempotence, hors-transaction, audit, tests cross-tenant), 4 corrections de dette outillage.
- **Gate 4 posée** : en attente du « OK phase 4 ».

## 2026-07-02 — Gate 4 validée (« OK phase 4 ») → Phase 5 → Gate 5

- Livrable `05-couverture-metier.md` produit : 16 fiches domaines (pro / agent porteur / outils E+N / autonomie / KPI / segments) + 16 scénarios end-to-end chiffrés en crédits (buckets SOCLE/INTERACTIVE/PREMIUM_AUTO cohérents Phase 2). Synthèse : 9/16 domaines complets en V1, 13/16 en V2, 16/16 en V3 ; particulier servi ~90 % dès V1, conciergerie différenciée dès V1 (agent Propriétaire), petit hôtel conditionné à la décision produit Phase 6.
- **Gate 5 posée** : en attente du « OK phase 5 ».

## 2026-07-02 — Gate 5 validée (« OK phase 5 ») → Phase 6 → Gate 6

- Veille concurrentielle : 3 sous-agents parallèles, 11 acteurs sourcés (Guesty Agent Hub ~30 agents 06/2026 ; Hostaway copilote sans envoi ; Hospitable MCP + refus loggés ; Lodgify Co-Host filtre ; Jurny NIA flat 19 $/unité ; Boom curseur Co-Pilot→auto ; Smoobu sans IA native ; GuestReady/Maia >50 % messages résolus ; Houst boîte noire ; Mews 300 M$ agentique hôtel ; Apaleo marketplace agents) + panorama monétisation SaaS (crédits = grammaire 2026 : HubSpot/Copilot/Monday/Salesforce ; per-outcome Intercom Fin).
- Livrable `06-modele-differenciant.md` : 5 trous du marché identifiés (coût IA à l'action, audit/replay, autonomie fine apprise, transparence propriétaire, STR multi-mandats) — tous couverts structurellement par les Phases 0-5 ; modèle opérationnel 6 piliers (« exploitation supervisée par exception, au coût visible ») ; 3 signature features : Grand Livre d'Autonomie, Règles de Confiance (validations apprises), Constellation Propriétaire ; positionnement tranché : B2B2C (outil pour conciergeries), petit hôtel fermé pour l'instant.
- **Gate 6 posée** : en attente du « OK phase 6 ».

## 2026-07-02 — Gate 6 validée (« OK phase 6 ») → Phase 7 → Gate 7 (finale)

- Livrables produits : `ADRS.md` (8 ADRs acceptées : custom consolidé, transport SSE+runs persistés, pgvector conservé, tiering par rôle, crédits/hard cap/Stripe tiroir-caisse, caching en marge, autonomie socle+premium plafonné, BYOK 30 %), `07-feuille-de-route.md` (architecture cible consolidée Mermaid + forme de l'état partagé en 5 plans, roadmap RICE Now/Next/Later sur 5 flux, 12 tickets détaillés T-01→T-12, tableau des gains), `/SYNTHESE.md` à la racine (2 pages : état, cap, gains, exécution).
- **Gate 7 posée — campagne d'analyse/design TERMINÉE.** Prochaine étape hors campagne : exécution du backlog Now (T-01…) sur validation utilisateur.

## 2026-07-02 — Exécution T-01 : observabilité coût enrichie (FAIT, vérifié, non commité)

- `AgentToolMetrics` : `recordTokens` → `recordLlmUsage(provider, model, agent, prompt, completion, cachedPrompt)` ; tags `agent` (mono/multi_agent), type `cached_prompt` ; nouveaux compteurs `assistant.cost.usd` (sur tokens FACTURÉS = coût réel, via `LlmPricingService` injecté) et `assistant.pricing.unknown_model`.
- `LlmPricingService` : warn réel sur modèle hors grille (le doc-vs-code corrigé) + `isKnownModel()`.
- 3 sites d'appel mis à jour (`AgentToolLoopRunner` boucle + tour final — transmettent désormais les cachedPromptTokens ; `MultiAgentFlowRunner`).
- Tests : `AgentToolMetricsTest` réécrit (nested Cost : 0,00675 $ exact, accumulation, unknown), `LlmPricingServiceTest` +2, constructeur InstrumentationTest adapté.
- Vérification : `mvn package` complet exit 0, jar produit. NON COMMITÉ (règle).
- Écarts assumés vs ticket : attribution par specialist différée au ledger T-05 (mono/multi suffit pour mesurer L1) ; cache write non séparé (replié dans le facturé par AnthropicChatProvider) ; dashboard Grafana = clenzy-infra (hors repo), JSON à fournir sur demande.

## 2026-07-02 — Exécution T-02 : routeur d'intention (FAIT, vérifié, non commité)

- `IntentRouter` (nouveau) : classification DIRECT/SIMPLE/MULTI (prompt ~120 tokens, max_tokens=8, T=0, message tronqué 400 chars), biais systématique vers MULTI (réponse inattendue / erreur provider / message vide / flag off = comportement historique). Compteur `assistant.routing.decision{route}`.
- Câblage `AgentOrchestrator.handleMessage` : décision avant le bloc multi-agent, SIMPLE/DIRECT → fallback mono existant ; DIRECT → mono SANS outils (-2-6k tokens). Coût de classification tracé (`agent=router`, T-01 + ai_token_usage). Constructeur Spring +1 param ; chemin legacy test-only = null (désactivé).
- Config : `clenzy.assistant.routing.enabled` (défaut FALSE — activation explicite pour rollout mesuré) ; `clenzy.assistant.routing.model` (override optionnel, T-03 y branchera le tier petit).
- Tests : `IntentRouterTest` 9 tests (routes, parsing bruité, 3 fallbacks, override modèle, troncature).
- Vérification : `mvn package` BUILD SUCCESS, jar frais. NON COMMITÉ (commit commun prévu).
- Écart assumé : « escalade mono→multi en cours de run » remplacée par le biais doute→MULTI du classifieur (une vraie escalade mid-run demanderait un signal depuis la boucle mono — à réévaluer avec l'architecture C).

## 2026-07-02 — Exécution T-03 : tiering de modèles par rôle (FAIT, vérifié, non commité)

- `AgentTier` (SMALL/STANDARD/STRONG) + `TierModelResolver` (@ConfigurationProperties `clenzy.assistant.tiering.*`, mapping tier→modèle PAR PROVIDER — jamais d'id invalide pour une org BYOK ; fallback strict = modèle du contexte si désactivé/STANDARD/provider inconnu/mapping absent).
- `AgentSpecialist.tier()` défaut STANDARD ; overrides : Navigation/Memory/Context/Workflow=SMALL, Insights=STRONG. `AbstractAgentSpecialist` résout par tier aux 2 sites de build (run + reprise HITL), injection setter optionnel (constructeurs specialists inchangés). `IntentRouter` (T-02) branché sur tier SMALL (priorité : routing.model > SMALL > contexte).
- Tests : `TierModelResolverTest` 8 tests (invariant fallback central) ; IntentRouterTest adapté.
- Vérification : `mvn package` BUILD SUCCESS. NON COMMITÉ (commit commun).
- Écart assumé vs ticket : config par PROPERTIES (pas table DB + UI admin) — satisfait ADR-004 avec 10× moins de surface ; couche DB/UI possible plus tard autour du même resolver si le réglage sans redéploiement devient un besoin réel. Activation : `clenzy.assistant.tiering.enabled=true` + maps small/strong par provider.

## 2026-07-02 — Exécution T-04 : scoping V2 + descriptions + vision (FAIT, vérifié, non commité)

- **Scoping V2** (`ToolScopeSelector`) : le « bug startsWith » de la Phase 0 était exagéré (matching par préfixe sain) — vrais coupables = stems ambigus. Purge : `demande` (pricing), `temps`/`local`/`activite`/`sortie` (météo), remplacés par stems spécifiques (prevision, concert, festival, canicule, neige, tourisme). Nouvelle règle : stem <5 chars = match exact ou pluriel `+s` ; ≥5 = préfixe. +4 tests (2 faux positifs corrigés, 1 non-régression intention météo, 1 stems courts).
- **Descriptions** : 39/60 outils >150 chars compressés à ≤160 par sous-agent sous règles strictes — 10 947→5 946 chars (-45,7 %), diff 39×1 ligne, discriminants inter-outils et défauts critiques conservés, 1 rebranding Clenzy→Baitly opportuniste.
- **Vision** (`ConversationHistoryMapper`) : images résolues (garde org + fetch S3 + base64 ~4k tokens) UNIQUEMENT pour le dernier message user ; anciennes → `PAST_IMAGE_PLACEHOLDER` textuel. Gain tokens + I/O storage à chaque tour. +2 tests (aucun appel storage pour image ancienne ; dernier message toujours résolu).
- Vérification : `mvn package` BUILD SUCCESS. NON COMMITÉ (commit commun, 82 fichiers modifiés au total dans le working tree — inclut la refonte supervision antérieure non commitée).
- Écart assumé : pas de tool `view_attachment` (YAGNI — l'analyse du tour 1 reste dans l'historique) ; ré-envoi intra-run de l'image du tour courant conservé (couvert à ~10 % du coût par le cache Anthropic, et retirer l'image en cours d'analyse serait risqué).

## 2026-07-02 — Commits thématiques + push origin/main

- `d493d4b6` feat(superviseur) : suggestions actionnables + analytics perf par logement (migration 0293) — lot pré-campagne, tsc vérifié.
- `e70aae8f` docs(campagne) : dossier complet 8 phases + SYNTHESE.md.
- `e10894ae` feat(assistant-ia) : optimisation tokens T-01→T-04.
- Poussés sur origin/main (workflow main direct). PAS de PR main→production : le déploiement prod attend une demande explicite. Flags à activer pour bénéficier de T-02/T-03 : `clenzy.assistant.routing.enabled`, `clenzy.assistant.tiering.enabled` + maps small/strong.

## 2026-07-02 — Exécution T-05 : agent_run/agent_step + replay (FAIT, vérifié, non commité)

- **Migration 0294** (`agent_run` UUID app-assigned / `agent_step` seq unique par run, kinds LLM_CALL/TOOL_CALL/DELEGATION/PAUSE/SUMMARY, tokens par step — brique du ledger T-06). PII : `detail` sans arguments d'outils (audit masqué les garde).
- **`AgentRunRecorder`** : ThreadLocal par run (streaming bloquant dans le thread appelant), écritures async mono-thread file bornée 512 + DiscardPolicy, échecs avalés debug — zéro latence chemin SSE. startRun réinitialise l'état du thread (run orphelin d'exception propagée reste RUNNING, sans pollution).
- **Hooks** : orchestrateur start/finish après gates + run `chat_resume` à la reprise + SSE `run_started{runId}` (nouveau composant `runId` sur AgentSseEvent, translator AG-UI forward-compatible) ; boucle mono → LLM/TOOL/PAUSE steps ; `OrchestratorAgent.invokeSpecialist` → DELEGATION (point unique, 2 appelants couverts) ; `MultiAgentFlowRunner` → PAUSE + SUMMARY. Statut fin de run : ERROR > PAUSED (si pause enregistrée) > COMPLETED.
- **Replay** : `GET /api/agui/history/{runId}` (AgUiController) → `AgentRunQueryService` — AgentRun SANS filtre tenant Hibernate ⇒ ownership validé explicitement (`OrganizationAccessGuard`), 404 `NotFoundException`, 403 cross-org. DTO `AgentRunReplayDto`.
- Tests : 7 recorder + 3 query service. `mvn package` BUILD SUCCESS. NON COMMITÉ.
- Écarts assumés : pas de producteur Kafka `agents.*` (persistance async directe = mêmes garanties ; à ajouter avec le pont STOMP/Constellation Propriétaire) ; briefings/batch pas encore couverts par startRun (origines chat/chat_resume seulement en T-05).

## 2026-07-02 — Exécution T-06 : rate card + ledger de crédits (FAIT, vérifié, non commité)

- **Migration 0295** : `ai_credit_rate_card` versionnée append-only (fermer effective_to, jamais d'UPDATE) avec seed grille Phase 2 (markup ×5, millicredits/1k : Sonnet 750/4000, Haiku 200/1000, Opus 4000/20000, gpt-5-mini 65/500, embeddings 5) + `ai_usage_ledger` append-only (débit client millicredits + coût provider réel micro-USD par ligne, run_id/step_seq → tables T-05, unique idempotency_key).
- **`CreditMeteringService`** : résolution par préfixe le plus long (convention LlmPricingService), cache 5 min, arrondi SUPÉRIEUR par 1k, facteur BYOK `clenzy.ai.credits.byok-factor:0.30` (ADR-008), doublon idempotence ignoré, modèle sans taux → 0 + WARN, best-effort (l'enforcement viendra du pré-vol T-06b, pas de cette écriture).
- **Branchement** : entonnoir unique `recordUsageSafe` (signature Long orgId → AgentContext : attribution user au ledger ; 4 appelants mis à jour dont l'usage du routeur — oublié au 1er build, corrigé). Clé idempotence `runId:meter:N` (séquence dédiée AgentRunRecorder). `ai_token_usage` maintenu en parallèle (transition).
- Tests : 7 (calcul + coût réel séparé, ceil, BYOK, préfixe, inconnu, doublon, no-ops). `mvn package` BUILD SUCCESS (2e run après fix compilation). NON COMMITÉ.
- Écarts assumés : débit sur tokens d'entrée tels que livrés (déjà cache-ajustés) — sous le « tarif plein » strict ADR-006, favorable client, à affiner quand la décomposition brute sera plombée ; flag BYOK false aux points d'appel (source de clé non propagée — T-06b) ; buckets SOCLE/PREMIUM_AUTO avec le ticket autonomie.

## 2026-07-02 — Exécution T-06b : poches + solde Redis + enforcement (FAIT, vérifié, non commité)

- **Migration 0296** : `ai_credit_grant` (SUBSCRIPTION consommée d'abord puis TOPUP FIFO expiration — D-102, stripe_ref unique pour l'idempotence T-07, CHECK bornes).
- **`CreditBalanceService`** : 3 scripts Lua atomiques (reserve avec seed SETNX depuis Postgres au cache-miss + retry unique, release-si-existe, forceDebit pouvant passer négatif), **fail-closed** Redis down ; `applyConsumptionToGrants` sous verrou pessimiste (`lockActiveGrants`, ordre JPQL SUBSCRIPTION→FIFO) — multi-runs et multi-instances safe ; `invalidate(org)` pour T-07 (GRANT/EXPIRY).
- **`RunCreditGuard`** : ThreadLocal par run — pré-vol plancher (`floor-millicredits:2000`), rallonges par chunk (`chunk-millicredits:5000`) = re-check inter-tours anti-runaway, épuisement → arrêt propre (boucle mono sort vers le tour final sans outils), réconciliation endRun (release ou forceDebit de l'overshoot).
- **Câblage** : metering→guard.onDebit ; orchestrateur pré-vol + hard cap SSE (run initial + reprise HITL — sur la reprise, le pending étant consommé, l'action devra être relancée après recharge) + endRun aux 4 retours ; boucle mono check inter-itérations.
- **Flag `clenzy.ai.credits.enforcement.enabled` = FALSE par défaut** — l'activer sans dotations couperait tout à zéro ; allumage prévu après T-07.
- Tests : 8 RunCreditGuard + 5 CreditBalanceService + adaptations. `mvn package` BUILD SUCCESS. NON COMMITÉ.
- Écart assumé : pas de check inter-délégations multi-agent (bornées ≤3, overshoot réconcilié par forceDebit) — à raffiner avec l'architecture C.

## 2026-07-02 — Exécution T-07 : Stripe dotations + top-up + expiration (FAIT, vérifié, non commité)

- **Dotations** : case `invoice.paid` → `AiCreditGrantService.grantForPaidInvoice` (payeur par stripeSubscriptionId, forfait→dotation configurable : essentiel 500k/confort 2M/premium 8M millicredits, poche SUBSCRIPTION +32 j). Invoices hors abonnement PMS ignorées.
- **Top-up** : `POST /api/ai/credits/topup` → Checkout PAYMENT, packs 100 % serveur (500cr=12€, 2000=40€, 10000=160€), crédit uniquement au webhook `type=ai_credit_topup`, poche TOPUP 12 mois. `GET /balance` + `GET /packs` prêts pour l'UX T-08 (`AiCreditController` mince, @PreAuthorize).
- **Idempotence** : existsByStripeRef + contrainte unique en filet ; retries natifs Stripe (500 → re-livraison, design Z3-BUGS-10 existant) = la file de re-livraison ; lignes GRANT/EXPIRY du ledger idempotentes ; invalidation Redis à chaque mouvement.
- **Expiration** : `AiCreditExpiryScheduler` quotidien 04h10 → EXPIRY journalisées + poches soldées (D-102).
- Tests : 6 AiCreditGrantServiceTest + constructeur test webhook adapté. `mvn package` BUILD SUCCESS. NON COMMITÉ.
- ⚠️ **ACTION INFRA (hors repo)** : ajouter l'événement `invoice.paid` à la liste du webhook endpoint Stripe (dashboard) — sans lui, pas de dotation mensuelle. Job « payé sans poche » (scan sessions Stripe) = backlog (les retries Stripe couvrent le cas nominal plusieurs jours).
- Allumage réel du système : dotations existantes en DB (1er invoice.paid ou INSERT manuel de poche) PUIS `clenzy.ai.credits.enforcement.enabled=true`.

## 2026-07-02 — Exécution T-08 : UX crédits (FAIT, vérifié, non commité)

- Backend : `GET /api/ai/credits/ledger` (50 derniers mouvements org, libellés agent/type/modèle + runId → lien replay futur).
- Frontend : `AiCreditsSection.tsx` dans Paramètres→IA→Consommation (au-dessus de la vue tokens) : solde tabular-nums coloré par seuils (épuisé/ambre <50/vert), chips des 2 poches avec expiration, packs → Checkout avec retour ?topup= géré, table ledger 10 lignes signée, skeleton, i18n fr/en/ar (JSON validés). Client `aiCreditsApi.ts`.
- Vérification : tsc clean + mvn package BUILD SUCCESS. NON COMMITÉ (avec T-07).
- Écarts assumés : jauge Constellation différée (SupervisionPanel fraîchement refondu — composant réutilisable prêt) ; alertes 80/95/100 nécessitent la dotation de référence serveur (suivi X4) ; estimation pré-action attend estimatedCredits des descriptors (Phase 4 §7).

## 2026-07-02 — Exécution T-09 : agent Propriétaire (FAIT, vérifié, non commité)

- `OwnerRelationsSpecialist` (11e specialist, auto-enregistré OCP) : point de vue du PROPRIÉTAIRE d'un mandat (vs finance=trésorerie org) — relevés, reversements, commissions, P&L par bien. 5 outils, tier STANDARD.
- `SendOwnerStatementTool` (write, requiresConfirmation) : relevé email via OwnerStatementService existant (PAID only, HTML échappé), org du contexte jamais des args, dates validées (ordre + ≤2 ans), email masqué PiiMasker dans le retour LLM.
- ToolScopeSelector : domaine propriétaire (stems proprietaire/reversement/releve/commission/mandat/payout/owner). Rôles opérationnels : refus par défaut (RoleToolPolicy inchangée).
- Tests : 4 outil + 1 scoping. `mvn package` BUILD SUCCESS. NON COMMITÉ.
- Écart assumé : get_commission_breakdown différé V2 (nouveau service d'agrégation requis ; la commission est déjà détaillée par get_owner_payout_summary).

## 2026-07-02 — Exécution T-10 : initiate_refund (FAIT, vérifié, non commité)

- `ReservationRefundService` : mouvement d'argent PUR (pas de mutation de statut — annulation = cancel_reservation ; geste partiel ≠ REFUNDED). Règles absolues : montant jamais client-trusted (CANCELLATION = politique serveur + cross-check strict ; GESTURE/DISPUTE = requis, plafonné au cash encaissé = total − crédit fidélité) ; Stripe HORS transaction, clé idempotence `agent-refund-{id}-{reason}-{amount}` ; ownership explicite post-findById ; garde déjà-remboursée ; réutilise refundCheckoutSessionPartial (circuit breaker + contre-passation ledger).
- `InitiateRefundTool` (write, requiresConfirmation — invariant paiement), ajouté au FinanceSpecialist (10e outil, limite) + stems rembours/refund/geste/litige au scoping.
- Tests : 8 tests argent (cross-org avant tout appel Stripe, OTA refusée, déjà remboursée, politique serveur, écart refusé, plafond cash crédit déduit, clé idempotence exacte, montant manquant). `mvn package` BUILD SUCCESS. NON COMMITÉ.
- **Backlog Now de la feuille de route : TERMINÉ** (T-01→T-10). Reste le Next : X1 pending_action unifié, X2 Règles de Confiance, X3 Grand Livre UI, X4 sous-budget autonomie, X5 grille forfaits prod, X6 rolling summary, X7 agents V2, X8 déclencheurs Kafka, X9 Constellation Propriétaire, X10 réconciliation double.

## 2026-07-02 — Exécution X1 : pending_action durci (FAIT, vérifié, non commité)

- **Migration 0297** : `agent_pending_action` — journal durable des pauses HITL, cycle PENDING→CONFIRMED/REFUSED/EXPIRED, index (org, tool_name, status) pour X2.
- **PendingToolStore durci** : persist best-effort à la pause (historique mono sérialisé IMAGES STRIPPÉES — jamais de base64 en DB, placeholder T-04 ; multi = journalisé sans payload, état moteur+JWT non sérialisables → comportement volatil conservé) ; reprise post-reboot MONO au consume memory-miss (ownership+expiration re-validés) ; `listForUser` fallback journal si Redis vide/KO/absent (fin de la « perte silencieuse » dette Phase 0 n°3) ; `markResolved` appelé par l'orchestrateur (outcome = matière première X2) ; scheduler horaire EXPIRED (signal « action ignorée ≠ à automatiser »).
- Tests : 6 (persistance strippée avec preuve anti-base64, recovery mono, refus cross-user, refus multi, outcomes sans double transition, fallback DB). Constructeurs rétro-compatibles. `mvn package` BUILD SUCCESS. NON COMMITÉ.
- Écart assumé : reprise post-reboot multi-agent non couverte (contrainte du design d'origine — JWT/état moteur) ; l'unification de shape avec supervision_suggestion différée (déjà Postgres+CAS, cycle de vie différent) — le journal X1 suffit aux Règles de Confiance.

## 2026-07-02 — Exécution X2 : Règles de Confiance (FAIT, vérifié, non commité)

- **Migration 0298** : `agent_trust_rule` — cycle SUGGESTED (inerte) → ACTIVE (acceptation humaine explicite) → REVOKED/DISMISSED, unique (org, outil), décideur tracé.
- **`AgentTrustRuleService`** : évaluation quotidienne (05h05) — N dernières résolutions du journal X1 toutes CONFIRMED (seuil `clenzy.assistant.trust-rules.threshold:5`, un refus/timeout invalide), jamais de re-suggestion après DISMISSED/REVOKED ; gate `isAutoApproved` (ACTIVE only, **fail-safe** : erreur DB = confirmation) ; **blocklist argent codée** (initiate_refund, settle_intervention_payment — jamais suggérés NI auto-approuvés, défense en profondeur).
- **Effet** : règle ACTIVE = outil « confirmer » → « notifier » aux 2 sites de pause (mono `needsConfirmation()` + garde-fou specialists) ; exécution toujours tracée (audit/agent_step/ledger/SSE), révocation immédiate.
- **API** : `/api/ai/autonomy/trust-rules` (GET, accept/dismiss/revoke) — DTO (pas d'entité exposée), ownership org dans le service.
- Tests : 11 (pattern pur, refus bloquant, blocklist ×2, re-suggestion, gate, fail-safe, transitions, cross-org, revoke). `mvn package` BUILD SUCCESS. NON COMMITÉ.
- Écart assumé : panneau UI (liste/toggle des règles dans Paramètres→IA) = incrément frontend à venir — endpoints prêts.

## 2026-07-02 — Exécution X3 : Grand Livre d'Autonomie (FAIT, vérifié, non commité)

- Frontend PUR (endpoint `GET /api/agui/history/{runId}` déjà livré en T-05). Client `agentRunApi.ts` + `AgentRunReplayDialog.tsx` (replay d'un run : étapes LLM/TOOL/DELEGATION/PAUSE/SUMMARY, icônes lucide par type, tokens tabular-nums, statut coloré, skeleton).
- Branchement : les lignes du ledger crédits (`AiCreditsSection`) portant un runId deviennent cliquables (curseur pointer + icône History) → ouvrent le replay. « Chaque action IA a un reçu rejouable » (signature feature n°1).
- i18n fr/en/ar (agentReplay.* + aiCredits.ledger.replayHint), diff locales propre (24 lignes/locale, formatage préservé).
- Vérification : tsc clean (pas de backend touché → pas de mvn). NON COMMITÉ.
- Écart assumé : replay accessible depuis le ledger crédits (point d'entrée naturel : runId présent) ; l'intégration dans la Constellation (time-travel visuel) viendra avec la reprise du chantier supervision. Un run sans débit (ex. DIRECT smalltalk) n'a pas de ligne ledger donc pas d'entrée replay — acceptable (rien à rejouer d'intéressant).

## 2026-07-02 — Exécution X4 : sous-budget d'autonomie premium (FAIT, vérifié, non commité)

- **Migration 0299** : `ai_autonomy_budget` (plafond premium par org, on_cap_behavior PAUSE/NOTIFY_ONLY, toggles JSONB, cap 0 = premium désactivé par défaut).
- **`AutonomyContextHolder`** (ThreadLocal) : bucket du run courant, lu par `CreditMeteringService` (fin du BUCKET_INTERACTIVE hardcodé). **SOCLE = débité 0 crédit + coût réel tracé** (D-105 : jamais puni pour le travail élémentaire, on pilote l'absorbé). Interactif/premium consomment le solde normalement.
- **`AutonomyBudgetService.evaluate(org, behavior)`** → ALLOWED / CAPPED_PAUSE / CAPPED_NOTIFY_ONLY / DISABLED (comportement activé ET cumul cycle PREMIUM_AUTO < cap ; cumul = somme SQL ledger depuis le 1er du mois UTC, aligné dotation). L'interactif n'est JAMAIS consulté (pas de siphonnage).
- **API** : GET/PUT `/api/ai/autonomy/budget` (config + jauge de conso), rôles gestionnaires.
- Tests : 9. `mvn package` BUILD SUCCESS. NON COMMITÉ.
- Écart assumé : les APPELANTS du gate (déclencheurs autonomes posant le bucket SOCLE/PREMIUM_AUTO) = ticket X8 (Kafka/cron) — X4 livre l'enveloppe, X8 la remplit. Panneau UI = incrément frontend (endpoint prêt).

## 2026-07-02 — Exécution X8 (v1) : harnais des runs autonomes (FAIT, vérifié, non commité)

- **`AutonomyRunScope`** : point d'entrée unique des déclencheurs autonomes — `runSocle` (bucket SOCLE posé/nettoyé en finally, débit 0 + coût tracé) ; `runPremium(org, behavior)` applique le gate X4 AVANT d'exécuter (CAPPED/DISABLED → run non parti, décision remontée à l'appelant). Jamais de fuite de bucket inter-runs.
- **Premier câblage** : `BriefingComposer` → `runSocle` — les briefings deviennent de l'autonomie socle réelle de bout en bout (scheduler → handleMessage → metering SOCLE → ledger 0 débit + coût réel). Les 3 buckets sont désormais alimentés.
- Tests : 4 harnais (pose/nettoyage, exception, premium autorisé/plafonné) + 1 metering SOCLE (débit 0, coût 6750 µ$ conservé). `mvn package` BUILD SUCCESS. NON COMMITÉ.
- Écarts assumés : consumer Kafka + sous-flux déterministes multi-agents (« nouvelle résa ») = chantier produit à construire PAR-DESSUS ce harnais (X8-b) ; `runPremium` prêt pour le premier scan proactif (candidat : scan tarifaire supervision).

## 2026-07-02 — Exécution X6 : rolling summary (FAIT, vérifié, non commité)

- **Migration 0300** : `rolling_summary` + `summary_covers_count` sur assistant_conversation.
- **`ConversationSummaryService`** : régénération PARESSEUSE (seuil `rolling-summary.refresh-threshold:10` messages hors-fenêtre depuis le dernier résumé — pas d'appel par tour), tier SMALL (TierModelResolver X3), prompt structuré (objectifs/décisions/préférences/en suspens, ≤150 mots), hors chemin critique (après la réponse, 3 chemins couverts : mono, multi, reprise), best-effort. Flag `clenzy.assistant.rolling-summary.enabled` défaut FALSE.
- **Mapper** : overload `toChatMessages(history, rollingSummary)` — résumé préfixé en tête UNIQUEMENT quand l'historique est effectivement fenêtré. Orchestrateur lit `conversation.getRollingSummary()` au mapping.
- Tests : 2 mapper + 4 service. `mvn package` BUILD SUCCESS (2e run — fix : `target.apiKey()` sur le chemin reprise + refresh manquant au retour mono). NON COMMITÉ.
- **Clôture des leviers tokens Phase 1** : 6 originaux (bc98774e) + L1 routage (T-02) + L2 tiering (T-03) + L3/L4 scoping/vision (T-04) + L5 rolling summary (X6). Reste architecture C (deltas) = Later.

## 2026-07-02 — Exécution X10 : réconciliation double (FAIT, vérifié, non commité)

- **Solde chaud quotidien (05h45, auto-correcteur)** : Redis vs Σ poches par org active, tolérance 1 crédit (réservations en vol), dérive → invalidate + compteur `assistant.credits.balance_drift`.
- **Rapport mensuel (le 2 à 06h00 + `GET /api/ai/credits/reconciliation?month=` SUPER_ADMIN/MANAGER)** : marge par provider (coût réel µ$/débit client mc/tokens — à rapprocher manuellement des factures providers, pas d'API de facturation), revenu par source de poche, **cross-check automatique ledger↔ai_token_usage** (divergence >5 % = warn, fuite de comptage).
- Tests : 4. `mvn package` BUILD SUCCESS. NON COMMITÉ.
- Écarts assumés : rapprochement factures providers = manuel (pas d'API) ; quota embeddings org différé (mécanique de budget du chemin embeddings à investiguer séparément).

## 2026-07-02 — Exécution X7 (v1) : agents V2 Distribution + Maintenance (FAIT, vérifié, non commité)

- **`DistributionSpecialist`** (12e, « distribution ») : sync/attribution/dispo + `TriggerChannelSyncTool` (61e outil) — push calendrier vers tous les canaux via `ChannelSyncService.syncProperty` (tenant-safe par construction : mappings filtrés org), requiresConfirmation=true, candidat naturel Règles de Confiance X2.
- **`MaintenanceSpecialist`** (13e, « maintenance ») : prédiction pannes (historique+IoT), risques, préventif = create_intervention à date future (pas de doublon d'outil), affectation/suivi. Extrait d'operations.
- Scoping : domaine channel += trigger_channel_sync + stem resynchro. Roster : 13 métier + 5 utilitaires.
- `mvn package` BUILD SUCCESS. NON COMMITÉ.
- Écarts assumés (V2-b) : check_rate_parity, open_close_channel_availability, push_listing_content, manage_service_provider = nouveaux services métier requis (chantiers produit, pas des wrappers).
