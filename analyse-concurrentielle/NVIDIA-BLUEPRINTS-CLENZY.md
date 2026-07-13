# NVIDIA Blueprints appliqués à Baitly — recommandation

> Recherche + reco produit/tech. Mapping des **NVIDIA AI Blueprints** (https://build.nvidia.com/blueprints)
> aux besoins du PMS Baitly (location courte durée multi-tenant).
> Auteur : recherche assistée. Date : 2026-06-26.
> **Statut : document de cadrage. Aucun code applicatif modifié.**

---

## 1. Résumé exécutif

**Ce qu'est un NVIDIA Blueprint.** Ce ne sont **pas des modèles**, mais des **workflows IA de référence**
(architecture + code GitHub + docker-compose/Helm + UI démo) qui assemblent plusieurs **NIM microservices**
(NVIDIA Inference Microservices) — LLM, embedding, reranker, OCR, VLM, ASR/TTS, etc. — en un pipeline métier
prêt à forker. Exemples : RAG d'entreprise, extraction PDF multimodale, assistant virtuel, digital human,
video search & summarization, PDF-to-podcast, traduction (Riva).

**Le point structurant pour Baitly — hosted vs self-hosted.** Il existe **deux mondes NVIDIA** qu'il faut
distinguer :

| | Modèles NIM **hébergés** (`build.nvidia.com` / `integrate.api.nvidia.com`) | **Blueprints** (le pipeline complet) |
|---|---|---|
| Nature | endpoints API OpenAI-compatibles | docker-compose / Helm qui orchestre N NIM |
| GPU | **aucun** côté client | souvent **self-hosted GPU** pour le pipeline complet |
| Coût | free tier (1 000 crédits, ~40 req/min, sans CB) puis NVIDIA AI Enterprise (~4 500 $/GPU/an ou ~1 $/GPU·h) | idem + coût GPU si self-hosté |
| Déjà utilisé par Baitly | **OUI** (voir §2) | non |

**Fait clé sur l'archi actuelle (vérifié dans le code).** Baitly **consomme déjà NVIDIA Build comme
provider LLM** : `OpenAiChatProvider` est un client générique OpenAI-compatible qui cible n'importe quel
`baseUrl` (OpenAI / NVIDIA Build / proxy Bedrock), routé par `ChatLLMRouter` selon le `PlatformAiModel`
choisi. Donc **brancher un modèle NIM hébergé supplémentaire = config (une ligne de catalogue), pas du code.**
En revanche, **un Blueprint complet self-hosté = nouveau chantier infra GPU** (hors stack Docker actuelle CPU
sur VPS OVH).

**Conséquence stratégique.** Les Blueprints ne sont, pour Baitly, **pas à déployer tels quels**. Ils sont
intéressants comme **architectures de référence à ré-implémenter en mode "tool du multi-agent"**, en
réutilisant **uniquement les NIM hébergés** (zéro GPU à gérer), OU comme **modèles que Baitly fait déjà
mieux** (le RAG existe déjà en pgvector). Le vrai gain est sur **3-4 capacités d'ingestion documentaire et
multimodale** que Baitly n'a pas encore.

### Top recommandations (détail §3 et §4)

| # | Blueprint NVIDIA | Besoin Baitly | Faisabilité | Priorité |
|---|---|---|---|---|
| 1 | **Multimodal PDF / Document extraction** (NeMo Retriever) | Factures fournisseurs, contrats, états des lieux, pièces d'identité guests | Moyenne (NIM hébergés OCR/table dispo en API) | **Quick win prioritaire** |
| 2 | **RAG / Enterprise RAG** (NeMo Retriever embed+rerank) | KB assistant — **existe déjà en pgvector** | Faible effort (swap d'embedding provider, déjà abstrait) | **Quick win (optionnel)** |
| 3 | **AI Virtual Assistant** (LangGraph) | L'assistant multi-agent Baitly — **existe déjà, plus avancé** | N/A (référence d'archi, pas à adopter) | Inspiration |
| 4 | **Video Search & Summarization (VSS)** | Caméras go2rtc : résumé/recherche d'événements vidéo | Faible (GPU lourd, self-hosté obligatoire) | Gros chantier / différé |
| 5 | **Riva Translation** | Multi-langue booking engine (déjà fait via LLM `translate-html`) | N/A (déjà couvert, Riva = speech surtout) | Non prioritaire |

---

## 2. État des lieux IA Baitly (pour calibrer la faisabilité)

Vérifié dans le repo :

- **Routeur multi-provider** : `config/ai/ChatLLMRouter.java` (`@Primary`) dispatche `ChatRequest.provider()`
  vers `AnthropicChatProvider` ou `OpenAiChatProvider`. Le client OpenAI est **générique** et sert
  OpenAI **et NVIDIA Build** (et un proxy "Bedrock") via `baseUrl` dynamique
  (`OpenAiChatProvider.resolveBaseUrl`). NVIDIA Build est donc **déjà un fournisseur de modèles de
  première classe** côté chat.
- **Catalogue de modèles plateforme** : `model/PlatformAiModel`, `PlatformAiConfigService`,
  + surveillance de dispo (`AiModelAvailabilityScheduler`, migration `0281`). Ajouter un modèle hébergé
  NVIDIA = entrée de catalogue.
- **Assistant agentique** : `service/agent/` — interface `ToolHandler` + `ToolRegistry` (découverte Spring),
  `AgentOrchestrator`, `AgentToolLoopRunner`, et **~50 tools** dans `service/agent/tools/`
  (`ListReservationsTool`, `GetPriceQuoteTool`, `SearchKnowledgeBaseTool`, `GetWeatherForecastTool`, etc.).
  Multi-agent en cours : `service/agent/multiagent/` (`AbstractAgentSpecialist`, `SpecialistRegistry`).
- **RAG déjà en place** : `service/agent/kb/` avec `EmbeddingProvider` abstrait → `VoyageEmbeddingProvider`
  / `OpenAIEmbeddingProvider`, reranker `VoyageRerankProvider` / `NoOpRerankProvider`. Stockage **pgvector**
  (`kb_document` / `kb_chunk`, index ivfflat cosine). Tool `search_knowledge_base` + auto-injection.
- **Vision** : l'assistant accepte déjà des images (Claude Vision, jusqu'à 3 images/message).
- **Vidéo** : flux caméras via **go2rtc** déjà déployé (WebRTC/RTSP), mais **aucune analyse IA** dessus.
- **Pas d'OCR / extraction documentaire structurée** aujourd'hui (aucune classe OCR/extraction trouvée).
  C'est le **gap** que les Blueprints d'ingestion documentaire viennent combler.

> **Règle d'or des tools (à respecter pour toute intégration)** : un `ToolHandler` n'accède jamais
> à la DB directement — il délègue à un service Spring qui porte l'autorisation et le filtrage multi-tenant
> (cf. javadoc `ToolHandler.java`). Toute capacité NVIDIA s'intègre derrière un service Java, jamais en direct.

---

## 3. Catalogue des Blueprints pertinents → besoin Baitly

Tableau central. **Faisabilité** = adéquation avec l'archi actuelle (API hébergées vs GPU à héberger).
**Intégration** = comment ça se branche (tool du multi-agent vs intégration séparée).

| Blueprint NVIDIA | Brique(s) NIM | Besoin business Baitly | Valeur | Faisabilité (hosted vs GPU) | Effort | Intégration | Priorité |
|---|---|---|---|---|---|---|---|
| **Multimodal PDF / Document Extraction** (NeMo Retriever : page-elements, table-structure, graphic-elements, PaddleOCR) | OCR + détection tables/charts + VLM | Lire **factures fournisseurs**, **contrats/mandats**, **états des lieux**, **pièces d'identité guests**, justificatifs → champs structurés | **Élevée** : automatise une saisie 100% manuelle, réduit erreurs facturation/NF | **Moyenne** : les NIM d'extraction sont exposés en API hébergée (démo catalogue) → pas de GPU si on appelle l'API ; mais débit/SLA limités en free tier, prod = AI Enterprise | M (1 service + 1 tool + parsing) | **Tool** `extract_document_fields` (déléguant à un `DocumentExtractionService`) **+** hook d'ingestion (à l'upload d'une facture/pièce) | **P1 — quick win** |
| **RAG / Enterprise RAG** (NeMo Retriever embed `llama-nemoretriever`, rerank, guardrails) | embedding + rerank + LLM | Base de connaissances de l'assistant | **Faible-moyenne** : Baitly a **déjà** un RAG pgvector équivalent | **Élevée** : `EmbeddingProvider` est déjà une abstraction → ajouter `NvidiaEmbeddingProvider` (API hébergée) à côté de Voyage/OpenAI ; rerank idem | S (1 provider + config) | Pas un nouveau tool : **swap de provider** d'embedding/rerank derrière l'interface existante | **P3 — option** (seulement si benchmark recall meilleur ou pour rester mono-fournisseur NVIDIA) |
| **AI Virtual Assistant** (LangGraph, 3 sous-agents, Llama 3.3 70B + NeMoTron embed/rerank) | LLM + RAG orchestrés | L'assistant Baitly | **Référence** : valide l'archi multi-agent (Baitly fait déjà ça, en plus métier) | N/A | — | Étudier comme **modèle d'archi** (sous-agents spécialisés, routing) pour `service/agent/multiagent/`. **Ne pas adopter le code** (déprécié avr. 2026). | Inspiration |
| **Video Search & Summarization (VSS)** (VLM + LLM + RAG vidéo, CV pipeline) | VLM + ASR + LLM | Analyser les flux **caméras (go2rtc)** : détecter événements (présence hors créneau, fête, dégâts), résumer une plage horaire, recherche en langage naturel ("montre les arrivées hier soir") | **Élevée** (sécurité/conciergerie) mais **niche** | **Faible** : VSS **exige du GPU self-hosté** (A100/H100/H200, ou edge RTX 6000 Pro / DGX Spark) + licence AI Enterprise. Hors stack VPS CPU actuelle. Données vidéo = **RGPD sensible**. | XL | **Intégration séparée** (microservice GPU) exposée à l'assistant via un tool `search_camera_events` ; **pas** dans le monolithe | **P4 — gros chantier / différé** |
| **Digital Human** (ACE / Tokkio : avatar 3D + ASR + TTS + LLM) | ASR + TTS + animation + LLM | Avatar conciergerie / check-in guest animé | **Faible** (gadget pour un PMS B2B), fort effet démo | **Très faible** : 2×T4/L4 min, ~700 Go RAM, GPU GDN. Latence + coût disproportionnés. | XL | Séparée | **Non recommandé** (sauf besoin marketing ponctuel) |
| **PDF-to-Podcast** | LLM + TTS | Générer un **audio** du livret d'accueil / d'un récap réservation pour le guest | **Faible-moyenne** (différenciant livret d'accueil) | **Moyenne** : LLM hébergé OK ; TTS = soit NIM hébergé, soit service tiers (ElevenLabs/Polly) plus simple | M | **Tool** `generate_audio_guide` ou job côté livret d'accueil | P3 — nice-to-have |
| **Structured Data Extraction / Data Flywheel** (NeMo microservices fine-tuning) | LLM + fine-tuning | Améliorer en continu l'extraction documentaire sur les formats récurrents (mêmes modèles de factures) | Moyenne (optimisation de #1) | **Faible** : fine-tuning = GPU + MLOps lourds, prématuré | L+ | — | Différé (après #1 en prod) |
| **Riva Translation** (NMT / Riva-Translate-4B) | NMT (et ASR/TTS) | Multi-langue booking engine | **Faible** : Baitly traduit **déjà** le Studio via LLM (`translate-html`, jsoup+LLM) | **Faible** : Riva orienté **speech temps réel** ; pour du texte le LLM actuel suffit | — | — | **Non prioritaire** (déjà couvert) |

---

## 4. Les 3-5 recommandations détaillées

### ⭐ Reco 1 — Extraction documentaire multimodale (PRIORITÉ HAUTE)

**Besoin Baitly.** Aujourd'hui, factures fournisseurs, mandats/contrats, états des lieux et pièces
d'identité guests sont traités à la main. C'est le **gap IA le plus concret** : aucune brique OCR/extraction
n'existe dans le code.

**Cas d'usage classés :**
1. **Factures fournisseurs** (ménage, maintenance) → montant HT/TTC, TVA, date, fournisseur → pré-remplir
   une dépense (attention NF/compta : recalcul serveur, jamais confiance au montant extrait — cf. règle
   "argent" du CLAUDE.md).
2. **États des lieux / inventaires photo** → liste structurée + détection d'anomalies (multimodal).
3. **Pièces d'identité guests** (check-in réglementaire) → extraction nom/date/n° → **données RGPD
   ultra-sensibles** : préférer un traitement éphémère, pas de stockage du brut, et idéalement un NIM
   plutôt que d'envoyer une CNI à un LLM grand public.

**Faisabilité.** Les NIM d'extraction (PaddleOCR, table-structure, page-elements) sont **exposés en API
hébergée** sur build.nvidia.com → **pas de GPU** pour un POC. Limites : free tier ~40 req/min, prod =
licence AI Enterprise. Alternative pragmatique : commencer avec **Claude/GPT Vision** (déjà branché,
l'assistant lit déjà des images) pour les cas simples, et réserver le pipeline NeMo aux **PDF multi-pages
avec tables** où il excelle (recall@5 supérieur, ~15× plus rapide selon NVIDIA).

**Intégration.** Service `DocumentExtractionService` (porte l'autorisation + multi-tenant) + tool
`extract_document_fields` (déléguant au service) **et** un hook à l'upload (via `PhotoStorageService`
déjà utilisé pour les images assistant). Suivre `ToolHandler` : tool fin, logique dans le service.

**Effort : M.** **Piège principal : RGPD sur les pièces d'identité** (minimisation, rétention, sous-traitant
hors UE → DGX Cloud localisation à vérifier).

### ⭐ Reco 2 — RAG : option d'un provider d'embedding NVIDIA (QUICK WIN, OPTIONNEL)

**Besoin.** Le RAG existe déjà (pgvector + Voyage/OpenAI). Pas un manque, mais une **option d'optimisation /
de consolidation fournisseur**.

**Faisabilité : élevée, effort minimal.** `EmbeddingProvider` est déjà une abstraction propre
(`VoyageEmbeddingProvider`, `OpenAIEmbeddingProvider`). Ajouter `NvidiaEmbeddingProvider` ciblant le NIM
d'embedding hébergé (`llama-nemoretriever-*`, OpenAI-compatible) = **une classe + config**, aucune migration.
Idem pour un reranker NVIDIA hébergé à la place de `NoOpRerankProvider`.

**Quand le faire.** Seulement si (a) un benchmark recall montre un gain net sur la doc Baitly FR, ou
(b) volonté de réduire le nombre de fournisseurs IA. Sinon **ne rien changer** (YAGNI).

**Intégration.** **Pas un tool** : swap derrière l'interface existante. **Effort : S.**

### Reco 3 — AI Virtual Assistant : référence d'architecture (INSPIRATION, PAS D'ADOPTION)

Le blueprint LangGraph (3 sous-agents : routing + spécialistes) **valide la direction** du chantier
`service/agent/multiagent/` en cours. À lire comme **modèle de découpage** (un agent par domaine, un
routeur). **Ne pas porter le code** (Python/LangGraph, déprécié avr. 2026, et Baitly est Java/Spring avec
une couche tools déjà plus riche et plus sûre — multi-tenant + ownership). Valeur = **confirmation
d'archi**, zéro effort d'intégration.

### Reco 4 — Video Search & Summarization sur les caméras (GROS CHANTIER / DIFFÉRÉ)

**Besoin.** go2rtc diffuse déjà les flux ; aucune intelligence dessus. VSS permettrait : résumé d'une plage
("que s'est-il passé entre 22h et 2h ?"), recherche NL d'événements, alerte sur sur-occupation / fête —
complément naturel des capteurs de bruit Minut.

**Faisabilité : faible à court terme.** VSS **impose du GPU self-hosté** (A100/H100/H200 ou edge RTX 6000
Pro / DGX Spark) + AI Enterprise. **Incompatible** avec le VPS CPU actuel. **RGPD vidéo** = sujet lourd
(consentement, rétention, finalité). À traiter comme **microservice GPU séparé** exposé à l'assistant via un
tool `search_camera_events`, **pas** dans le monolithe Spring. **Effort : XL.** À garder en **veille** (relié
à la roadmap IoT), pas un chantier 2026 sauf budget GPU dédié.

### Reco 5 (écartée) — Traduction & Digital Human

- **Riva Translation** : la traduction texte du booking engine est **déjà faite via LLM** (`translate-html`).
  Riva est surtout pertinent pour la **voix temps réel** (ASR/TTS), hors scope. **Non prioritaire.**
- **Digital Human (Tokkio)** : coût/latence GPU disproportionnés pour un PMS B2B (2×T4 min, ~700 Go RAM).
  **Écarté** sauf besoin marketing ponctuel (démo salon).

---

## 5. Pièges & prérequis (à lire avant tout POC)

1. **Hosted ≠ Blueprint.** Les modèles **NIM hébergés** (chat, embedding, OCR) s'appellent en API sans GPU —
   c'est ça que Baitly peut consommer immédiatement. Un **Blueprint complet** (RAG entreprise, VSS, digital
   human) est un **pipeline self-hosté** : ne pas confondre "tester la démo en ligne" et "déployer le
   blueprint".
2. **Coût.** Free tier dev : 1 000 crédits (jusqu'à 5 000 sur demande), ~40 req/min, sans CB — **OK pour
   POC, pas pour la prod**. Production = **NVIDIA AI Enterprise** (~4 500 $/GPU/an, ou ~1 $/GPU·h cloud ;
   éval 90 j gratuite). Le **self-hosting GPU** (VSS, digital human) ajoute le coût matériel/cloud GPU.
3. **Pas de GPU dans la stack actuelle.** Le déploiement Baitly (Docker Compose / VPS OVH) est **CPU**.
   Tout blueprint self-hosté = **nouvelle infra** (cloud GPU ou edge). Règle CLAUDE.md : **ne jamais
   relancer/modifier les containers sans demander**.
4. **RGPD / données sensibles.** Pièces d'identité, vidéos de caméras, messages guests → vérifier la
   **localisation** des endpoints hébergés (DGX Cloud), la **rétention**, le statut **sous-traitant**.
   Pour les CNI, privilégier extraction éphémère sans stockage du brut. Argent (factures) : **recalcul
   serveur obligatoire**, le champ extrait n'est qu'un cross-check (règle "argent" CLAUDE.md).
5. **Latence.** Un pipeline multi-NIM (OCR → table → VLM → LLM) ajoute des sauts réseau. Pour de
   l'interactif (tool dans une conversation assistant), préférer un appel **asynchrone** (job + notification)
   plutôt que bloquer la boucle de tools.
6. **Lock-in fournisseur.** Garder l'abstraction (`EmbeddingProvider`, `ChatLLMProvider`) : NVIDIA en
   **option supplémentaire**, jamais en dépendance dure. C'est déjà la philosophie du `ChatLLMRouter`.
7. **Maturité/maintenance.** Certains blueprints bougent vite (l'AI Virtual Assistant est marqué déprécié
   avr. 2026). Traiter les blueprints comme **références d'archi**, pas comme dépendances versionnées.

---

## 6. Comment l'intégrer — tool du multi-agent vs intégration séparée

Arbre de décision, aligné sur l'archi `service/agent/` existante :

```
La capacité est un APPEL API hébergé, court, déclenchable par l'assistant ?
  ├─ OUI → TOOL (ToolHandler) déléguant à un Service Spring
  │        Ex : extract_document_fields, generate_audio_guide, search_camera_events (façade)
  │        → suit la règle d'or : autorisation + multi-tenant dans le SERVICE, pas le tool
  │
  └─ NON (pipeline lourd, GPU, traitement long/asynchrone, flux continu) →
           INTÉGRATION SÉPARÉE (microservice / job) + éventuel tool "façade" read-only
           Ex : VSS (microservice GPU) ; extraction batch de factures (job + Outbox)
```

**Pour un swap d'infra IA pure (embeddings/rerank/LLM)** : **ni tool ni microservice** — nouvelle
implémentation derrière l'abstraction existante (`EmbeddingProvider`, `ChatLLMProvider`) + entrée de
catalogue `PlatformAiModel`. C'est le chemin le plus court et le plus sûr (reco 2).

**Patron d'un nouveau tool NVIDIA (reco 1)** — schéma, pas du code à copier :
- `DocumentExtractionService` (Spring) : reçoit `storageKey` + type de doc, résout les bytes via
  `PhotoStorageService`, appelle le NIM hébergé (via un client OpenAI-compatible analogue à
  `OpenAiChatProvider`, ou le client d'extraction dédié), renvoie un DTO structuré. **Porte l'autorisation
  et le tenant.**
- `ExtractDocumentFieldsTool implements ToolHandler` : `name()` = `extract_document_fields`,
  `descriptor()` avec schéma JSON des args (`storageKey`, `documentType`), `execute()` délègue au service.
  Confirmation requise si l'extraction déclenche une écriture (création de dépense).

---

## 7. Synthèse priorisation

| Priorité | Action | Pourquoi maintenant |
|---|---|---|
| **P1 (quick win)** | POC **extraction documentaire** (factures d'abord) via NIM hébergé OU Vision déjà branché ; mesurer précision FR | Gap réel, valeur métier immédiate, **pas de GPU** |
| **P2** | Décider du périmètre RGPD pour pièces d'identité avant d'industrialiser l'extraction | Bloquant légal sur le cas le plus sensible |
| **P3 (option)** | Benchmark embeddings NVIDIA hébergés vs Voyage/OpenAI sur la doc FR ; n'adopter que si gain | Effort minimal, mais YAGNI si pas de gain |
| **P3 (nice-to-have)** | Audio du livret d'accueil (PDF-to-Podcast simplifié, TTS hébergé ou tiers) | Différenciant livret, faible criticité |
| **P4 (différé)** | **VSS** sur caméras → microservice GPU séparé | Forte valeur conciergerie mais **GPU + RGPD vidéo** = chantier dédié |
| **Écarté** | Digital Human, Riva Translation | Coût/latence GPU ou déjà couvert (traduction LLM) |

---

## Sources

- [NVIDIA Blueprints — build.nvidia.com](https://build.nvidia.com/blueprints)
- [NVIDIA-AI-Blueprints — GitHub org (liste des blueprints)](https://github.com/NVIDIA-AI-Blueprints)
- [Build an Enterprise RAG Pipeline Blueprint](https://build.nvidia.com/nvidia/build-an-enterprise-rag-pipeline)
- [RAG Blueprint — GitHub](https://github.com/NVIDIA-AI-Blueprints/rag)
- [Multimodal PDF Data Extraction for Enterprise RAG](https://build.nvidia.com/nvidia/multimodal-pdf-data-extraction-for-enterprise-rag)
- [Build an Enterprise-Scale Multimodal PDF Data Extraction Pipeline (blog)](https://developer.nvidia.com/blog/build-an-enterprise-scale-multimodal-document-retrieval-pipeline-with-nvidia-nim-agent-blueprint/)
- [NeMo Retriever — Multimodal PDF Extraction 15x Faster (blog)](https://developer.nvidia.com/blog/nvidia-nemo-retriever-delivers-accurate-multimodal-pdf-data-extraction-15x-faster/)
- [AI Virtual Assistant Blueprint — GitHub (LangGraph)](https://github.com/NVIDIA-AI-Blueprints/ai-virtual-assistant)
- [Video Search and Summarization (VSS) Blueprint — GitHub](https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization)
- [VSS Blueprint — build.nvidia.com](https://build.nvidia.com/nvidia/video-search-and-summarization)
- [Digital Human Blueprint — GitHub](https://github.com/NVIDIA-AI-Blueprints/digital-human)
- [Tokkio Quickstart (GPU requirements)](https://docs.nvidia.com/ace/tokkio/latest/quickstart-guide.html)
- [PDF to Podcast Blueprint](https://build.nvidia.com/nvidia/pdf-to-podcast)
- [AI-Q Blueprint (chat with enterprise data)](https://build.nvidia.com/nvidia/aiq)
- [Riva Translation Overview](https://docs.nvidia.com/deeplearning/riva/user-guide/docs/translation/translation-overview.html)
- [NVIDIA NIM — free developer access / credits (blog)](https://developer.nvidia.com/blog/access-to-nvidia-nim-now-available-free-to-developer-program-members/)
- [Try NVIDIA NIM APIs (hosted catalog)](https://build.nvidia.com/)
