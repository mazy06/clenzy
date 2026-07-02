# Campagne multi-agent Baitly — Registre des décisions

> Une entrée par décision structurante. Statut : `proposée` → `tranchée` (avec qui/quand) → éventuellement `révisée`.

## D-001 — Transport du monitoring Constellation (post-LangGraph/CopilotKit)

- **Statut** : proposée (à trancher à la Gate 0)
- **Contexte** : le monitoring Constellation avait été pensé pour CopilotKit + LangGraph, abandonnés. Proposition par défaut de l'utilisateur : état de run persisté Postgres (`agent_run`/`agent_step`) rejouable + temps réel WebSocket/STOMP alimenté par Kafka + HITL applicatif `pending_action` Postgres + conservation des shapes du data-contract Constellation côté front.
- **Instruction** : audit de l'existant (SSE assistant, STOMP, Kafka, PendingToolStore, audit trail) en Phase 0 → options comparées dans `00-audit.md` §0.5.2.
- **Décision** : **tranchée (Gate 0, 2026-07-01, « OK » utilisateur sur reco)** — **Option C hybride** : SSE conservé pour le temps réel ; tables `agent_run`/`agent_step` (Liquibase) écrites en async hors chemin critique + endpoint replay ; durcissement de la persistance des pauses HITL (état complet en Postgres) ; pont Kafka→STOMP `/topic/supervision/{orgId}` ajouté seulement quand le multi-client sera avéré (vue propriétaire lecture seule pressentie). Shapes du data-contract front conservés.

## D-002 — Framework agentique : custom maison vs Spring AI

- **Statut** : proposée (émergente de la Phase 0, non prévue au brief)
- **Contexte** : le brief présumait Spring AI ; le code réel est un framework custom (`com.clenzy.service.agent.*`, zéro dépendance spring-ai). Migrer vers Spring AI (ChatClient/Advisors/ToolCallback/PgVectorStore) ou consolider le custom ?
- **Éléments** : le custom couvre déjà : registry d'outils, boucle de tool-calling, HITL, multi-provider avec failover, budget de contexte, prompt caching. Une migration serait un gros chantier à gain incertain ; une adoption partielle (ex. PgVectorStore seul) est possible.
- **Décision** : **cadrée à la Gate 0 (2026-07-01)** — à trancher formellement en Phase 1 avec options comparées, biais assumé « consolider le custom, adoption éventuelle de briques ponctuelles ». → options dans `01-optimisation-tokens.md`.

## D-003 — Sort du BYOK dans le modèle à crédits

- **Statut** : proposée (Gate 2)
- **Contexte** : les orgs BYOK paient leur provider et sont exemptées de budget aujourd'hui. Options dans `02-facturation-usage.md` §1.
- **Reco** : B — débit à taux réduit (~30 % du taux plein) rémunérant la plateforme agentique, coût provider restant chez le client.
- **Décision** : **tranchée (Gate 2, 2026-07-02, « OK phase 2 » sur reco)** — Option B, taux réduit BYOK (dimension `key_source` de la rate card).

## D-004 — Intégration Stripe : tiroir-caisse pur vs Meters natifs

- **Statut** : proposée (Gate 2) — écart assumé vs §2.5 du brief
- **Contexte** : hard cap sans overage (D-101) ⇒ aucune ligne d'usage à facturer ; les billing credits Stripe ne s'appliquent qu'à des prix metered (doc vérifiée). Variantes comparées dans `02-facturation-usage.md` §6.
- **Reco** : Variante 1 — Stripe = subscriptions + Checkout top-ups + webhooks ; ledger/enforcement 100 % internes (satisfait D-103 portabilité). Meters ajoutables plus tard si un plan avec overage apparaît.
- **Décision** : **tranchée (Gate 2, 2026-07-02, « OK phase 2 » sur reco)** — Variante 1 (tiroir-caisse pur), Meters différés.

## Décisions déjà tranchées par l'utilisateur (brief, NE PAS re-débattre)

- **D-100** — Unité de compte = crédit IA normalisé (pas le token brut).
- **D-101** — Limite = hard cap + top-up prépayé ; pas d'overage a posteriori.
- **D-102** — Pas de rollover : crédits d'abonnement expirent en fin de cycle ; top-up 12 mois.
- **D-103** — Plateforme de facturation = Stripe uniquement ; design portable (solde/enforcement chez nous).
- **D-104** — Prompt caching : gain gardé en marge (option B) — débit client au tarif input plein, indépendant du statut cache.
- **D-105** — Actions autonomes : autonomie socle incluse + autonomie premium sur sous-budget dédié plafonné (B + D).
