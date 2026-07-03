# Campagne multi-agent Baitly — ADRs (Architecture Decision Records)

> Formalisation des décisions structurantes tranchées aux gates (réfs `DECISIONS.md`). Format : Contexte / Décision / Conséquences. Statut : toutes **acceptées** (gates 0-6, 2026-07-01/02).

## ADR-001 — Framework agentique : consolider le custom, pas de migration Spring AI (D-002)
- **Contexte** : le brief supposait Spring AI ; l'audit (Phase 0) a montré un framework custom mature (`com.clenzy.service.agent.*`) couvrant orchestration multi-agent, HITL pause/reprise, failover multi-provider, prompt caching avec comptabilité, scoping d'outils — sans dépendance spring-ai.
- **Décision** : consolider le custom. Les concepts Spring AI (Advisors, ToolCallback, ChatMemory, PgVectorStore) sont mappés sur leurs équivalents maison. Ré-évaluation seulement sur besoin précis.
- **Conséquences** : zéro coût de portage ; dette documentaire à combler (le custom doit être documenté comme un framework) ; veille Spring AI maintenue.

## ADR-002 — Transport monitoring Constellation post-LangGraph : SSE + persistance async + replay (D-001)
- **Contexte** : monitoring pensé pour CopilotKit+LangGraph (abandonnés) ; SSE AG-UI déjà en prod, STOMP existant mais non utilisé pour la supervision, aucun état de run persisté.
- **Décision** : Option C hybride — SSE conservé pour le temps réel ; tables `agent_run`/`agent_step` (Liquibase) écrites en **async hors chemin critique** (événement Kafka best-effort) ; endpoint replay ; durcissement HITL (état de pause complet en Postgres, unification PendingToolStore + suggestions sous `pending_action`) ; pont Kafka→STOMP `/topic/supervision/{orgId}` seulement quand le multi-client sera avéré (Constellation Propriétaire). Shapes du data-contract front conservés.
- **Conséquences** : replay/time-travel sans rupture front ; `agent_run`/`agent_step` servent aussi le ledger de crédits (une seule modélisation d'état) ; Kafka jamais sur le chemin de latence.

## ADR-003 — RAG : pgvector custom conservé
- **Contexte** : RAG opérationnel (`kb_document`/`kb_chunk` vector(1024), ivfflat cosine, providers d'embeddings configurables en DB, auto-injection seuil 0.70).
- **Décision** : conserver tel quel ; pas d'adoption de PgVectorStore Spring AI (cohérent ADR-001). Extension future : sélection d'outils par embeddings (levier L3 option).
- **Conséquences** : aucun chantier ; le quota d'embeddings par org reste à ajouter (ticket backlog).

## ADR-004 — Tiering de modèles par rôle d'agent, piloté par configuration
- **Contexte** : tous les specialists héritent du même modèle résolu pour ASSISTANT_CHAT ; point d'accroche existant `AiTargetResolver.resolvePrimary(org, feature, contextModelOverride)` + config DB `PlatformAiFeatureModel`.
- **Décision** : granularité `agentRole` optionnelle en config DB ; matrice 3 tiers (petit : classification/résumés/briefings/specialists utilitaires ; standard : mono-agent, orchestrateur, majorité des métiers ; fort : Revenue, Conformité, Incident, arbitrage). Jamais hardcodé.
- **Conséquences** : -25/-40 % sur les runs multi-agent ; levier de packaging (features premium sur tier fort à crédits majorés) ; réversible par config.

## ADR-005 — Facturation : crédits normalisés, hard cap + top-up, sans rollover, ledger interne, Stripe tiroir-caisse (D-100…D-103, D-004)
- **Contexte** : aucun lien usage↔facturation aujourd'hui ; doc Stripe vérifiée (billing credits applicables uniquement aux prix metered ; hard cap sans overage ⇒ pas d'usage facturé a posteriori).
- **Décision** : unité = crédit IA (1 crédit = 0,02 € facial, millicrédits internes, markup ×5) ; table de conversion versionnée `ai_credit_rate_card` ; ledger append-only `ai_usage_ledger` (run_id/step, idempotency_key) = source de vérité ; poches SUBSCRIPTION (expire fin de cycle) puis TOPUP (12 mois, FIFO expiration) ; solde chaud Redis Lua fail-closed ; pré-vol → réservation → re-check inter-tours → réconciliation ; Stripe = subscriptions + Checkout top-ups + webhooks idempotents (pas de Meters tant qu'aucun plan overage).
- **Conséquences** : enforcement temps réel indépendant de Stripe (portabilité) ; réconciliation double (marge vs providers, revenu vs Stripe) ; modèle sans taux → run refusé (fin du fallback 0 $).

## ADR-006 — Prompt caching gardé en marge : débit client au tarif input plein (D-104)
- **Contexte** : caching Anthropic/OpenAI en place avec comptabilité des tokens cachés.
- **Décision** : le débit client applique le taux INPUT plein aux prompt tokens totaux, statut cache ignoré ; le coût réel (cache déduit) est tracé par ligne de ledger pour le pilotage de marge uniquement.
- **Conséquences** : coût en crédits stable et prévisible pour le client ; l'économie d'ingénierie du cache rémunère la plateforme ; la rate card n'a pas de type CACHED côté client.

## ADR-007 — Autonomie : socle incluse + premium sur sous-budget plafonné (D-105)
- **Contexte** : le client ne doit jamais être « puni » parce que le système fait son travail élémentaire ; l'autonomie proactive premium ne doit jamais siphonner les crédits interactifs.
- **Décision** : bucket SOCLE (auto-réponses, alertes, briefing de base, relevés) débité 0 crédit mais tracé (coût réel visible pour nous) ; bucket PREMIUM_AUTO puisant dans les poches normales mais borné par `ai_autonomy_budget.premium_cap` (comportement au plafond : pause ou notifier-seulement) ; niveaux d'autonomie 4 états par agent × tenant, invariant sécurité (paiement/remboursement/annulation/envoi/tarif jamais sous « notifier »).
- **Conséquences** : la promesse produit (socle) est protégée ; le premium est un levier de packaging par segment ; les Règles de Confiance (validations apprises) s'appuient sur cette matrice.

## ADR-008 — BYOK à taux réduit (D-003)
- **Contexte** : les orgs BYOK paient leur provider et échappaient à toute monétisation IA.
- **Décision** : débit à ~30 % du taux plein (dimension `key_source` de la rate card), rémunérant l'orchestration/outils/Constellation ; le coût provider reste chez le client.
- **Conséquences** : monétisation du logiciel agentique sans double-facturation des tokens ; l'exemption de budget actuelle disparaît au profit du débit réduit.
