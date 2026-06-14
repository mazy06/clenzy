# B10 — Benchmark : IA & automatisation

> **Domaine 13** (pondération cadrage : 5 % — « émergent, fort potentiel de différenciation »).
> **Panel PMS classiques :** Clenzy vs Hostaway, Guesty, Smoobu, Lodgify, Hospitable, Avantio, Smily.
> **Panel AI-natifs (hors-grille, repères) :** Jurny, Enso Connect, HostBuddy/HostGPT, Besty AI, Conduit (HostAI).
> **Grille 0–3** (cf. cadrage §5). Concurrents : datés + sourcés + niveau de confiance. Veille web : 2024-2026.
> **Date :** 2026-06-13.

---

## Section 1 — Périmètre & taxonomie du domaine

Le domaine « IA & automatisation » couvre l'ensemble des capacités d'intelligence artificielle (générative et prédictive) et d'automatisation pilotée par l'IA d'un PMS. Distinction structurante : **IA conversationnelle** (répondre, suggérer, résumer) vs **IA d'action / agentique** (exécuter des tâches, agir de façon autonome).

Sous-fonctionnalités retenues (comparables) :

1. **Assistant conversationnel / copilote gestionnaire** — un agent à qui le gestionnaire pose des questions sur son portefeuille.
2. **Multi-provider LLM** — capacité à router entre plusieurs modèles (Anthropic/OpenAI/etc.) ou BYOK.
3. **RAG / knowledge base** — recherche par embeddings sur une base de connaissances pour ancrer les réponses.
4. **Auto-réponse messagerie (copilote draft)** — l'IA rédige un brouillon de réponse guest (validation humaine).
5. **Auto-reply / autopilot IA guest** — envoi automatique de la réponse sans validation.
6. **IA agentique d'action** — un agent qui *exécute* des tâches (créer une intervention, bloquer un calendrier, etc.).
7. **Architecture multi-agent productisée** — un orchestrateur coordonnant des agents spécialisés, livré aux clients.
8. **IA de pricing / revenue management** — optimisation de prix par modèle (cf. domaine 4, ré-évalué ici sous l'angle « IA »).
9. **Détection d'anomalies / fraude paiement** — repérage de patterns de paiement frauduleux / transactions à risque.
10. **Guest screening / détection de risque IA** — scoring de risque d'un voyageur (fake profile, fraude).
11. **Résumés IA** — synthèse d'une conversation, d'avis, d'un séjour.
12. **Génération de contenu** — rédaction d'annonces / descriptions par IA.
13. **Vision / analyse d'images (usage métier)** — IA sur photos (inspection ménage, dégâts, état des lieux).
14. **Multi-langue (IA / traduction)** — réponses / traduction multilingues pilotées par IA.
15. **Mémoire long terme de l'assistant** — persistance de faits cross-session.
16. **Moteur d'automatisations (workflow no-code)** — règles événementielles déclenchant des actions.

---

## Section 2 — Inventaire interne Clenzy (vérité code)

*(détail complet : `inventaire/13-ia-automatisation.md`)*

**Forces (preuves code)**
- **Assistant multi-provider mature** : `AgentOrchestrator` + `ChatLLMRouter` (`@Primary`) dispatchant vers `AnthropicChatProvider` / `OpenAiChatProvider` (OpenAI/NVIDIA/Bedrock générique), streaming SSE (`AgentToolLoopRunner`), budget de tokens par org (`AiProperties.TokenBudget`, 100k/mois).
- **RAG pgvector à 2 étages** : `KbSearchService` + `EmbeddingService` (Voyage/OpenAI configurable) + **reranking** (`RerankService`, `VoyageRerankProvider`) ; ingestion idempotente (`IngestionService`), auto-injection RAG dans le system prompt (seuil 0.70). Techniquement au-dessus de la moyenne marché.
- **27 tools d'action** (`service/agent/tools/`, comptés) : lecture analytics, réservations/calendrier, opérations terrain (créer/assigner interventions), simulation pricing/calendrier, envoi message guest, mémoire, knowledge base, météo, événements locaux, workflow, navigation UI. → **IA d'action**, pas seulement conversationnelle.
- **Mémoire long terme** : `AssistantMemoryService` + entité persistante + nettoyage planifié (`RememberFactTool`/`ForgetFactTool`). **Rare sur le marché PMS.**
- **Moteur d'automatisations** : `WorkflowEngine` + registry + validator + `WorkflowSettingsService`.
- **Vision branchée** : upload (≤ 3 images, ≤ 5 MB), réinjection base64 Claude Vision, `VisionTokenUsageService`.

**Faiblesses (preuves code)**
- **Multi-agent codé mais OFF** : `OrchestratorAgent` + `SpecialistRegistry` derrière `clenzy.assistant.multi-agent.enabled=false` (`AgentOrchestrator.java:127`). C'est le paradigme vendu par Jurny/Guesty — Clenzy a la brique, ne la livre pas.
- **IA métier dormante (flags OFF)** : `pricing-ai=false`, `messaging-ai=false`, `analytics-ai=false`, `sentiment-ai=false` (`AiProperties:118-121`). Capacités présentes mais **non exposées aux clients prod**.
- **Pas d'autopilot guest** : la chaîne `AiMessagingService.generateSuggestedResponseAi()` s'arrête au draft ; aucun envoi autonome (cf. domaine 6).
- **Détection d'anomalies métier = ABSENTE** : aucun service `*Anomaly*` / `*Fraud*`. `IncidentDetectionScheduler` ne fait que du **health check infra** (Postgres/Redis/Kafka/Stripe/SMTP), pas de la fraude/anomalie métier.
- **Vision = usage minimal** : suivi de tokens seulement, pas de cas d'usage métier (inspection ménage, dégâts).
- **RAG non branché au guest** : le RAG alimente l'assistant interne, pas l'inbox guest (≠ Knowledge Hub Hospitable / KB Hostaway).
- **Pas de résumés / génération de contenu productisés** : pas de tool/feature dédié.

**Score interne domaine : 2/3** (infrastructure conversationnelle/RAG supérieure à la moyenne ; mais l'IA agentique autonome productisée et la détection d'anomalies — palier décisif 2025-2026 — sont dormantes ou absentes).

---

## Section 3 — Analyse concurrent par concurrent (daté & sourcé)

### A. PMS classiques

#### Guesty — **2,6/3** *(leader IA agentique du panel)*
Stratégie « built on AI » la plus aboutie. **ReplyAI** (auto-réponse, lancement officiel août 2024) → **ReplyAI Autopilot + AI Task Creation** (22 avr. 2026) : agent IA embarqué qui automatise la communication, **détecte les problèmes en temps réel** et **génère des tâches prêtes à assigner**, entraîné sur le ton de voix du gestionnaire, avec seuils de confiance, comportement par propriété et escalade des conversations sensibles. **PriceOptimizer™** (IA pricing temps réel), **GuestyPay Protect™** (détection de patterns de paiement frauduleux), **Guesty Verify** (background check + ID, flag fake profiles). **Agent Hub / Agent Center** (1er juin 2026) : écosystème coordonné d'agents autonomes across revenue, communication, ops, finance, marketing, reviews ; agents entraînés sur des millions de messages/réservations/avis. 500 000+ propriétés. **Confiance : Confirmé** (PR Guesty PRNewswire avr. & juin 2026, ShortTermRentalz, Travel&TourWorld).

#### Hostaway — **1,8/3** *(IA native + marketplace d'agents)*
**Hostaway AI** : suite native — **Draft Replies** (suggestions, validation humaine, propulsé par ChatGPT) + **AI Auto Reply** (génératif, réponses auto aux questions courantes en pulling résa/annonce/historique/instructions custom ; forte demande, waitlist remplie en jours). Couvre aussi **review insights** et **dynamic pricing**, **détection de fraude** et **alertes maintenance** évoquées. Adoption IA **+170 % en YoY**, usage des features IA **triplé depuis début 2025**. Riche **marketplace** d'agents IA tiers (HostBuddy, Besty, Conduit, Aeve). **Confiance : Confirmé** (hostaway.com/glossary/hostaway-ai, /blog/hostaway-ai-features, Travolution & ShortTermRentalz 2025-2026).

#### Hospitable — **1,6/3** *(référence auto-reply pour hôtes)*
**AI-Suggested Replies** (+45 % d'usage S1 2025 ; ~60 % des brouillons envoyés sans édition) + **Inbox AI** (autopilot, jusqu'à 90 % de la comm guest sur Airbnb/Vrbo/Booking/Agoda/direct) ancré sur le **Knowledge Hub** (infos propriété, politiques, ton de voix ; +58 % d'usage). Orienté hôtes indépendants ; faible sur l'agentique d'ops cross-portefeuille. **Confiance : Confirmé** (hospitable.com/features/inboxai, thehostreport.com, Patronus AI case study 2025).

#### Smily (ex-BookingSync) — **1,2/3** *(FR, GuestReply AI intégré)*
**GuestReply AI** (partenaire intégré) : moteur multi-modèle entraîné sur 100k+ conversations réelles, **Co-Pilot** (revue de drafts) + **Autopilot** (full auto), multilingue, apprentissage du style de l'hôte, exploitation listings/bookings/dispo/conversations. Pas d'agentique d'ops propriétaire ni d'anomalie/fraude documentée. **Confiance : Probable** (smily.com/ai, manual.bookingsync.com, changelog.bookingsync.com 2025 ; GuestReply = intégration, pas 100 % natif).

#### Lodgify — **0,8/3** *(AI Assistant messagerie)*
**AI Assistant** dans l'interface réservation (« Suggest with AI » / « Improve with AI ») : lit le message guest, pull listings/résa/réglages, rédige une réponse modifiable. IA messagerie, smart-lock et dynamic pricing inclus aux plans core. Pas d'agentique d'action, pas de multi-agent, pas d'anomalie/fraude IA. **Confiance : Probable** (realtycrux.com 2025, capterra 2026).

#### Avantio — **0,6/3** *(automatisation Harmony, IA peu mise en avant)*
**Harmony** = automatisation de templates/messages (confirmations, rappels paiement, alertes overbooking owner) — **automatisation événementielle**, pas IA générative au cœur. IA messagerie / agentique peu documentée. **Confiance : Probable** (avantio.com/blog/harmony-task-automation, capterra 2026).

#### Smoobu — **0,25/3** *(entrée de gamme, pas d'IA native)*
Channel manager + automatisations par timestamps + guest guidebooks. **Pas d'IA générative native** mise en avant. **Confiance : Probable** (smoobu.com, capterra 2026).

### B. Acteurs AI-natifs (repères hors-grille du panel)

> *Ces acteurs ne sont pas dans le panel scoré mais fixent la frontière haute de l'IA agentique 2025-2026.*

- **Jurny (NIA)** — **réseau d'agents IA** (Communication, Pricing Intelligence, Concierge & Upsells, Review Management, Data Science) ; **JurnyOS** présenté comme « premier OS agentique pour l'hospitalité ». Mode **fully autonomous** (gère le parcours guest de bout en bout, planifie le ménage, escalade, priorise par sentiment) adopté par ~1/3 des clients (+300 % sur l'année). **Guest Screening & Fraud Detection IA** dédié. -25 % de coûts opérationnels reportés. *Posture : agentique autonome (vs « approval-first » des PMS classiques).* **Confiance : Confirmé** (jurny.com, businesswire 2024, blog.jurny.com 2025-2026).
- **Enso Connect** — plateforme guest-experience AI-native : **AI CoPilot** (drafts on-brand) + **AI AutoPilot** (réponses routinières sur knowledge base, guardrails + supervision humaine), inbox unifiée automatisant jusqu'à 80 %, vérification guest white-label. **Confiance : Confirmé** (ensoconnect.com 2025).
- **HostBuddy / HostGPT** — app IA n°1 de la marketplace Hostaway : autopilot OU copilot, 40-50 % d'automatisation typique, détection d'action items, routage Slack/email/SMS. **Confiance : Probable** (aeve.ai 2026).
- **Besty AI** — middleware IA léger s'intégrant aux PMS (Hostfully, OwnerRez, Hostaway via Rentals United) : messagerie + **upselling** (gap-night, early check-in, retargeting, winback, widget de réservation directe). **Confiance : Probable** (hostfully.com/integrations/besty-ai, capterra 2026).
- **Conduit (ex-HostAI)** — agent de communication guest + détection d'action items (partenaire Lodgify). **Confiance : À vérifier** (mentions 2025).

---

## Section 4 — Tableau comparatif synthétique

*(détail granulaire 16 fonctionnalités : `data/13-ia-automatisation.csv`)*

### 4.1 — PMS classiques (panel scoré)

| Fonctionnalité | Clenzy | Hostaway | Guesty | Smoobu | Lodgify | Hospitable | Avantio | Smily |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Assistant conversationnel (copilote gestionnaire) | **3** | 2 | 3 | 0 | 1 | 1 | 0 | 1 |
| Multi-provider LLM | **3** | 1 | 2 | 0 | 1 | 1 | 0 | 1 |
| RAG / knowledge base | **2** | 3 | 3 | 0 | 1 | 3 | 0 | 2 |
| Auto-réponse messagerie (copilote draft) | **1** | 3 | 3 | 0 | 2 | 3 | 2 | 3 |
| Auto-reply / autopilot IA guest | **0** | 2 | 3 | 0 | 1 | 3 | 1 | 2 |
| IA agentique d'action | **1** | 1 | 3 | 0 | 0 | 1 | 0 | 1 |
| Architecture multi-agent productisée | **1** | 1 | 3 | 0 | 0 | 0 | 0 | 0 |
| IA de pricing / revenue management | **1** | 2 | 3 | 0 | 2 | 1 | 1 | 2 |
| Détection d'anomalies / fraude paiement | **0** | 2 | 3 | 0 | 0 | 1 | 0 | 0 |
| Guest screening / risque IA | **0** | 2 | 3 | 0 | 0 | 1 | 0 | 0 |
| Résumés IA (conversation / avis) | **0** | 2 | 2 | 0 | 1 | 2 | 0 | 1 |
| Génération de contenu (annonces) | **0** | 2 | 2 | 1 | 1 | 2 | 1 | 1 |
| Vision / analyse d'images (métier) | **1** | 1 | 1 | 0 | 0 | 1 | 0 | 0 |
| Multi-langue (IA / traduction) | **2** | 2 | 3 | 1 | 1 | 2 | 2 | 3 |
| Mémoire long terme de l'assistant | **2** | 0 | 1 | 0 | 0 | 1 | 0 | 0 |
| Moteur d'automatisations (workflow) | **2** | 3 | 3 | 2 | 2 | 3 | 3 | 2 |
| **Moyenne (16 sous-fct.)** | **1,2** | **1,8** | **2,6** | **0,3** | **0,8** | **1,6** | **0,6** | **1,2** |

### 4.2 — Repères AI-natifs (hors-grille, non moyennés dans le panel)

| Capacité | Jurny | Enso Connect | HostBuddy | Besty AI |
|---|:---:|:---:|:---:|:---:|
| IA agentique autonome | 3 | 2 | 2 | 2 |
| Autopilot guest | 3 | 3 | 3 | 3 |
| Multi-agent productisé | 3 | 1 | 1 | 1 |
| Détection fraude / screening | 3 | 1 | 0 | 0 |
| Upsell IA | 2 | 2 | 1 | 3 |

> **Lecture des scores.** Le **score domaine Clenzy = 2/3** (grille 0–3 appliquée au domaine : infrastructure IA conversationnelle/RAG solide, supérieure à la moyenne). La **moyenne granulaire de 1,2** est plus basse car elle inclut les sous-fonctionnalités où les leaders se différencient en 2025-2026 (autopilot, multi-agent productisé, anomalie/fraude, résumés, génération de contenu) et où Clenzy est à 0-1 (capacités dormantes ou absentes). Clenzy **bat tout le panel** sur l'assistant conversationnel, le multi-provider et la mémoire long terme, mais **se fait distancer par Guesty** sur l'IA agentique livrée. Confiance globale : **Confirmé** pour Guesty/Hostaway/Hospitable, **Probable** pour Smily/Avantio/Lodgify/Smoobu.

---

## Section 5 — Forces & faiblesses de Clenzy (positionnement)

**Parités (au niveau du marché)**
- **Multi-langue** : Clenzy = 2 (LLM + TranslationService 30 langues), à parité avec Hostaway/Avantio, sous Guesty/Smily (3).
- **Moteur d'automatisations** : Clenzy = 2, standard solide ; les leaders (3) ajoutent surtout de la profondeur (branchements, multi-action, IA Task Creation Guesty).
- **RAG** : Clenzy = 2 (2 étages, mais interne), proche de Guesty/Hostaway/Hospitable (3) — l'écart est l'absence de branchement au guest.

**Avantages différenciants**
- **Assistant conversationnel + multi-provider LLM (3)** : Clenzy **dépasse tout le panel PMS classique**. Multi-provider (Anthropic/OpenAI/Bedrock) avec routeur `@Primary`, streaming, budget par org — rare et flexible (la plupart des concurrents sont mono-modèle, souvent ChatGPT).
- **Mémoire long terme (2)** : **n°1 du panel** — quasiment aucun concurrent ne persiste des faits cross-session.
- **27 tools d'action** : socle agentique réel (créer/assigner intervention, bloquer calendrier, simuler pricing) supérieur à la plupart des copilotes concurrents purement conversationnels.

**Faiblesses critiques**
- **Détection d'anomalies / fraude = 0** : seul Smoobu/Lodgify/Avantio/Smily à 0 aussi, mais Guesty (PayProtect/Verify) et Hostaway dépassent largement. Lacune sécurité/revenu à l'heure où la fraude STR explose.
- **Autopilot guest = 0** : la chaîne s'arrête au draft (et OFF) ; Guesty/Hospitable (3) ont fait de l'autopilot leur différenciateur.
- **Multi-agent productisé = 1** : codé mais **flag OFF** alors que Guesty (Agent Hub, juin 2026) et Jurny (NIA) en font leur narratif central. Actif latent non livré.
- **IA dormante** : pricing-ai, messaging-ai, analytics-ai, sentiment-ai tous **OFF en prod** → l'IA n'est pas tissée au parcours client.
- **Pas de résumés ni génération de contenu** (0) : fonctions désormais standard chez Hostaway/Guesty/Hospitable.

---

## Section 6 — Synthèse chiffrée & écarts

| Acteur | Score moyen (16 sous-fct.) | Positionnement |
|---|:---:|---|
| Guesty | **2,6** | Leader IA agentique (Autopilot + AI Task Creation + Agent Hub, fraude, pricing) |
| Hostaway | **1,8** | IA native (Auto Reply) + marketplace d'agents + fraude/pricing |
| Hospitable | **1,6** | Auto-reply hôtes ancré Knowledge Hub (90 % auto) |
| **Clenzy** | **1,2** | Assistant conversationnel + multi-provider + mémoire forts ; agentique autonome & anomalies dormantes/absentes |
| Smily | **1,2** | FR, GuestReply AI (co-pilot/autopilot intégré) |
| Lodgify | **0,8** | AI Assistant messagerie inclus aux plans |
| Avantio | **0,6** | Harmony (automatisation templates), IA peu mise en avant |
| Smoobu | **0,3** | Entrée de gamme, pas d'IA native |

**Top 3 gaps** (écart le plus pénalisant pour le segment conciergerie pro FR)
1. **IA agentique autonome non livrée (multi-agent OFF, autopilot 0)** — le différenciateur structurant 2025-2026 (Guesty Agent Hub, Jurny NIA). Clenzy a les briques (`OrchestratorAgent`, 27 tools) mais ne les active pas.
2. **Détection d'anomalies / fraude = 0** — absent vs Guesty (PayProtect/Verify) & Hostaway. Enjeu sécurité paiement + screening guest, critique pour une conciergerie qui encaisse pour des tiers.
3. **IA non tissée au métier (flags OFF) + pas de résumés/génération de contenu** — l'infrastructure existe mais ne touche pas le parcours client (pricing, inbox guest, annonces).

**Top 3 avantages** (à défendre / mettre en avant)
1. **Assistant multi-provider (3)** — supérieur à tout le panel ; flexibilité modèle + budget par org, rare sur le marché.
2. **Mémoire long terme (2)** — n°1 du panel, quasi inexistante ailleurs.
3. **27 tools d'action + RAG 2-étages** — socle agentique et knowledge base techniquement au-dessus de la moyenne (manque « juste » l'activation et le branchement guest).

**Parités confirmées** : multi-langue, moteur d'automatisations, RAG (technique), copilote conversationnel (au-dessus même).

---

## Section 7 — Initiatives recommandées (priorisées)

> Format : `Titre | Type | Impact(1-3) | Effort(S/M/L) | Reach(1-3) | Confiance(0.1-1.0)`

1. **Activer l'IA messagerie (suggestion de réponse) + brancher le RAG à l'inbox guest** | Quick-win/IA | Impact 3 | Effort S | Reach 3 | Confiance 0,9
   *La chaîne LLM (`AiMessagingService`) et le RAG (`KbSearchService`) existent déjà ; activer `messaging-ai`, brancher la knowledge base sur les infos propriété/règles → équivalent Knowledge Hub Hospitable / KB Hostaway. Rattrape l'écart le plus visible à coût faible. Synergie avec l'initiative 1 du domaine 6.*

2. **Livrer le mode multi-agent (orchestrateur + spécialistes) en bêta encadrée** | Différenciation/IA | Impact 3 | Effort M | Reach 2 | Confiance 0,7
   *`OrchestratorAgent` + `SpecialistRegistry` sont codés derrière `clenzy.assistant.multi-agent.enabled=false`. Activer en bêta opt-in (spécialistes comm/pricing/ops) avec garde-fous → narratif « agentique » au niveau Guesty Agent Hub / Jurny NIA. L'effort est l'activation + la fiabilisation, pas la construction.*

3. **Implémenter la détection d'anomalies de paiement / fraude** | Parité/Sécurité | Impact 3 | Effort L | Reach 2 | Confiance 0,8
   *Lacune à 0 vs Guesty PayProtect/Verify & Hostaway. Scoring de risque sur patterns de paiement (montants, vélocité, méthodes) + signalement transactions à risque. Critique pour une conciergerie qui encaisse pour des propriétaires tiers. Réutilise les données Stripe/réservation déjà en base.*

4. **Autopilot guest avec garde-fous (au-dessus du draft)** | Différenciation/IA | Impact 3 | Effort L | Reach 2 | Confiance 0,7
   *Envoi auto sur intentions « sûres » (WiFi, check-in, parking) avec seuil de confiance, plage horaire, escalade si urgence/sentiment négatif. Cible Guesty ReplyAI Autopilot / Hospitable Inbox AI. Doublonne l'initiative 3 du domaine 6 — à mutualiser.*

5. **Cas d'usage vision métier + résumés IA** | Quick-win/IA | Impact 2 | Effort M | Reach 2 | Confiance 0,7
   *La vision Claude est branchée (`VisionTokenUsageService`) mais sous-exploitée : ajouter contrôle qualité ménage par photo (avant/après) et détection de dégâts ; + un tool de résumé de conversation/séjour. Coche deux cases standard chez les leaders, réutilise l'infra existante.*

---

### Sources (veille datée)
- Guesty — ReplyAI Autopilot + AI Task Creation : prnewswire.com (PR 22 avr. 2026), shorttermrentalz.com/news/guesty-integrates-ai-updates, aijourn.com (2026).
- Guesty — Agent Hub / Agent Center : travelandtourworld.com, prnewswire.com « Guesty Unveils First AI Agent for Revenue Management » (juin 2026), guesty.com/features/ai-for-short-term-rentals.
- Guesty — Verify / PayProtect / PriceOptimizer : guesty.com/features/ai-for-short-term-rentals (2026).
- Hostaway — Hostaway AI / Draft Replies / AI Auto Reply : hostaway.com/glossary/hostaway-ai, hostaway.com/blog/hostaway-ai-features, travolution.com & shorttermrentalz.com « AI Auto Reply » (2025-2026), hostaway.com/blog/2026-short-term-rental-report.
- Hospitable — Inbox AI / AI-Suggested Replies / Knowledge Hub : hospitable.com/features/inboxai, thehostreport.com « 45% increase in AI », patronus.ai case study (2025).
- Smily — GuestReply AI : smily.com/ai, smily.com/software/features/ai, manual.bookingsync.com, changelog.bookingsync.com (2025).
- Lodgify — AI Assistant : realtycrux.com « Lodgify AI-Powered Features 2025 », capterra (2026).
- Avantio — Harmony : avantio.com/blog/harmony-task-automation, capterra (2026).
- Smoobu — features : smoobu.com, capterra compare (2026).
- AI-natifs : jurny.com & blog.jurny.com (NIA / JurnyOS / Guest Screening, 2024-2026), businesswire.com (Jurny AI Multi-Agents, juin 2024) ; ensoconnect.com (CoPilot/AutoPilot, 2025) ; aeve.ai « Best AI Tools for Hostaway/Guesty 2026 » (HostBuddy) ; hostfully.com/integrations/besty-ai, capterra (Besty AI, 2026).
