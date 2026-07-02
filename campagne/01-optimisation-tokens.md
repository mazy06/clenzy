# Phase 1 — Optimisation tokens & coûts

> Campagne multi-agent Baitly — livrable Gate 1. Date : 2026-07-01.
> Base : audit Phase 0 (`00-audit.md`). Rappel baseline : chat mono 1 tour ≈ 0,010 $ ; tour multi-agent ≈ 0,10-0,20 $ (5-10× le mono) ; host type 10 logements ≈ 1,5-2,5 $/mois de coût provider. Les 6 leviers du commit `bc98774e` sont déjà en production (scoping outils, fenêtre 24 msgs + cap 8k, prompt allégé, caching Anthropic+OpenAI, bornes d'itération, pré-charge multi-agent partagée) — ce plan porte sur **ce qui reste**.

---

## 1. Décision préalable D-002 — framework : custom vs Spring AI

| Option | Coût | Risque | Gain |
|---|---|---|---|
| **1. Consolider le custom (reco)** | nul (statu quo) + dette documentaire | dépendance à la maintenance interne | conserve HITL multi-agent pause/reprise, failover, comptabilité cache, scoping — features que Spring AI ne fournit pas toutes nativement |
| 2. Migration Spring AI complète | très élevé (réécrire orchestrateur, 60 outils→ToolCallback, HITL à réinventer, re-tests) | régressions sur un système en prod ; abstractions Spring AI encore mouvantes | portabilité providers (déjà acquise en custom), écosystème Advisors |
| 3. Hybride ponctuel | faible | frontière floue entre deux stacks | aucun besoin immédiat identifié : RAG pgvector custom déjà fonctionnel |

**Recommandation : Option 1.** Le custom est fonctionnellement en avance sur ce qu'apporterait la migration ; l'énergie de la campagne va aux leviers économiques et métier, pas à un portage iso-fonctionnel. Ré-évaluer uniquement si un besoin précis (ex. advisor tiers, nouveau provider exotique) rend le custom coûteux. Les concepts du brief (Advisors, ToolCallback…) sont mappés sur leurs équivalents custom dans toute la suite de la campagne.

---

## 2. Tableau des leviers restants (gain / effort / risque)

Les gains se **composent multiplicativement**, ne pas les additionner. Chiffres = estimations statiques Phase 0, à recaler sur mesures réelles (levier L7 en premier pour mesurer avant/après).

| # | Levier | Mécanisme | Gain estimé | Effort | Risque |
|---|---|---|---|---|---|
| **L1** | **Routage court-circuit (classification d'intention par petit modèle)** | Étage pré-orchestrateur : 1 appel Haiku (~300 tokens, ~0,0003 $) classe la requête {simple → mono-agent scopé / multi → orchestrateur / smalltalk → réponse directe}. Aujourd'hui TOUT message part en multi-agent (5-10× le coût mono) | **-30 à -45 % du coût total assistant** (hypothèse : 50-70 % des requêtes sont mono-domaine simples) | Moyen (nouvel étage + prompt de classification + flag) | Mauvais routage → réponse dégradée. Mitigation : le mono-agent a déjà accès à tout le catalogue scopé + fallback « escalade multi » si le mono détecte un besoin cross-domaine |
| **L2** | **Tiering de modèles par rôle d'agent** | Config par specialist (matrice §3) via le point d'accroche existant `AiTargetResolver.resolvePrimary(org, feature, contextModelOverride)` — étendre `PlatformAiFeatureModel` (config DB) d'une granularité `agentRole` optionnelle. Orchestrateur (T=0.1, 1024 tokens, tâche de routage) n'a pas besoin d'un modèle fort | **-25 à -40 % sur les runs multi-agent** (Haiku ≈ 1/4 du prix Sonnet en input, 1/4 en output) | Faible-moyen (résolution + config + UI admin existante à étendre) | Qualité dégradée sur yield/arbitrages complexes → Insights et incidents restent sur tier fort ; piloté par config, réversible par rôle |
| **L3** | **Scoping V2 + compression des définitions d'outils** | (a) matching à frontière de mots (fix stems `startsWith` naïfs) ; (b) descriptions d'outils re-passées à ~120-150 chars + schémas sans propriétés redondantes ; (c) option : sélection d'outils par embedding (pgvector déjà là) au lieu de stems | -1 à -3k tokens/appel (defs actuelles 4,5-6,6k) ≈ **-10-20 % de l'input** | Faible | Sélection d'outil dégradée si description trop courte → A/B sur les outils les plus appelés (`assistant.tool.executions` donne la liste) |
| **L4** | **Vision : image envoyée une seule fois** | Bloc image transmis au 1er tour uniquement ; tours suivants = référence textuelle + description générée. Aujourd'hui ré-encodée à chaque itération (≈4k tokens × 4 tours) | **-12k tokens par run avec image** (~-0,04 $/run vision) | Faible | Le LLM peut avoir besoin de re-regarder l'image → la réinjecter sur demande explicite (tool `view_attachment`) |
| **L5** | **Rolling summary (mémoire hiérarchique)** | Au-delà de la fenêtre, résumé structuré compact (1 appel Haiku amorti, déclenché 1 fois/N tours) au lieu de l'élagage sec actuel — cf. architecture B (§4) | Coût ≈ neutre, **gain de qualité** (contexte long préservé) + évite les re-appels d'outils pour retrouver un contexte perdu | Moyen | Perte d'information dans le résumé → conserver verbatim les décisions/HITL, résumer le reste |
| **L6** | **Réservation de budget pré-vol par run** | Estimation plancher avant run + réservation atomique (pattern Redis Lua de `SupervisionScanQuota` généralisé) + vérification entre chaque tour → ferme le trou « dépassement en rafale » (dette #4 Phase 0) | Pas d'économie directe ; **coupe les runaway** et fonde l'enforcement Phase 2 | Moyen | Estimation trop stricte bloque des runs légitimes → plancher conservateur (prompt seul) + réconciliation post-run |
| **L7** | **Observabilité coût enrichie (à faire EN PREMIER)** | Étendre l'existant (`AgentToolMetrics.TOKENS` Micrometer + `ai_token_usage`) : tag `agent` (orchestrator/specialist/mono — `SpecialistResult` porte déjà ses tokens), métrique coût USD calculée via `LlmPricingService`, compteur cache hit/miss, latence par appel. Durcir le fallback prix inconnu = 0 $ (alerte au lieu de silence). **Conçu pour réutilisation directe comme ledger Phase 2** (mêmes points d'écriture, granularité run/step à ajouter) | Aucun gain direct — **prérequis de mesure** pour valider L1-L5 et calibrer la table de conversion crédits | Faible | Cardinalité Prometheus : tag `agent` = ensemble fermé (12 valeurs), OK |
| L8 | Batching non temps réel | Briefings/scans déjà schedulés et scanners supervision déjà déterministes (0 LLM) ; reste : grouper les générations différées (traductions, contenus) en jobs hors pointe | Marginal (~-5 % au mieux) | Faible | Aucun |
| L9 | Cache TTL étendu | Évaluer le cache Anthropic 1 h (vs 5 min éphémère) pour le préfixe system+tools des orgs actives | Marginal (cache hit déjà bon en conversation active) | Faible | Surcoût d'écriture cache ×2 si mal ciblé |

**Effet cumulé attendu (L1×L2×L3×L4)** : coût par interaction moyenne **-55 à -70 %** à qualité égale ou supérieure — baseline host type ≈ 1,5-2,5 $/mois → **≈ 0,5-0,9 $/mois**. C'est la marge structurelle du modèle à crédits de la Phase 2.

---

## 3. Matrice tâche → modèle (tiering)

Tier piloté par **configuration** (extension `PlatformAiFeatureModel` + override par rôle d'agent), jamais hardcodé. Modèles cités = état actuel du catalogue (`LlmPricingService`), remplaçables par config.

| Tier | Modèle type | Tâches / rôles | Justification |
|---|---|---|---|
| **Petit/rapide** (Haiku 4.5, ~0,8/4 $/Mtok) | classification d'intention (L1), rolling summary (L5), extraction, briefing quotidien (déjà le cas), specialists **Navigation, Memory, Context, Workflow** | tâches mécaniques à sortie courte et contrainte ; l'écart de qualité est indétectable |
| **Standard** (Sonnet, ~3/15 $/Mtok) | mono-agent par défaut, specialists **DataAnalyst, Finance, Operations, Communication, Monitoring**, rédaction messages voyageurs, tool-calling multi-étapes | raisonnement métier courant, bon rapport qualité/prix |
| **Fort** (Opus/Fable-class, ~15/75 $/Mtok) | specialist **Insights** (yield complexe, simulations), futurs agents incidents/crise et conformité (Phase 3), arbitrages cross-agents litigieux | erreurs coûteuses en euros réels (tarifs, litiges) — le surcoût modèle est assurantiel |
| Orchestrateur | **Standard** (pas fort) | délégation = tâche de routage contrainte (1 meta-tool, T=0.1, 1024 tokens) | à re-tester : si L1 absorbe la classification, l'orchestrateur peut même descendre en Haiku pour les délégations simples |

Lien Phase 2 (§2.9 du brief) : le tiering est aussi un **levier de packaging** — forfait particulier servi majoritairement en Haiku/Sonnet, features premium (prédictif, what-if) sur tier fort à coût en crédits supérieur, affiché.

---

## 4. Architectures de contexte comparées (le plus gros levier structurel)

| | **A. Statu quo amélioré** | **B. Mémoire hiérarchique** | **C. Blackboard structuré + deltas** |
|---|---|---|---|
| Principe | fenêtre 24 msgs + caps actuels + scoping V2 | fenêtre courte (8-12 msgs verbatim) + **rolling summary structuré** (faits, décisions, préférences) + RAG pour l'ancien | état de run **structuré partagé** (Postgres, adossé aux tables `agent_run`/`agent_step` de D-001) ; l'orchestrateur passe des **deltas ciblés** aux specialists ; retours en structured output strict |
| Coût tokens | référence | -20-30 % sur conversations longues ; ≈ neutre sur courtes | **-40-60 % sur les runs multi-agent** (les specialists ne reçoivent plus l'historique, seulement leur mandat + delta) |
| Effort | quasi nul | moyen (composer + déclencheur de résumé + tests fenêtrage) | élevé (refonte du contrat orchestrateur↔specialist, migration des prompts) |
| Risque | aucun | perte d'info résumée (mitigé : verbatim sur décisions/HITL) | régressions de qualité si le delta omet du contexte utile ; chantier plus long |
| Synergies | — | améliore aussi le mono-agent | **converge avec D-001** (agent_run/agent_step = le même état persisté) et avec le replay Constellation ; prépare la facturation par step (Phase 2) |

**Recommandation : B maintenant, C en cible adossée au chantier D-001.** B est le meilleur ratio gain/risque immédiat et ne préjuge de rien. C est la bonne architecture cible multi-agent — la construire **en même temps** que les tables `agent_run`/`agent_step` déjà décidées (une seule modélisation de l'état de run, servant à la fois replay, facturation par step et deltas), plutôt qu'en chantier séparé.

---

## 5. Plan priorisé

| Ordre | Chantier | Leviers | Dépendances |
|---|---|---|---|
| 1 | **Mesurer** : observabilité coût enrichie (tag agent, coût USD, cache hit ratio, fallback prix durci) | L7 | aucune — fonde toutes les validations suivantes |
| 2 | **Router** : classification d'intention petit modèle + court-circuit mono/multi | L1 | L7 (mesure avant/après) |
| 3 | **Tiérer** : config modèle par rôle d'agent + matrice §3 | L2 | L7 |
| 4 | **Dégraisser** : scoping V2, compression descriptions, fix vision | L3, L4 | aucune |
| 5 | **Mémoire** : rolling summary (architecture B) | L5 | aucune |
| 6 | **Encadrer** : réservation pré-vol + vérification inter-tours | L6 | pattern Redis Lua existant ; **fonde la Phase 2** |
| 7 | **Cibler** (moyen terme) : blackboard/deltas (architecture C) | — | tables agent_run/agent_step (D-001) |

Critère de succès global : **coût moyen par interaction assistant ÷2 au minimum** (mesuré par L7, comparaison 30 jours avant/après), zéro régression sur les évaluations de qualité des réponses (à échantillonner sur les runs réels).

---

## 6. Ce qui est explicitement hors scope Phase 1

- L'implémentation du ledger crédits, de la conversion et de l'enforcement de solde → Phase 2 (L6 et L7 en posent les fondations : mêmes points d'écriture, même pattern atomique).
- Le roster d'agents étendu et la matrice d'autonomie → Phase 3.
- Les nouveaux outils métier → Phase 4.
