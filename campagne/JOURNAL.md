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

## 2026-07-02 — Exécution X5 : grille de forfaits crédits en prod (FAIT, vérifié, non commité)

- **Arbitrage utilisateur** : grille campagne §9 validée telle quelle (+9/+29/+79 €/mois essentiel/confort/premium ; dotations 500/2 000/8 000 crédits — déjà les défauts d'AiCreditGrantService T-07 ; packs top-up 12/40/160 € — déjà câblés dans AiCreditPurchaseService).
- **Supplément IA mensuel** : 3 colonnes `ai_surcharge_{essentiel,confort,premium}_cents` sur `pricing_configs` (migration 0301, NULL = défaut code 900/2900/7900), `PricingConfigService.getAiMonthlySurchargeCents(forfait)` (repli essentiel, même logique que la dotation), ajouté au montant Stripe des 3 points de création d'abonnement : InscriptionService (checkout inscription, y compris annuel/bisannuel via computeTotalPriceCents), SubscriptionService (upgrade web), MobilePaymentService (upgrade mobile). Le prix PMS de base reste inchangé (colonne « + IA » additive, conforme §9).
- **Affichage aligné facturation** : `/public/pricing-info` expose les 3 suppléments ; Inscription.tsx ajoute le supplément du forfait sélectionné au prix affiché (= montant Stripe) ; section « Supplément IA par forfait » éditable dans Tarification (TabPMS, i18n fr/en/ar).
- **BYOK taux réduit (ADR-008)** : déjà couvert par T-06b (`clenzy.ai.credits.byok-factor` 0.30 au metering, pas d'exemption dans RunCreditGuard) — rien à faire.
- Tests : 3 PricingConfigService (défauts grille, repli, override DB) + 1 InscriptionService + 1 SubscriptionService (montant Stripe = base + supplément). Vitest Inscription 30 verts, tsc clean.
- Écarts assumés : sous-budget autonomie premium par défaut selon forfait (0/500/2 500, §9) NON câblé — X4 a décidé budget absent = premium désactivé (opt-in), l'activer par défaut serait un changement de comportement de facturation à décider séparément ; `OrganizationBillingService.getBillingSummary` (récap sièges) n'inclut pas le supplément IA (le forfait est porté par le payeur, pas par l'org — à revoir si l'écran billing doit refléter le total exact) ; ⚠️ dès déploiement, toute NOUVELLE inscription/upgrade paie le supplément (les abonnements Stripe existants gardent leur prix).

## 2026-07-02 — Exécution X9 (v1) : Constellation Propriétaire (FAIT, vérifié, non commité)

- **Lien public lecture seule** : `owner_portal_token` (migration 0302, pattern welcome_guide_tokens — UUID unique, expiration ≤730 j défaut 365, révocable), `OwnerConstellationService` (createLink refuse un propriétaire sans bien dans l'org, revoke org-validé, `getPublicView` 404 uniforme token inconnu/expiré/révoqué).
- **Vue publique** `/api/public/owner-constellation/{token}` (sous `/api/public/**` déjà permitAll — zéro toucher à SecurityConfigProd) : nom conciergerie (white-label, aucune mention plateforme), dashboard propriétaire existant (OwnerPortalService, filtre HP-02 org+owner), activité agents par bien (compteurs ACT/SUGGEST 30 j + 10 dernières lignes SupervisionActivity).
- **Front** : page publique `/owner-view/:token` (PublicOwnerConstellation.tsx — KPIs tabular-nums, feed par bien, i18n fr/en/ar) + bouton « Partager le suivi propriétaire » dans OwnerPortalPage (génère + copie le lien) + endpoints de gestion dans OwnerPortalController (create/list/revoke, rôles SUPER_ADMIN/SUPER_MANAGER/HOST).
- **Fix au passage** : le sélecteur « propriétaire » d'OwnerPortalPage passait l'id du BIEN comme ownerId au dashboard/relevé (données fausses dès que les ids divergent) — remplacé par les Property.ownerId distincts (ownerName affiché).
- Tests : 7 (createLink anti cross-org + URL/expiration, revoke cross-org refusé/ok, vue publique 404 uniforme ×2 + scoping biens org). tsc clean.
- Écarts assumés (X9-b) : pas de STOMP/temps réel (conforme D-001 : incrément seulement si multi-client avéré — la page est un GET) ; white-label = nom de la conciergerie seul (logo/couleurs org = colonne branding à créer) ; feed = summaries opérateur SupervisionActivity tels quels (pas de réécriture éditoriale propriétaire) ; pas de section relevé détaillé (le dashboard agrégé suffit au v1, le relevé email OwnerStatementService reste le canal officiel).

## 2026-07-02 — Panneaux UI autonomie : Règles de Confiance + budget premium (FAIT, vérifié, non commité)

- **`AiAutonomySection.tsx`** (Paramètres > IA > Supervision, sous AgentSupervisionSection) branché sur les endpoints X2/X4 existants (`/api/ai/autonomy/trust-rules`, `/api/ai/autonomy/budget`) via `aiAutonomyApi.ts`.
- **Budget premium (X4)** : jauge consommé/plafond du cycle (LinearProgress, seuils 80/100 % en couleurs accent), plafond éditable en crédits (converti mc), select comportement au plafond (NOTIFY_ONLY/PAUSE), toggles de comportements rendus dynamiquement depuis le JSON `behaviors` (aujourd'hui `{}` → hint honnête « aucun comportement premium branché », les clés arriveront avec X8-b).
- **Règles de Confiance (X2)** : table outil/statut/confirmations avec actions par état (SUGGESTED → Accepter/Ignorer, ACTIVE → Révoquer), copy explicite « les actions d'argent ne sont jamais éligibles ».
- i18n fr/en/ar (`aiAutonomy.*`). tsc clean. Front-only (aucun changement backend). NON COMMITÉ.
- Écart assumé : libellés humains des `behaviorKey` à ajouter quand X8-b branchera les premiers comportements (clé i18n `aiAutonomy.behavior.<key>` prévue, repli = clé brute).

## 2026-07-02 — Incident boot dev + fix : beans multi-constructeurs sans @Autowired (FAIT, vérifié, non commité)

- **Incident** : 1er boot réel du lot campagne (rebuild container dev) → crash-loop `AgentRunRecorder.<init>()` introuvable. Cause : Spring exige `@Autowired` explicite dès qu'un bean déclare PLUSIEURS constructeurs (sinon il cherche le no-arg : crash s'il n'existe pas, **bean silencieusement dégradé s'il existe**). Invisible en `mvn package` (la suite ne monte pas le contexte complet).
- **Fixes** : `@Autowired` sur le constructeur Spring d'`AgentRunRecorder` (T-05) et de **`PendingToolStore`** — celui-ci bootait depuis X1 en mode « in-memory only » silencieux (no-arg choisi par Spring : pas d'index Redis ni de journal durable `agent_pending_action`) ; le fix ACTIVE réellement la persistance X1. Les 7 autres suspects (OpenMeteoClient, 4 schedulers, PlatformPromoCodeService, VisionTokenUsageService) étaient déjà annotés (forme qualifiée). WorkflowRegistry/PortfolioPatternRegistry : no-arg = constructeur Spring voulu, annoté explicitement pour lever l'ambiguïté.
- **Garde-fou** : règle ArchUnit `beansMultiConstructeursOntAutowired` (ArchitectureRulesTest) — tout @Component/@Service/@RestController à constructeurs multiples sans @Autowired casse le build.

## 2026-07-02 — Tiering T-03 migré vers la config dynamique en base (FAIT, vérifié, non commité)

- **Décision utilisateur (levée de l'écart T-03 « tiering en properties »)** : plus AUCUNE config modèle en properties Spring — tout passe par le système dynamique existant (platform_ai_model / platform_ai_feature_model, UI Paramètres > IA).
- **Design** : 2 nouvelles valeurs d'`AiFeature` — `ASSISTANT_SMALL` (utilitaires : IntentRouter, rolling summary X6, specialists SMALL) et `ASSISTANT_STRONG` (Insights) — assignables comme n'importe quelle feature dans l'UI existante (zéro table, zéro endpoint, zéro migration ; le probe de dispo quotidien 0281 s'applique automatiquement au modèle tier).
- **`TierModelResolver` réécrit** : lookup `platform_ai_feature_model` (feature du tier) au lieu de la map properties ; signature `resolveModel(tier, provider, contextModel)` INCHANGÉE (IntentRouter, ConversationSummaryService, AbstractAgentSpecialist intacts). Sémantique : non assignée = tiering inactif (fallback strict) ; modèle UNAVAILABLE ignoré ; **garde même-provider conservée** (la clé du contexte — BYOK incluse — est réutilisée, jamais celle du modèle tier ; contexte NVIDIA + tier anthropic → contexte inchangé).
- Flag `clenzy.assistant.tiering.*` SUPPRIMÉ (retiré d'application-dev.yml ; `routing.enabled` reste un flag applicatif). Activation = assigner les modèles aux 2 features en UI.
- Tests : TierModelResolverTest réécrit (7 cas : STANDARD/null, non assigné, assigné même provider SMALL+STRONG, provider différent, provider null→anthropic, UNAVAILABLE, casse). UI : 2 entrées AI_FEATURES (labels fr en dur comme les existants). tsc clean.
- Écart restant : lookup DB par appel tiéré (même profil de coût qu'AiTargetResolver — cache à envisager si ça pèse) ; libellés i18n de la section config plateforme = existant en dur (hors périmètre).
- **Règle même-provider à l'ASSIGNATION (demande user, même session)** : `PlatformAiConfigService.enforceSameProviderForAssistantTiers` — un modèle assigné à ASSISTANT_SMALL/STRONG doit être du provider du modèle/provider ASSISTANT_CHAT (refus 400 explicite, y compris tier sans référence assistant assignée) ; réciproque : passer ASSISTANT_CHAT sur un autre provider exige de désassigner les tiers divergents d'abord ; provider connecté interdit sur un tier (un tier prend un modèle). 5 tests PlatformAiConfigServiceTest. Front : erreurs d'assignation désormais affichées (Alert fermable, message backend) — avant, tout échec d'assignation était silencieux.

## 2026-07-02 — Exécution X9-b : branding white-label (FAIT, vérifié, non commité)

- **Migration 0303** : `branding_logo_url` (500) + `branding_primary_color` (7) sur `organizations`.
- **Backend** : `OwnerConstellationService.getBranding/updateBranding` (logo HTTPS UNIQUEMENT — jamais http/data/javascript sur une page publique —, couleur `#RRGGBB` strict, vide = retiré), endpoints `GET/PUT /api/owner-portal/branding` (rôles du controller), branding inclus dans la vue publique.
- **Front** : dialog « Personnaliser la page propriétaire » dans OwnerPortalPage (2 champs) ; la page publique `/owner-view/:token` affiche le logo en tête et applique la couleur d'accent (bordure du feed). i18n fr/en/ar.
- Tests : 3 (HTTPS/javascript refusés, hex invalide refusé, persist + clear).
- Écart maintenu : STOMP temps réel toujours différé (ADR D-001 : seulement si multi-client avéré).

## 2026-07-02 — Exécution X8-b (v1) : premier comportement premium branché (FAIT, vérifié, non commité)

- **`supervision_scan`** (constante `AiAutonomyBudget.BEHAVIOR_SUPERVISION_SCAN`) : le scan LLM autonome de `SupervisionAutonomousScanner` (3-B.2, kill-switch `clenzy.supervision.autonomous.enabled` inchangé) passe désormais par `AutonomyRunScope.runPremium` — metering bucket PREMIUM_AUTO, gate X4 par scan.
- **Issues du gate** : ALLOWED → scan LLM ; CAPPED_NOTIFY_ONLY → `SupervisionScanService.deterministicScanOnly` (heuristiques analytics seules, 0 LLM, 0 crédit — scénario S4 D-105, les suggestions continuent) ; CAPPED_PAUSE/DISABLED → rien. ⚠️ conséquence produit voulue (opt-in ADR-007) : l'activation du scan autonome exige désormais kill-switch serveur + supervision org + comportement `supervision_scan` coché + plafond > 0 dans le panneau autonomie.
- **Panneau autonomie** : les comportements connus (`KNOWN_BEHAVIOR_KEYS`) s'affichent même absents du JSON org (défaut off) — le toggle `supervision_scan` est donc visible et activable, i18n fr/en/ar.
- Tests : 3 (ALLOWED→LLM, NOTIFY_ONLY→déterministe seul, PAUSE/DISABLED→rien).
- Écarts assumés (X8-c) : consumer Kafka « nouvelle résa » → sous-flux déterministes Java = chantier produit suivant (le marquage dirty event-driven existe déjà via SupervisionTriggerService) ; notification in-app « plafond atteint » = raffinement alertes 80/95/100 % déjà tracé.

## 2026-07-02 — Quota embeddings org (reliquat X10, FAIT, vérifié, non commité)

- **`EmbeddingOrgQuota`** : compteur Redis mensuel atomique par org (script Lua INCR+EXPIRE+DECR, pattern SupervisionScanQuota), `clenzy.ai.embeddings.org-monthly-quota` défaut 20 000 appels/org/mois (≤0 = désactivé). **Fail-open** sur panne Redis (déviation justifiée vs fail-closed des scans : un embedding ≈ 10⁻⁶ $, couper le RAG sur panne d'infra serait pire) ; org null (ingestion admin, probes) = non compté.
- **Branchement** : `KbSearchService.search` (le chemin non borné : auto-RAG à chaque tour user + tool search_knowledge_base) — au plafond : recherche vide (dégradation propre existante), compteur `assistant.embeddings.quota_exceeded{org}` + warn.
- Tests : 1 nouveau (quota atteint → vide sans appel embedding) + suite existante adaptée.
- Écart : l'ingestion admin (IngestionService) n'est pas comptée — volontaire (bornée, déclenchée manuellement par un admin).

## 2026-07-02 — Constat X8-c : le consumer Kafka « nouvelle résa » existait déjà

- `SupervisionCalendarTriggerListener` (topic calendar.updates, actions BOOKED/CANCELLED, consumer group dédié) alimente déjà le marquage dirty → avec le gate X8-b, la chaîne X8 « déclencheurs Kafka de runs autonomes » est COMPLÈTE de bout en bout : Kafka → dirty → scheduler → runPremium(supervision_scan) → scan LLM ou mode dégradé.
- Reste (décisions produit, non improvisées) : sous-flux déterministes métier additionnels à la nouvelle résa (ex. auto-création d'intervention — recouvre partiellement les « interventions automatiques » du forfait) et outils V2-b (nouveaux services métier). À cadrer avec l'utilisateur avant implémentation.

## 2026-07-02 — Exécution L1 (v1) : blackboard de run, architecture C (FAIT, vérifié, non commité)

- **Flag `clenzy.assistant.blackboard.enabled` (défaut FALSE)** : quand actif, les constats des délégations abouties du MÊME run (synthèses tronquées à 400 chars, préfixées `[specialist]`) sont injectés MÉCANIQUEMENT dans le prompt des specialists suivants (section `<prior_findings>`, via `OrchestrationContext.withBlackboardDigest`) — l'orchestrateur reçoit l'instruction de garder des mandats courts (ne plus recopier les synthèses). Gain visé : -40/-60 % sur les runs multi-délégations (le re-collectage et la re-rédaction disparaissent).
- Implémentation minimale et sûre : `OrchestrationContext` +1 composant (constructeur 2-arg conservé, zéro cassure), accumulation locale dans la boucle `doOrchestrate` (pas d'état partagé), `AbstractAgentSpecialist.renderPriorFindingsSection`. Flag off = comportement historique strict (aucun chemin modifié).
- Tests : 4 (digest présent à la 2e délégation + contenu, flag off = jamais de digest, prompt orchestrateur conditionnel, section specialist rendue/absente). Run ciblé 57 verts.
- Écarts assumés (L1-b) : chemin RESUME post-HITL sans digest (l'état blackboard n'est pas persisté dans MultiAgentPendingContext) ; retours « structured output strict » des specialists non imposés (les synthèses texte restent le contrat) ; persistance du blackboard sur agent_step déjà couverte par le recorder (DELEGATION steps).

## 2026-07-02 — Exécution L3 (v1) : what-if replay (FAIT, vérifié, non commité)

- **Migration 0304** : `user_query` VARCHAR(500) sur `agent_run` — la question utilisateur d'origine est capturée au `startRun` (overload 5-arg du recorder, chemin chat uniquement ; reprise/autonome = null).
- **`composeWhatIfPrompt(runId, hypothesis)`** (AgentRunQueryService, org-validé comme le replay) : compose le prompt de re-analyse « demande d'origine + hypothèse » ; refus explicite si hypothèse vide ou run sans question capturée. Endpoint `POST /api/agui/history/{runId}/what-if`.
- **Design volontaire** : AUCUN chemin d'exécution parallèle — le front copie le prompt composé (section « Et si… ? » dans AgentRunReplayDialog, presse-papier) et l'utilisateur l'envoie par le CHAT NORMAL → routage T-02, crédits, HITL s'appliquent naturellement.
- DTO replay + type front : +`userQuery`. i18n fr/en/ar (`agentReplay.whatIf.*`). Tests : 4 (composition, hypothèse vide, run sans question, cross-org).
- Écarts assumés (L3-b) : pas d'exécution «côte à côte» avec diff automatique des deux analyses (le LLM explique les écarts en texte) ; envoi direct dans le chat depuis le dialog (nécessite un pont vers le widget chat) = raffinement UX.

## 2026-07-02 — Exécution L2 (v1) : agents V3 sur outils existants (FAIT, vérifié, non commité)

- **`MarketingSpecialist`** (« marketing », 14e métier) : acquisition par canal (get_channel_attribution), benchmark concurrence, upsells, réputation (analyze/list_reviews), événements locaux, tendance résa — lecture seule, 7 outils EXISTANTS.
- **`GuestScreeningSpecialist`** (« screening », 15e métier) : profil/fiabilité d'un guest sur l'HISTORIQUE INTERNE (list/segment_guests, réservations, avis) — LECTURE SEULE, jamais de recommandation de refus automatique (décision humaine). 6 outils existants.
- Aucun changement ToolScopeSelector (aucun nouvel outil) ; roster : 15 métier + utilitaires.
- **Écarts assumés (L2-b, nouveaux services métier requis — mêmes conclusions que V2-b)** : Conformité/Fiscalité (taxe de séjour, DAC7, registres = AUCUN outil existant, specialist sans substance refusé) ; Stocks/inventaire (aucun outil) ; screening pré-réservation temps réel (BookingFraudScoringService score des signaux de checkout en vol, pas un guest PMS — wrapper inadapté) ; campagnes marketing sortantes.

## 2026-07-02 — Exécution L4 (v1) : instrumentation du benchmark per-outcome (FAIT, vérifié, non commité)

- Le pilote « per-outcome en crédits » est GATÉ par un benchmark (« résolution sans humain >50 % », réf. Maia) et par un ARBITRAGE pricing → on livre la MESURE, pas le pilote.
- **Compteur `assistant.outcome.guest_auto_reply{org, status}`** (GuestChatService, best-effort) : chaque issue de réponse automatique guest (ok / unavailable / rate_limited) — numérateur du taux de résolution.
- Écart assumé (à l'arbitrage L4) : le signal « reprise humaine » (dénominateur exact) n'existe pas côté produit — à définir (ex. message manuel envoyé après une auto-réponse sur la même conversation) avant tout pilote pricing.
- **L5 Stripe Meters : NON DÉCLENCHÉ** (condition « si un plan avec overage apparaît » non remplie — ADR-005 réversible, rien à faire). **L6 petit hôtel : décision produit pure, instruite non engagée — pas de code.**

## 2026-07-02 — Analyse des flux déterministes (arbitrage n°1) : `08-flux-deterministes.md`

- Deux inventaires exhaustifs croisés (sources d'événements / actions métier automatisables).
- **Constat central : le moteur existe déjà** — `AutomationRule`/`AutomationSchedulerService` (org-scopé, conditions JSON) avec les déclencheurs RESERVATION_CONFIRMED / CHECK_IN_APPROACHING / CHECK_IN_DAY / CHECK_OUT_DAY / CHECK_OUT_PASSED / REVIEW_REMINDER et les actions SEND_MESSAGE (câblée) + **SEND_CHECKIN_LINK / SEND_GUIDE / SEND_REVIEW_REQUEST déclarées mais JAMAIS câblées** ; outbox→Kafka calendar.updates (BOOKED/CANCELLED/...) + payment.events + bruit + Nuki ; ~30 schedulers.
- **Catalogue : 9 familles, 24 sous-flux** (F1 nouvelle résa → ménage auto..., F2 annulation, F3 pré-arrivée, F4 départ/avis, F5 relances paiement, F6 bruit, F7 santé IoT, F8 pricing, F9 propriétaire), chacun noté briques/état 🟢🟡🔴/effort/risque.
- **Architecture recommandée : PAS de nouveau moteur** — étendre AutomationRule pour le temporel + 1 consumer Kafka `DeterministicFlowListener` pour l'événementiel immédiat ; pas de saga v1 ; règles transverses (idempotence AutomationExecution, TenantScopedExecutor, timezone propriété, toggles org OFF par défaut, argent = vague 3 HITL).
- **Priorisation proposée : vague 1 = 8 câblages purs 🟢 ; vague 2 = ménage auto post-checkout (LE trou produit) + relances ; vague 3 = flux argent sous HITL.** En attente d'arbitrage utilisateur.

## 2026-07-02 — Vagues 1+2 des flux déterministes : moteur centralisé (3 agents parallèles, intégré, non commité)

- **Décision utilisateur en cours de route : centralisation totale** — le moteur AutomationRule devient LE registre des automatisations déterministes. Capteurs minces (webhooks/consumers/crons → `AutomationEngine.fireTrigger(trigger, org, sujet)`) ; exécuteurs en SPI Spring (`AutomationActionExecutor` → `ExecutionResult` executed/skipped, registre fail-fast) ; **opt-in org = existence d'une règle active** (plus aucun flag serveur) ; idempotence moteur généralisée (règle × subjectType × subjectId, migration 0305) pour les triggers ONE-SHOT (`dedupePerSubject`), clés métier pour les récurrents.
- **Enums enrichis** : +8 triggers (RESERVATION_BOOKED/CANCELLED, NOISE_ALERT, LOCK_BATTERY_CRITICAL, PAYMENT_FAILED, INVOICE_OVERDUE, PAYOUT_PENDING_REMINDER, OWNER_MONTHLY_STATEMENT), +7 actions (CREATE_CLEANING_REQUEST, CANCEL_LINKED_CLEANING_REQUEST, CREATE_MAINTENANCE_INTERVENTION, SEND_INVOICE_REMINDER, NOTIFY_STAFF, SEND_OWNER_STATEMENT, SEND_NOISE_WARNING).
- **Vague 1 livrée** : SEND_GUIDE/SEND_CHECKIN_LINK/SEND_REVIEW_REQUEST enfin câblées (SEND_CHECKIN_LINK était marquée EXECUTED sans rien envoyer — bug corrigé) ; relance avis J+X seulement si aucun avis (2 chemins de détection) ; sweep CHECK_IN_APPROACHING J-X (fenêtres bornées, fuseau du logement) ; relevé propriétaire mensuel (cron 1er du mois + claim par mois) ; relance payout >7 j (CAS `approval_reminder_sent_at`) ; batterie serrure critique → intervention préventive (marqueur d'épisode) ; paiement échoué → NOTIFY_STAFF (capteur dédié hors controller, règle ArchUnit).
- **Vague 2 livrée** : `DeterministicFlowListener` (calendar.updates, groupe clenzy-deterministic-flows) → ménage auto post-checkout (gate `cleaningFrequency=AFTER_EACH_STAY` — PAS de valeur AFTER_CHECKOUT, heure = defaultCheckOutTime propriété, clé unique `AUTO_CLEANING:prop:in:out` + catch course, annulation sur CANCELLED avec libération de clé, filet quotidien 6h30) ; relances factures J+3/J+7 max 2 (compteur en base 0308, HTML échappé, sans email = consommée + notif staff) ; bruit → message guest (WhatsApp template Meta sinon email, claim Redis 24 h partagé avec le chemin historique) ; NoiseAlertService fireTrigger APRÈS COMMIT (subjectId = ID d'alerte, data alertsLast24h pour l'escalade).
- **Intégration coordinateur** : master changelog 0305→0308 ; fix visibilité MAX_REMINDERS ; 3 tests corrigés (2 tests moteur écrits avant le raffinement dédup-par-trigger + AiTokenBudget 9→11 features, rendu robuste `AiFeature.values().length`). ⚠️ Leçon : `mvn ... | tail` masquait l'exit code — les 2-3 builds précédents « verts » ne l'étaient pas forcément (le test budget échouait depuis l'ajout des features tiering) ; désormais MVN_EXIT_CODE écrit dans le log. Un 4e test rattrapé par ce durcissement : whenChatMovesToOtherProviderWithTierAssigned (règle même-provider, stub STRONG manquant → lenient) — il n'avait jamais réellement passé. Build final : 12 211 tests, MVN_EXIT_CODE=0.
- **Écarts assumés / reste à faire** : F6b escalade bruit = règle recommandée (NOISE_ALERT + condition alertsLast24h>=3 → NOTIFY_STAFF + CREATE_MAINTENANCE_INTERVENTION) mais 2 trous : conditions numériques sur data non supportées par AutomationConditionEvaluator, et CreateMaintenanceInterventionExecutor limité au sujet SMART_LOCK_DEVICE ; clé NotificationKey INVOICE_OVERDUE_REMINDER à créer (PAYMENT_DEFERRED_OVERDUE utilisée en attendant) ; UI de l'écran de règles à enrichir des nouveaux triggers/actions (libellés) ; vague 3 (argent) toujours en attente d'arbitrage HITL.
- 6 règles recommandées à seeder à l'activation (voir rapport agent C au journal des tasks).

## 2026-07-02 — Vague 3 + F7b : flux argent HITL (FAIT, intégré, build vert, non commité)

- **Arbitrage utilisateur appliqué** : cautions = SUGGESTIONS HITL uniquement (jamais d'argent auto) ; révocation code = AUTO à check-out + délai de grâce ; blocage calendrier = suggestion seule ; yield F8a différé en chantier dédié.
- **Livré** (agent vague 3, repris après 2 décrochages de stream — travail intact sur disque, rapport final perdu, complétude vérifiée par build) :
  - `SuggestDepositRefundExecutor` (RESERVATION_CANCELLED) + `SuggestDepositReleaseExecutor` (CHECK_OUT_PASSED J+2) via `AbstractDepositSuggestionExecutor` → suggestions actionnables SupervisionSuggestionService ; l'apply RE-calcule le montant côté serveur (règle absolue n°1), Stripe hors transaction, idempotent.
  - `RevokeAccessCodeExecutor` : auto à check-out + graceHours (défaut 4, configurable par règle via **`automation_rules.action_config` JSONB — migration 0309**), fuseau propriété.
  - `SuggestCalendarBlockExecutor` : escalade bruit → suggestion « bloquer le calendrier » ; l'apply appelle CalendarEngine.block. Jamais auto.
  - **Trous F6b fermés** : AutomationConditionEvaluator supporte les conditions NUMÉRIQUES sur les data du sujet (gte/lte/eq — alertsLast24h, daysOverdue) ; CreateMaintenanceInterventionExecutor étendu au sujet bruit/propriété.
  - **F7b (reliquat vague 1)** : trigger `IOT_DEVICE_OFFLINE` (Minut device_offline → fireTrigger, mince) → NOTIFY_STAFF.
- **Intégration coordinateur** : master changelog 0309 ; AutomationRuleDtoTest complété (champ actionConfig — le test que l'agent terminait à son décrochage). Build final : MVN_EXIT_CODE=0.
- **CLÔTURE F1→F9** : catalogue de 08-flux-deterministes.md intégralement traité — vagues 1+2+3 implémentées dans le moteur central, F8a différé (arbitrage), F1c volontairement non fait (couvert par F3c). Écarts fins restants : libellés UI des nouveaux triggers/actions dans l'écran de règles, clé NotificationKey INVOICE_OVERDUE_REMINDER dédiée, seed des ~10 règles recommandées à l'activation.

## 2026-07-03 — Chantier tests T1+T2 (stratégie 09-strategie-tests.md) : FAIT, 4 BUGS PROD RÉELS trouvés

- **T1 (socle + registre central)** : les 8 ITs historiques étaient `@Disabled` DEPUIS TOUJOURS — réactivés sous gate `CLENZY_IT=true` (`IntegrationTestGate` ExecutionCondition — @EnabledIfEnvironmentVariable n'est pas hérité), premier run réel de leur histoire : 32/32 verts. Nouveaux : ApplicationBootIT (contexte COMPLET — couvre le bug @Autowired), LiquibaseMigrationIT (validation + cross-check référentiel des tables ciblées par ALTER/INDEX — aurait bloqué 0249/0251), AutomationEngineIT (5 tests : dédup one-shot/récurrent, SKIPPED persisté, condition numérique, cross-org refusé), KafkaFlowIT (broker réel, payload exact CalendarEngine, redelivery = 1 seule exécution). Fixes d'infra de test : image pgvector/pg15, kafka.enabled=false socle, hibernate.validator.apply_to_ddl=false (le commentaire de User.java affirmant l'inverse est FAUX).
- **T2 (Constellation + scénarios)** : testkit `ScriptedChatLLMProvider` (LLM scripté zéro token, capture des ChatRequest) + `MutableClock` ; MultiAgentOrchestrationIT (délégation → tool réel sur base réelle, agent_run/steps au token près, blackboard L1 prouvé, pont markDirty) ; 5 scénarios golden-path (16 tests verts) : cycle résa Pacific/Auckland (ménage/avis/révocation +4h/caution J+2), bruit (1 seul message + escalade + blocage réel), factures (jamais de 3e relance), routage+tiering (modèle tier vérifié sur la requête capturée), Constellation Propriétaire (anti-fuite, révocation).
- **4 BUGS DE PRODUCTION RÉELS corrigés** :
  1. `DeterministicFlowListener` ET `SupervisionCalendarTriggerListener` n'ont JAMAIS traité un événement (@KafkaListener Object = ConsumerRecord entier, rejeté en silence par coerceToMap) — tout l'événementiel BOOKED/CANCELLED→moteur et le markDirty supervision étaient morts ; unwrap ConsumerRecord (pattern ChannelSyncService qui l'avait déjà).
  2. Fuite cross-org des tools assistant : `PropertyService.search()` reposait sur le @Filter Hibernate JAMAIS actif sur le thread sseExecutor → un HOST voyait les biens de toutes les orgs via list_properties. Garde org fail-closed (bypass platform staff). Trou jumeau `searchWithManagers` corrigé par le coordinateur.
  3. Écritures du moteur perdues post-commit (NoiseAlertService : fireTrigger @Transactional REQUIRED dans afterCommit rejoint la tx commitée) → REQUIRES_NEW via TransactionTemplate.
  4. (Couverture) ApplicationBootIT gèle le bug @Autowired multi-constructeurs.
- **ÉCART STRUCTUREL MAJEUR découvert** : le replay 0001→0309 sur base VIERGE est impossible — le schéma initial de l'ère Flyway V1 (créé par ddl-auto=update historique) n'existe dans aucun changeset (`relation "users" does not exist` dès 0001). La prod ne tient que par le changelog-sync. Conséquence : aucun environnement neuf (DR, staging vierge) provisionnable depuis le repo. **Chantier recommandé : changeset 0000-baseline préconditionné (MARK_RAN si users existe).**
- Prérequis machine ITs : TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock + ~/.testcontainers.properties + ~/.docker-java.properties (api 1.43). Reste (T3, non lancé) : complétude SPI, pannes Redis 2 sémantiques, double webhook signé, concurrence, CI nightly ; compléments S4 crédits/what-if + S5 autonomie premium ; PropertyService.list()/list(pageable) sans garde org (aucun appelant controller trouvé — à traiter au chantier baseline sécurité).

## 2026-07-03 — Chantier 0000-baseline Liquibase + vague T3 : FAITS (5e bug prod), non commité

- **Baseline (décision user : rester Liquibase)** : `0000__baseline_schema.sql` (~2400 lignes, 72 tables jamais créées par aucun changeset — schéma Hibernate MOINS les 94 ajouts ultérieurs, PLUS colonnes legacy V1 + pgcrypto) en 1re position du master avec précondition `onFail: MARK_RAN` si `users` existe. **3 changesets historiques révisés** (0006 métacommande psql/drops impossibles, 0027 colonne manquante, 0050 portal pgjdbc) protégés par `validCheckSum: "1:any"` — déjà appliqués partout via changelog-sync, aucun impact boot prod (testé). `0310__backfill_ddl_auto_drift_columns.sql` : 18 colonnes de dérive ddl-auto recréées défensivement. **Preuves** : `LiquibaseVirginReplayIT` — replay INTÉGRAL 0000→0310 sur Postgres vierge + validation Hibernate de toutes les entités VERT ; chemin MARK_RAN VERT ; corruption de checksum absorbée VERT. Un environnement neuf (DR/staging) est désormais provisionnable depuis le repo. ⚠️ **PR future : le check CI immutable-changesets exigera `[liquibase-allow-modify]` dans le titre** (3 fichiers historiques touchés, cas documenté).
- **T3 durcissement** : complétude SPI (15 actions/exécuteurs, orphelin=échec), pannes Redis 2 sémantiques (fail-closed scan / fail-open embeddings / repli base bruit — container dédié stoppé), webhooks Stripe signés rejoués (1 seule dotation, signature falsifiée=400), concurrence 2 threads (1 seule SR/exécution), S4 crédits (DEBIT ledger exact, hard cap refuse avant LLM, replay/what-if cross-org refusés), S5 autonomie premium (PREMIUM_AUTO au ledger, CAPPED sans exécution, scanner dégradé), CI nightly `it-nightly.yml` (séparé, cron 02:30+dispatch). Passe finale : 90 tests verts.
- **5e BUG PROD (concurrence)** : le catch DataIntegrityViolation du ménage auto était MORT (save participant → rollback-only → UnexpectedRollbackException au commit pour le perdant). Fix : `pg_advisory_xact_lock(hashtext(key))` AVANT le check d'existence (ServiceRequestRepository.acquireAutoFlowKeyLock). Même pattern mort dans SendOwnerStatementExecutor signalé en tâche séparée.
- Écart T3 documenté : l'index 0305 est non-unique PAR DESIGN (récurrents multi-lignes) — l'invariant de concurrence est la clé métier 0307.

## 2026-07-03 — Arbitrages produit + 5 chantiers post-campagne (5 agents parallèles, intégrés, non commité)

- **Arbitrages utilisateur (figés dans 10-arbitrages-produit.md)** : per-outcome = reprise humaine sous **24 h** (mesure 30 j avant tout pilote) ; services métier = **S1 taxe de séjour + S2 rate parity + S3 open/close par canal** (S4 stocks / S5 payouts / S6 DAC7 différés) ; yield v1 = **3 modes progressifs** SIMULATION→SUGGEST→AUTO borné, baisse ET hausse. Préalable commité séparément (4226dff2) : plafond d'autonomie premium PAR FORFAIT (0/500/2500) quand pas de config explicite.
- **Per-outcome (L4 dénominateur)** : `AssistantOutcomeTracker` — marqueur Redis `assistant:outcome:autoreply:{org}:{resa}` TTL 24 h posé à chaque auto-réponse OK du chat guest (GuestChatService), compteur `assistant.outcome.manual_takeover{org}` incrémenté au premier envoi MANUEL (ConversationService.sendOutboundMessage, unique appelant = POST /api/conversations/{id}/messages ; les envois automatiques passent par d'autres chemins, vérifié). DEL Redis atomique = une reprise par auto-réponse, panne Redis fail-open (métrique non critique). Zéro migration.
- **S1 taxe de séjour (0311)** : socle existant DÉCOUVERT (tourist_tax_configs servait déjà le booking engine) → étendu sans big-bang : barème par défaut d'org (property_id nullable), plafond « au réel » PERCENTAGE, surtaxes départementale/régionale, exempt_minors (sans effet v1 : Reservation ne ventile pas adultes/enfants, documenté), index uniques partiels anti check-then-act. `computeForReservation/Period` (HALF_UP, compareTo), report JSON + export CSV (BOM, anti-injection), tool read-only `compute_tourist_tax`, 7e onglet Tarification. `calculate()` historique du checkout public GELÉ (totaux inchangés). 24 tests.
- **S2 rate parity** : Channex n'a PAS de prix par canal (les OTAs consomment le rate plan) → comparaison prix local résolu vs rate plan (fetchRatesForRange existant), déclinée par canal OTA actif. `RateParityService` (seuil 2 % configurable), sensor cron 07:45 branché MOTEUR CENTRAL (trigger récurrent `RATE_PARITY_DISPARITY`, opt-in = règle active, skip PriceSourceOfTruth.OTA) → `NotifyRateParityExecutor` (clé métier bien+jour, NotificationKey réutilisée CHANNEX_PRICE_DRIFT_DETECTED), tool read-only `check_rate_parity`. Zéro migration. 23 tests (dont complétude SPI).
- **S3 open/close par canal** : Channex sans stop-sell par canal (deactivateChannel = tout-ou-rien non daté) → implémenté sur les CONNEXIONS DIRECTES : `ChannelConnector.pushAvailabilityClosure` (défaut UNSUPPORTED) implémenté Airbnb (jour par jour) + Booking (XML OTA) ; close = available=false forcé sur LE canal, open = re-push de la vérité CalendarEngine ; aucun état local (idempotent, zéro migration). `ChannelAvailabilityService` (org guard, canal connecté, ≤365 j, HTTP hors transaction) + tool write à CONFIRMATION `open_close_channel_availability`. iCal/Channex → UNSUPPORTED propre. 21 tests.
- **Yield v1 (F8a clos — 0312/0313)** : table `yield_rules` RÉUTILISÉE (+5 colonnes, ancien moteur inerte, zéro DROP) ; `yield_org_configs` = kill-switch OFF par défaut + mode PAR ORG ; bornes `yield_price_floor/ceiling` sur properties (sans les DEUX → skip NO_BOUNDS) ; journal `yield_adjustments` (replay) avec index unique partiel « un APPLIED par bien/jour » (course → rollback REQUIRES_NEW + skip DAILY_CAP). SIMULATION = journal seul ; SUGGEST = SupervisionSuggestionService (apply RE-résout prix + re-vérifie bornes/cap, jamais par-dessus MANUAL/OTA) ; AUTO = RateOverride source YIELD_RULE borné. Scheduler 04:40 (TenantScopedExecutor, Clock). API /api/yield + onglet Yield dans DynamicPricing. 15+16 tests.
- **Intégration coordinateur** : master changelog 0311/0312/0313 ; merge i18n (113 clés × fr/en/ar, zéro conflit) ; câblage tools : ToolScopeSelector domaine pricing (+compute_tourist_tax, check_rate_parity, stems taxe/parite/disparite — « sejour » écarté, leçon T-04) + domaine canaux (+open_close_channel_availability, check_rate_parity) ; DistributionSpecialist 5→7 tools (≤10 OK).
- **Écarts assumés** : exempt_minors inopérant v1 ; checkout public sans plafond/surtaxes (aligner un jour) ; Reservation.touristTaxAmount non alimenté ; parité mono-rate-plan (défaut du mapping) ; fermeture par canal impossible pour les biens routés Channex (limite plateforme) ; UI écran de règles à enrichir des libellés RATE_PARITY_DISPARITY/NOTIFY_RATE_PARITY ; dashboard Grafana manual_takeover à créer.

## 2026-07-03 — Ventilation adultes/enfants de bout en bout (0314, non commité)

- **Motivation** : le champ `exemptMinors` de la taxe de séjour (0311) était sans effet car `Reservation` ne stockait qu'un total (`guestCount`). La taxe française n'est due que par les adultes.
- **Design non-régressif** : 2 colonnes NULLABLES `adults_count`/`children_count` (migration 0314, pas de backfill). `Reservation.taxablePersons(exemptMinors)` = adultes seuls si ventilation connue ET exonération active, sinon repli sur `guestCount`. `guestCount` reste le total autoritaire. Conséquence : zéro régression (adultsCount null → comportement historique ; enfants=0 → adultes=total → taxe inchangée) ; la taxe ne baisse que quand la ventilation est réellement connue.
- **Constat clé** : les DTOs OTA reçoivent DÉJÀ la ventilation. Câblés (chemins qui persistent réellement) : **Channex** (occupancy adults/children+infants, 2 sites) et **Direct** (adultes = numberOfGuests − numberOfChildren). Airbnb/iCal → NULL (total seul). **HomeAway et Expedia sont des STUBS** (création de résa commentée) → rien à câbler.
- **Capture UI ajoutée** : formulaire PMS `ReservationFormDialog` (champ « dont enfants (mineurs) », adultes = total − enfants) ; **le SDK widget booking suivait déjà `adults`/`children` séparément** — il suffisait d'ajouter `children` au payload reserve/reserve-batch (BaitlyWidget + api.ts + CartStay + mountPrimitive). Saisie manuelle : ReservationMapper + CreateReservationTool (args + schéma JSON) + ReservationDto (+2 champs).
- **Fiscal** : `TouristTaxService` bascule sur `taxablePersons(exemptMinors)` ; javadoc corrigé (le commentaire « sans effet » était désormais un bug-commentaire).
- **Migration** : 0314 (ALTER ADD COLUMN IF NOT EXISTS, nullable), enregistrée au master changelog.
- **Vérif** : 3 nouveaux tests TouristTaxService (repli / adultes seuls / exonération off), ReservationMapperTest round-trip significatif (agent), ~42 constructions positionnelles de tests réparées (agent, +null). tsc frontend vert. mvn package complet en cours.
- **Écarts** : `PlanningQuickCreateDialog` (création rapide planning) non modifié — le module planning a du WIP utilisateur non commité ; à câbler en suivi. `childrenExemptUnder` (âge) reste indicatif (on fait confiance à la ventilation saisie/importée, pas de calcul par date de naissance).

## 2026-07-03 — Réconciliation taxe de séjour : source unique tourist_tax_configs (non commité)

- **Constat (question user sur l'écran Réglages > Fiscal)** : DEUX systèmes fiscaux coexistaient. (A) `TaxRule`/`FiscalEngine` (« Règles fiscales », 3 pays) = taux % — parfait pour la TVA (utilisée), mais la ligne `TOURIST_TAX` FR/MA était un placeholder 0 % (un % ne peut pas porter un montant fixe par commune) et le calculateur France ignore cette règle pour la taxe de séjour. (B) `tourist_tax_configs` (S1) = barème par bien fixe/%/plafonné + surtaxes + exonération mineurs, déjà utilisé par le booking engine.
- **Nuance découverte** : l'Arabie Saoudite (`SA`) a un VRAI 5 % (municipality fee) dans `TaxRule`, utilisé par `SaudiTaxCalculator` → supprimer `TOURIST_TAX` de `TaxRule` aurait CASSÉ l'Arabie Saoudite. Option 1 appliquée en version NON-RÉGRESSIVE.
- **Fait** : `InvoiceGeneratorService.addTouristTaxLine` utilise désormais `TouristTaxService.computeForReservation` (config par bien) comme source PRIMAIRE ; repli sur le taux manuel/`FiscalEngine` (préserve SA % et le flux de facturation manuel). `tourist_tax_configs` devient donc la source unique du MONTANT de taxe de séjour partout où il est calculé (booking + facture), avec le %-path en repli. Mock Mockito `TouristTaxService` → `Optional.empty()` par défaut → aucune régression des tests de facture existants.
- **Non fait (délibéré)** : pas de suppression des seeds `TaxRule` TOURIST_TAX (SA légitime, repli FR/MA inoffensif) ; pas de retrait de la catégorie de l'écran Règles fiscales (permettrait encore d'éditer le 5 % SA). Amélioration UX possible en suivi : indice « Montant géré dans Tarification > Taxe de séjour » sur la ligne TOURIST_TAX FR/MA.
- **Vérif** : InvoiceGeneratorServiceTest + TouristTaxServiceTest verts ; mvn package complet en cours.

## 2026-07-03 — Consolidation taxe de séjour : un seul système, dans Réglages > Fiscal (non commité)

- **Découverte (contredit une hypothèse antérieure)** : `TaxCategory.TOURIST_TAX` n'est lu par AUCUN calculateur fiscal — le 5 % saoudien est CODÉ EN DUR dans `SaudiTaxCalculator`, pas dans une `TaxRule`. La ligne « Taxe de séjour » de l'écran Règles fiscales était donc 100 % cosmétique (retrait sans risque). `TaxRule` = plateforme-global (pas d'org) ; `TouristTaxConfig` = org-scopé, porte déjà `commune_name/code` + 3 modes (fixe/%/forfait).
- **Arbitrage user** : la config taxe de séjour vit désormais dans **Réglages > Fiscal**, gérée par le **staff plateforme uniquement** (l'onglet Fiscal est déjà réservé SUPER_ADMIN/SUPER_MANAGER).
- **Fait** :
  - Backend : `TouristTaxController` resserré à `hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')` (retrait HOST, aligné sur la décision). Migration `0315__remove_tourist_tax_from_tax_rules.sql` : `DELETE FROM tax_rules WHERE tax_category='TOURIST_TAX'` (lignes cosmétiques, rien ne les lisait) + master changelog.
  - Frontend : `TabTaxeSejour`/`TouristTaxBaremeDialog` déplacés `modules/tarification/` → `modules/settings/` (même profondeur → imports relatifs inchangés), composant renommé `TouristTaxSection` ; monté dans le TabPanel Fiscal de `Settings.tsx` après `TaxRulesSection` ; onglet « Taxe de séjour » retiré de `Tarification.tsx` (TAB_DEFS, render, meta, exclusion save, imports TabTaxeSejour+Gavel) ; `TAX_CATEGORIES` (taxRulesApi) et maps de `TaxRulesSection` purgés de `TOURIST_TAX` + filtre défensif sur la liste (env pas encore migrés) + import `LocationCity` retiré.
- **Résultat** : une SEULE source de taxe de séjour (`tourist_tax_configs`), un SEUL écran (Réglages > Fiscal), l'écran Règles fiscales redevient purement TVA. La réconciliation facturation (config primaire) de l'étape précédente reste en place.
- **Vérif** : tsc vert ; mvn package complet en cours.
- **Écart** : clé i18n `tarification.tabs.taxeSejour` désormais inutilisée (laissée dans les locales, inoffensive).

## 2026-07-03 — Chantier A : écran de règles d'automatisation enrichi (16 triggers / 16 actions) — non commité

- **Constat** : le moteur central (`AutomationEvaluationService implements AutomationEngine`) connaît 16 déclencheurs + 16 actions, mais l'UI (`AutomationRulesPage`) n'exposait que 6 déclencheurs « cycle de vie » + 4 actions messaging. Backend déjà OK : `CreateAutomationRuleRequest`/`AutomationRuleDto` portent `actionConfig`, `AutomationRuleService` le persiste, aucune validation restrictive sur les enums → **chantier 100 % frontend**.
- **Fait** (frontend only) :
  - `automationRulesApi.ts` : types `AutomationTrigger` (6→16) et `AutomationAction` (4→16) ; `actionConfig` ajouté à `AutomationRule`+`CreateAutomationRuleData` ; `TRIGGER_LABELS`/`ACTION_LABELS` complets ; métadonnées `LIFECYCLE_TRIGGERS`/`isLifecycleTrigger`, `TRIGGER_GROUPS` (Cycle de vie / Événements), `MESSAGING_ACTIONS`/`isMessagingAction`/`actionNeedsTemplate`, `TRIGGER_ACTIONS` (actions recommandées par déclencheur pour éviter les combinaisons vides — les executors attendent un sujet cohérent), helpers `graceHours` (parse/stringify action_config).
  - `AutomationRulesPage.tsx` : sélecteur de déclencheur GROUPÉ (ListSubheader), sélecteur d'action FILTRÉ par `TRIGGER_ACTIONS[trigger]` (+ union avec l'action courante en édition), `handleTriggerChange` recadre l'action et remet le décalage à 0 pour les événementiels. Champs CONDITIONNELS : décalage/heure (cycle de vie only), canal (messaging only), template (SEND_MESSAGE only), délai de grâce `graceHours` (REVOKE_ACCESS_CODE only). Tableau : chip d'action ajouté, chips décalage/heure/canal masqués quand hors sujet. `actionConfig` câblé create+edit. Constantes mortes `TRIGGER_OPTIONS`/`ACTION_OPTIONS` retirées.
- **Écart assumé** : labels en FR en dur (cohérent avec le reste de la page, entièrement FR-hardcodé) — l'i18n complet de l'écran automation serait une passe séparée ; les conditions numériques par sujet (bruit alertsLast24h≥3, facture daysOverdue) restent hors périmètre de A (ConditionsEditor inchangé : propertyIds/minNights/maxNights/guestLanguage).
- **Vérif** : tsc vert, aucun test référençant l'ancienne structure. **Suite = chantier B** (seeder les règles recommandées).

## 2026-07-03 — Entrée de menu Automatisations + chantier B (règles recommandées) — non commité

- **Constat** : la route `/automation-rules` (garde `settings:view`) n'était liée à AUCUN élément de menu → écran invisible.
- **Entrée de menu** (section admin/réglages) : item autonome « Automatisations » (icône Bolt=Zap) ajouté au groupe `admin` de `useNavigationMenu` juste après « Paramètres » ; + `STANDALONE_SCREENS` (navigationHubs) + `SCREEN_ICON` (HubScreenSwitcher) pour la cohérence d'en-tête ; i18n `navigation.automationRules` fr/en/ar. (Pas de nouveau hub : item dans la section existante, design 9-hubs préservé.)
- **Chantier B — seed des règles recommandées** (le moteur démarrait vide) :
  - Backend : `AutomationRuleService.seedRecommended()` **idempotent** (skip si couple trigger+action déjà présent), endpoint `POST /api/automation-rules/seed-recommended`. Jeu SÛR de 7 règles, toutes `enabled=true` (opt-in explicite = clic bouton), **sans doublon ni argent-auto** : NOISE_ALERT/PAYMENT_FAILED/IOT_DEVICE_OFFLINE→NOTIFY_STAFF, LOCK_BATTERY_CRITICAL→CREATE_MAINTENANCE_INTERVENTION, INVOICE_OVERDUE→SEND_INVOICE_REMINDER (borné 2), RESERVATION_CANCELLED→SUGGEST_DEPOSIT_REFUND (HITL), CHECK_OUT_PASSED J+2→SUGGEST_DEPOSIT_RELEASE (HITL). **Ménage exclu délibérément** (déjà généré par le flux réservation → risque de doublon) ; **envois guests exclus** (dépendants d'un template).
  - Frontend : `automationRulesApi.seedRecommended()` + hook `useSeedRecommendedRules` + boutons « Activer les règles recommandées » (en-tête secondaire + CTA principal de l'état vide), i18n `automation.seedRecommended` fr/en/ar.
- **Vérif** : tsc vert ; mvn package complet en cours. **Suite possible** : ménage auto en règle (après vérif de non-doublon avec le flux réservation), conditions numériques par sujet dans ConditionsEditor, i18n complet de la page automation.

## 2026-07-03 — Consolidation messagerie invité dans le hub (option 1, source unique) — non commité

- **Décision user** : transférer la messagerie check-in/check-out du système legacy (`MessagingAutomationConfig` + `GuestMessagingScheduler`, en dur) vers le hub d'automatisation → une seule source de vérité.
- **Sûreté du mapping** : le scheduler legacy envoyait déjà « jour J » dans le fuseau du logement (les champs `hours_before_*` étaient MORTS, commentaire à l'appui) → mappe exactement sur `CHECK_IN_DAY` / `CHECK_OUT_DAY` (offset 0). Le hub réutilise le MÊME `GuestMessagingService` + les MÊMES `MessageTemplate` ; slicing fuseau jour-J assuré par `evaluateRulesForReservation` ; idempotence par dédup moteur (CHECK_IN/OUT_DAY = dedupePerSubject).
- **Fait** :
  - Migration `0316__migrate_guest_messaging_to_automation_rules.sql` : transforme la config active en règles hub (CHECK_IN_DAY/CHECK_OUT_DAY + SEND_MESSAGE + template + enabled), **idempotent** (NOT EXISTS), puis remet `auto_send_*` à false (coupe l'ancien chemin). `id` IDENTITY → auto. CHECK constraints baseline couvrent ces valeurs (et 0274 les drop).
  - Suppression de `GuestMessagingScheduler.java` + `GuestMessagingSchedulerTest.java` (le hub est l'unique émetteur ; migration + suppression dans le MÊME lot = pas de fenêtre de double envoi ni de no-send). Commentaires nettoyés (ReservationRepository, AutoAssignScheduler, AutomationSchedulerService).
  - `MessagingAutomationConfig` entité + endpoint + `PricingPushScheduler` CONSERVÉS (`autoPushPricingEnabled` = concern pricing, UI ailleurs). Champs messagerie devenus vestigiaux (laissés, inoffensifs).
  - Front : `Settings.tsx` onglet Messagerie — section legacy retirée, remplacée par un renvoi vers `/automation-rules` (i18n `messaging.automation.moved*`) ; `MessagingAutomationSection.tsx` SUPPRIMÉ ; `MessagingAutomationStatus.tsx` (panneau planning) REPOINTÉ sur le hub (règle active de messagerie sur déclencheur arrivée/départ) + renvoi vers Automatisations.
- **Écart mineur** : la notif admin « email voyageur manquant » du scheduler legacy n'est pas répliquée dans l'executor hub (l'envoi échoué apparaît en exécution FAILED dans la règle) — acceptable.
- **Vérif** : tsc vert ; mvn package en cours.

## 2026-07-03 — Automatisations « système » (hors hub) en lecture seule dans le hub — non commité

- **Demande user** : voir dans le hub, en LECTURE SEULE, les automatisations câblées hors hub (code / autre mécanisme), avec leur statut réel (effectif ou non), calculé depuis l'existant du code — pas des lignes en dur.
- **Backend** : `SystemAutomationService.listForCurrentOrg()` calcule le statut EFFECTIF par org depuis l'état réel (aucun booléen codé en dur) :
  - Relance panier abandonné → `clenzy.booking.cart-recovery.enabled` (@Value global) **ET** `Organization.abandonedCartRecoveryEnabled` → ACTIVE/INACTIVE.
  - Push tarifaire → `MessagingAutomationConfig.autoPushPricingEnabled` de l'org → ACTIVE/INACTIVE.
  - Livraison code d'accès (flux serrure) + Lien de paiement (flux paiement) → TRANSACTIONAL (chemin toujours vivant, déclenché à l'événement).
  - Rotation code d'accès → OPT_IN (activable par logement).
  - DTO `SystemAutomationDto` (key/label/description/trigger/action/effective/status/statusLabel/mechanism), endpoint `GET /api/automation-rules/system`.
- **Frontend** : hook `useSystemAutomations` + section « Automatisations système » (lecture seule, sous la liste des règles) — cartes non éditables, chip de statut coloré par `status` (ACTIVE=ok, INACTIVE=muted, TRANSACTIONAL/OPT_IN=info), i18n `automation.system.*` fr/en/ar.
- **Cohérence** : statut recalculé à chaque appel depuis les flags/config réels ; si un flag change, la ligne change. Extensible (ajouter une entrée = brancher sa vraie source de statut). Legacy check-in/check-out NON listé (désormais dans le hub via migration 0316).
- **Vérif** : tsc vert ; mvn package en cours.

## 2026-07-03 — Règles recommandées auto-activées + écran org en lecture seule (plateforme édite) — non commité

- **Décisions user** : (1) les règles recommandées sont ACTIVES PAR DÉFAUT (plus de bouton) ; (2) les orgs (HOST) voient l'écran en LECTURE SEULE, seule la plateforme (SUPER_ADMIN/SUPER_MANAGER) peut modifier/créer.
- **Auto-seed** :
  - `AutomationRuleService.seedRecommended()` → `seedRecommendedForOrg(Long orgId)` (pur, retourne le nb créé, idempotent).
  - Nouvelles orgs : `OrganizationService.createForUser` + `createStandalone` appellent `seedRecommendedForOrg(org.getId())` après save.
  - Orgs existantes : migration `0317__seed_recommended_automation_rules.sql` (INSERT…SELECT organizations × 7 règles VALUES, NOT EXISTS, idempotent ; CHECK constraints couvrent les valeurs, 0274 les drop). Endpoint `POST /seed-recommended` + bouton + hook `useSeedRecommendedRules` SUPPRIMÉS.
- **Contrôle d'accès** :
  - Backend : `AutomationRuleController` — reads `isAuthenticated()` (org-scopé), writes (`POST`/`PUT`/`DELETE`/`toggle`) `@PreAuthorize hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')`.
  - Permission `automation:view` ajoutée (`PermissionInitializer` → SUPER_ADMIN/SUPER_MANAGER/HOST). Route `/automation-rules` + menu passent de `settings:view` (platform-only) à `automation:view` + rôle HOST → les HOST voient l'écran.
  - Front : `canEdit = hasAnyRole(['SUPER_ADMIN','SUPER_MANAGER'])` — toggle désactivé, boutons Modifier/Supprimer/Nouvelle règle masqués pour les lecteurs ; Exécutions (lecture seule) visibles par tous ; état vide sans CTA pour les lecteurs.
- **Tests corrigés** : `OrganizationServiceTest` (+mock AutomationRuleService), `GuestControllerTest` + `SepaDebtorSettingsControllerTest` (mock inline 4e arg).
- **Vérif** : tsc vert ; mvn package en cours.

## 2026-07-03 — Les flux déterministes alimentent la Constellation (feed + domaines) — non commité

- **Constat** : la Constellation (panneau superviseur) lit un journal `SupervisionActivity` (entrées {module com/rev/ops/fin/rep, texte}), écrit UNIQUEMENT par le scan LLM (`SupervisionScanService`). Le moteur déterministe (`AutomationEvaluationService`) enregistrait une `AutomationExecution` mais N'écrivait AUCUNE `SupervisionActivity` → les flux déterministes étaient invisibles dans la Constellation (feed + statuts de domaine + compteur d'actions auto). `AutomationExecution` n'était référencé nulle part dans la supervision (vérifié).
- **Fait** :
  - `SupervisionActivityService.recordModuleAct(orgId, propertyId, moduleKey, tool, summary)` (écrit directement par domaine, sans mapping specialist) ; `recordAct` délègue désormais dessus.
  - `AutomationEvaluationService` : carte statique `ACTION_MODULE` (16 actions → com/rev/ops/fin/rep) ; au cas EXECUTED, `recordConstellationActivity(rule, context)` résout la propriété (réservation → property, ou sujet TYPE_PROPERTY → subjectId) et écrit une ligne (texte = nom de la règle). Best-effort, sujets org-level (relevé/payout/invoice/bruit sans propriété résoluble) ignorés. Injection `SupervisionActivityService` (constructeur unique, pas de cycle).
  - Aucun changement frontend : le feed `/api/ai/supervision/activity` + le compteur `autoActions` reflètent désormais aussi le déterministe.
- **Mapping** : com (SEND_MESSAGE/GUIDE/CHECKIN_LINK/NOISE_WARNING), rep (SEND_REVIEW_REQUEST), ops (CREATE_CLEANING/CANCEL/MAINTENANCE/NOTIFY_STAFF/REVOKE_ACCESS_CODE), fin (SEND_INVOICE_REMINDER/OWNER_STATEMENT/SUGGEST_DEPOSIT_*), rev (NOTIFY_RATE_PARITY/SUGGEST_CALENDAR_BLOCK).
- **Écart** : le « pulse agit » live des domaines reste piloté par les runs LLM (éphémère) ; ici on alimente le journal persistant + le compteur d'actions auto (la vraie « mémoire » déterministe). Sujets sans propriété résoluble non journalisés (v1).
- **Test corrigé** : AutomationEvaluationServiceTest (+ mock SupervisionActivityService). Vérif : mvn package en cours.

## 2026-07-03 — Refonte cartes Constellation en « piles par type » — Phase 1 (cœur), non commité

- **Source** : handoff design « Cartes empilées par type » (zip user), haute fidélité, cité shadcn/Tailwind → ADAPTÉ à notre Constellation MUI + tokens maison (pas de copie shadcn). Données mappées : type=`agentId`, urgence=`expiresAt` (countdown existant), montant=`amountEur` (via `Money`), titre=`title` ; handlers réutilisés `onValidate`/`onEdit`.
- **Fait (Phase 1)** : nouveau composant `TaskDeckQueue.tsx` (drop-in de `PendingQueue`, branché dans `SupervisionPanel` aux 2 usages) : piles groupées par type (ordre Finance/Ops/Com/Rev/Avis), deck replié (carte du dessus + jusqu'à 3 tranches derrière + pastille de comptage + aperçu titre 2ᵉ carte), dépliage/repli **une seule pile à la fois**, **focus par flou** des autres (+ clic pile floutée = referme), **Échap + clic-hors-zone** ferment ; cartes restylées (tuile d'icône 40, label type, badge urgence/à-régler, titre 2 lignes, pied 3 boutons primaire/secondaire/chevron « Pourquoi ? ») ; en-tête déplié (compteur + total, tri Échéance/Montant) ; **action groupée** (types non-paiement) + **toast Undo** (optimiste : masque local, commit `onValidate` différé 4,2 s, annulation restaure). i18n `supervision.deck.*` fr/en/ar. tsc vert.
- **Adaptations/écarts assumés** : urgence basée sur `expiresAt`/`kind` réels (pas de « due date » fabriquée comme le proto) ; largeur 320px (colonne flottante), pas 440 ; action groupée exclue des piles paiement (mass-Stripe impraticable) ; double-bulk rapide avant commit = 1ère salve non commit (réapparaît au refresh, pas de perte) ; `PendingQueue`/`PendingActionCard` laissés en place (non supprimés). **Phase 2 à venir** (choix user) : swipe carte du dessus (+rotation +calque d'indice), glisser-réordonner les piles, épingle.

## 2026-07-04 — Test HITL Constellation + endpoint de démo dev — non commité

- **IT dédié** `ScenarioConstellationHitlIT` (gate CLENZY_IT, Testcontainers) : règle déterministe `RESERVATION_CANCELLED → SUGGEST_DEPOSIT_REFUND` (caution HELD) → fireTrigger → assert **carte HITL via `SupervisionSuggestionService.list()`** (source des cartes Constellation : actionType=DEPOSIT_REFUND, agentId='fin', reservationId) + **entrée de feed** (`SupervisionActivityService.getSnapshot`, module 'fin', autoActions≥1) + anti-fuite cross-org. **EXÉCUTÉ ET VERT sur conteneurs réels** (Tests run: 1, 0 fail, ~62 s).
- **Endpoint de démo DEV** (`@Profile({"dev","local"})`, absent en prod) : `POST /api/dev/constellation/demo-card?propertyId=X` (staff) → `DevConstellationDemoService.spawnDemoCard` simule une escalade bruit (crée la règle NOISE_ALERT→SUGGEST_CALENDAR_BLOCK si absente + une NoiseAlert + fireTrigger data alertsLast24h=3) → carte HITL « bloquer le calendrier » (Opérations) sur la Constellation, SANS caution ni annulation. Controller mince + service (ArchUnit OK). mvn package vert.
- **Clarification produit** (réponse user « pourquoi si peu de cartes HITL ») : par conception, seules 3 actions déterministes sont HITL (SUGGEST_DEPOSIT_REFUND/RELEASE = argent sortant, SUGGEST_CALENDAR_BLOCK = fermeture de ventes) ; les 13 autres agissent seules (pas de carte). Plus de cartes « intelligentes » (PRICE_DROP, YIELD_PRICE_ADJUST) = via le scan LLM autonome, pas le déterministe.
