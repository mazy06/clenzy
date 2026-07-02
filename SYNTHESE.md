# SYNTHÈSE EXÉCUTIVE — Campagne multi-agent Baitly

> 2026-07-02 · Campagne d'architecture en 8 phases, toutes validées en gates (dossier `campagne/`). Objet : analyser, optimiser, monétiser et différencier le système multi-agent du PMS.

## 1. État — ce que l'audit a établi (preuves dans `campagne/00-audit.md`)

Le système est **plus avancé que présumé**. La couche agentique n'est pas Spring AI mais un **framework custom mature** : orchestrateur multi-agent (10 specialists, délégation bornée), fallback mono-agent, HITL pause/reprise complet, failover multi-provider (Anthropic/OpenAI/NVIDIA), 60 outils (15 mutateurs, tous sous confirmation), RAG pgvector, prompt caching Anthropic+OpenAI **avec comptabilité des tokens cachés**, metering par appel LLM déjà persisté (`ai_token_usage`) et observabilité Micrometer.

Trois faiblesses structurantes : (1) **aucun lien usage↔facturation** — l'IA est offerte à perte contrôlée, le BYOK échappe à tout ; (2) tout message part en multi-agent (5-10× le coût d'un tour simple) et tous les agents partagent le même modèle ; (3) **4 domaines métier à zéro** (fiscalité, screening, stocks, crise) et pas de replay des décisions d'agents.

## 2. Cap — les décisions prises (8 ADRs, `campagne/ADRS.md`)

- **Consolider le custom** (pas de migration Spring AI) ; monitoring Constellation en **SSE + runs persistés `agent_run`/`agent_step` rejouables** (Kafka async hors chemin critique, STOMP en incrément).
- **Tiering de modèles par rôle d'agent** piloté par config + **routage court-circuit** par petit modèle.
- **Facturation à l'usage en crédits IA** (1 crédit = 0,02 €, markup ×5) : ledger append-only interne = source de vérité, réservation atomique Redis fail-closed, **hard cap + top-up prépayé, sans rollover**, Stripe en tiroir-caisse pur (subscriptions + Checkout). Prompt caching **gardé en marge** (débit au tarif input plein). BYOK débité à ~30 % (part plateforme). **Autonomie socle incluse à 0 crédit** + autonomie premium sous **sous-budget plafonné**.
- **Roster cible 17 agents métier** en 3 vagues (« un agent sans outils est un chatbot ») + 32 nouveaux outils ancrés sur des services réels, checklist sécurité systématique (tenant prouvé, idempotence, montants jamais client-trusted).
- **Positionnement : B2B2C** — l'outil des conciergeries, pas leur substitut ; petit hôtel fermé pour l'instant.

## 3. Gains attendus

| Axe | Cible |
|---|---|
| **Coût tokens** | -55 à -70 % par interaction (routage + tiering + scoping + vision + mémoire) — baseline ~1,5-2,5 $/mois/host → ~0,5-0,9 $ |
| **Marge** | IA transformée de centre de coût en ligne de revenus : +9/+29/+79 €/mois par plan, marge brute crédits ≈ 75-80 % (avant gain de cache, conservé en marge) |
| **Couverture métier** | 6/16 domaines agentiques → 9/16 (vague 1, outils existants) → 13/16 → 16/16 |
| **Différenciation** | 3 signature features sans équivalent sur 11 concurrents audités (sources 2025-2026) : **Grand Livre d'Autonomie** (chaque action IA a un reçu : motif, coût, replay), **Règles de Confiance** (l'autonomie qui s'apprend par validations, visible et révocable), **Constellation Propriétaire** (transparence IA white-label offerte aux propriétaires des conciergeries) |

La veille (`campagne/06-modele-differenciant.md`) montre que **personne** — de Guesty (30 agents) à Mews (300 M$ levés) — ne facture l'IA à l'usage réel, n'expose son coût, ni n'offre replay/autonomie apprise/vue propriétaire : les crédits transparents sont l'angle libre, déjà standard chez les acheteurs SaaS (HubSpot, Microsoft, Monday, Intercom).

## 4. Exécution

Feuille de route RICE Now/Next/Later + 12 premiers tickets prêts : `campagne/07-feuille-de-route.md`. **Now (0-2 mois)** : mesurer (observabilité coût), router, tiérer, persister les runs, livrer le sous-système crédits + Stripe + UX jauge, agents V1 (dont Propriétaire). **Next** : Règles de Confiance, Grand Livre, forfaits en prod, agents V2, Constellation Propriétaire. **Later** : architecture deltas, domaines V3 (16/16), pilote per-outcome.

*Dossier complet : `campagne/{00-audit, 01-optimisation-tokens, 02-facturation-usage, 03-architecture-agents, 04-catalogue-outils, 05-couverture-metier, 06-modele-differenciant, 07-feuille-de-route, ADRS, DECISIONS, JOURNAL}.md*
