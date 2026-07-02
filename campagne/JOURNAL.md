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
