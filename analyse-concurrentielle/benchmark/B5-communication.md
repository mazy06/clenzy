# B5 — Benchmark : Communication voyageurs

> **Domaine 6** (pondération cadrage : 11 % — « volume de travail n°1 d'une conciergerie »).
> **Panel :** Clenzy vs Hostaway, Guesty, Smoobu, Lodgify, Hospitable, Avantio, Smily.
> **Grille 0–3** (cf. cadrage §5). Concurrents : datés + sourcés + niveau de confiance. Veille web : 2024-2026.
> **Date :** 2026-06-13.

---

## Section 1 — Périmètre & taxonomie du domaine

La « communication voyageurs » couvre l'ensemble des canaux et automatismes par lesquels un gestionnaire échange avec ses voyageurs sur le cycle de vie d'une réservation. Sous-fonctionnalités retenues (comparables) :

1. **Inbox unifiée multi-canal** — agréger toutes les conversations (OTA, email, SMS, WhatsApp) dans un fil unique.
2. **Messagerie OTA native** — recevoir/envoyer sur la boîte de messages Airbnb / Booking / Vrbo.
3. **Automatisations** — déclencheurs événementiels (confirmation, J-x check-in, post-départ, demande d'avis) + envoi de template.
4. **Templates + interpolation** — modèles réutilisables avec variables guest/résa/propriété.
5. **SMS** — envoi/réception natif.
6. **WhatsApp Business** — canal WhatsApp officiel (et/ou non-officiel).
7. **Réponses IA / copilote** — suggestion de réponse rédigée par LLM (human-in-the-loop).
8. **Auto-reply / autopilot IA** — envoi automatique de la réponse IA sans validation.
9. **Auto-traduction** — traduction automatique des messages (sortants et/ou entrants).
10. **Scheduling** — programmation d'envoi.
11. **Hors-heures / horaires d'ouverture** — bascule automatique / messages en dehors des heures.
12. **Sentiment / urgence** — classification émotionnelle / priorisation.
13. **Collaboration équipe** — assignation, fils partagés, multi-login.
14. **Knowledge base / FAQ IA** — base de connaissances alimentant les réponses IA.

---

## Section 2 — Inventaire interne Clenzy (vérité code)

*(détail complet : `inventaire/06-communication.md`)*

**Forces (preuves code)**
- **Inbox unifiée réelle** : `ConversationService` (6 canaux `ConversationChannel`, statuts OPEN/CLOSED/ARCHIVED, assignation, non-lu, WebSocket temps réel, filtres par canal, file « à trier » → rattachement résa).
- **Messagerie OTA two-way** via Channex : `ChannexMessagingService.onChannexMessage()` (inbound) + `sendOutgoingMessage()` (outbound Airbnb/Booking).
- **WhatsApp dual-provider par-org** : `WhatsAppProviderResolver` → Meta Cloud API (Graph v23.0) **ou** OpenWA self-hosted ; fenêtre de service 24h Meta gérée (`WINDOW_EXPIRED` + template requis), signature host+propriété, embedded signup Meta.
- **Email Brevo** sanitisé jsoup (`EmailHtmlSanitizer`), wrapper + templates système.
- **Automatisations natives** : `AutomationRule` (6 déclencheurs cycle de vie, offset jours, heure d'envoi, conditions JSON, idempotence, historique d'exécution) + `AutomationEvaluationService` + `AutomationSchedulerService`.
- **Auto-traduction branchée aux templates** : `TemplateInterpolationService.interpolateAndTranslate()` → `TranslationService` (DeepL + Google, 30 langues, cache Redis).
- **IA messagerie branchée de bout en bout** : `AiMessagingController` (`/ai/messaging/ai-suggest-response`, `/ai-detect-intent`) → `AiMessagingService.generateSuggestedResponseAi()` (LLM via `AiProviderRouter`, anonymisation PII, budget tokens par org) + UI `AiMessagingControls.tsx`.

**Faiblesses (preuves code)**
- **SMS = 0** : `MessageChannelType.SMS` / `ConversationChannel.SMS` déclarés mais **aucun bean d'envoi** (seuls `EmailChannel` + `WhatsAppChannel`) → `findChannel(SMS)=null` → repli email. Twilio retiré (PR #196).
- **IA = OFF par défaut + pas d'autopilot** : flag `messaging-ai=false` (`AiProperties:119`) ; la chaîne LLM existe mais n'est pas activée en standard et **s'arrête au draft suggéré** (pas d'auto-reply autonome).
- **Sentiment lexical basique** (`analyzeSentiment()` à base de mots-clés), pas de modèle.
- **Pas de knowledge base / FAQ dédiée à la messagerie** (le RAG pgvector existe pour l'assistant interne, pas branché à l'inbox guest).
- **Dépendance Channex** pour toute la messagerie OTA (pas d'API Airbnb/Booking en direct).

**Score interne domaine : 2/3** (standard du marché ; sans le palier IA/SMS/autopilot des leaders).

---

## Section 3 — Analyse concurrent par concurrent (daté & sourcé)

### Hostaway — **2,7/3** *(le plus complet du panel)*
Inbox unifiée consolidant OTA + email + **SMS et WhatsApp natifs en bidirectionnel** dans l'inbox et les automatisations. Templates personnalisables, messages programmés déclenchés par événements de réservation, collaboration équipe. **Guest Messaging AI (propulsé par ChatGPT)** : suggestions de réponses personnalisées (historique de conversation + détails résa + annonce), **validation humaine requise avant envoi**. *Donnée marquante 2025 : +170 % d'adoption des fonctions IA en YoY ; 47 % des PM > 26 annonces déclarent un gain de temps majeur ; jusqu'à 90 % des messages automatisés.* **Confiance : Confirmé** (pages produit + support Hostaway, 2025).

### Guesty — **2,6/3** *(le plus avancé en IA proactive)*
Inbox unifiée multi-canal (OTA + **email, SMS, WhatsApp Business**) avec statuts colorés, réponse via n'importe quel canal. **ReplyAI** : soft-launch fév. 2024, **lancement officiel août 2024** ; GenAI sur historique guest/host, utilisé par > 40 % des comptes (~20 % des messages rédigés). **2025 :** 3 nouveautés IA (Suggestions Adjustments, Improve with AI, Conversation Summary). **Avril 2026 : ReplyAI Autopilot + AI Task Creation** — agent IA proactif embarqué dans le PMS (envoi auto). **Confiance : Confirmé** (PR Guesty, ShortTermRentalz, Travolution, help center).

### Hospitable — **2,4/3** *(référence automatisation + IA messagerie pour hôtes)*
Inbox unifiée Airbnb / Vrbo / Booking.com / Agoda / direct. Automatisations matures (check-in, rappels, demandes d'avis). **AI-suggested replies** (1 clic, ton de l'hôte) disponibles largement. **Inbox AI** : auto-reply entièrement automatisé s'appuyant sur le **Knowledge Hub** (infos propriété + règles + conversations passées) ; **rollout 2025**, actuellement réservé au palier **Mogul**, réponses en 1-2 min (étapes de validation/sécurité). Faible sur SMS/WhatsApp natifs (orienté messagerie OTA). **Confiance : Confirmé** (pages produit + support Hospitable, 2025).

### Smily (ex-BookingSync) — **2,2/3** *(origine française)*
Inbox unifiée Airbnb / Booking / Vrbo / email / site direct. **GuestReply AI** (intégration) : réponses 24/7 < 1 min, **jusqu'à 92 % d'automatisation**, multilingue, apprentissage du style de l'hôte ; l'inbox IA flag les messages urgents, rédige des réponses pro, fournit du contexte. WhatsApp/SMS moins documentés en natif. **Confiance : Probable** (changelog BookingSync + manual Smily 2025 ; GuestReply est un partenaire intégré, pas 100 % natif).

### Avantio — **2,1/3** *(agences EU/FR, multi-owner)*
Inbox unifiée (OTA + email + WhatsApp + SMS) intégrée aux 3 portails majeurs (Airbnb, Booking, Vrbo) + WhatsApp ; **WhatsApp vérifié et SMS global en add-ons optionnels**. Automatisation via **Harmony** (messages déclenchés/programmés : confirmation, check-in, rappels paiement, post-séjour). Collaboration : assignation, tags, filtres. IA messagerie moins mise en avant que Hostaway/Guesty. **Confiance : Probable** (pages produit Avantio 2025 ; modules SMS/WhatsApp en add-on).

### Lodgify — **1,9/3** *(orienté site direct)*
Inbox unifiée regroupant **SMS, WhatsApp, OTA et même les appels** ; **AI Assistant** dans l'inbox (génère des réponses personnalisées). Messages automatisés avant-arrivée → post-départ, setup sans code. Icône WhatsApp ajoutée mai 2025. Partenariat **Conduit** pour enrichir la communication guest. **Confiance : Probable** (pages produit + blog Lodgify 2025 ; profondeur d'automatisation/IA en deçà des leaders).

### Smoobu — **1,2/3** *(entrée de gamme, Europe/FR)*
Inbox unifiée Airbnb + Booking centralisée. Templates d'automatisation (bibliothèque de 6 modèles essentiels), envoi sur **email, inbox OTA, ou SMS**, déclenchés par timestamps. Intégration guest guide. **Pas d'IA messagerie native** mise en avant ; WhatsApp non natif (via intégration tierce type Guestway). **Confiance : Probable** (pages produit + support Smoobu 2025).

---

## Section 4 — Tableau comparatif synthétique

*(détail granulaire 14 fonctionnalités : `data/06-communication.csv`)*

| Fonctionnalité | Clenzy | Hostaway | Guesty | Smoobu | Lodgify | Hospitable | Avantio | Smily |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Inbox unifiée multi-canal | 3 | 3 | 3 | 2 | 3 | 3 | 3 | 3 |
| Messagerie OTA native | 2 | 3 | 3 | 2 | 2 | 3 | 3 | 3 |
| Automatisations | 2 | 3 | 3 | 2 | 2 | 3 | 3 | 2 |
| Templates + variables | 2 | 3 | 3 | 3 | 3 | 3 | 3 | 3 |
| SMS natif | **0** | 3 | 2 | 2 | 3 | 1 | 2 | 1 |
| WhatsApp Business | **3** | 3 | 3 | 1 | 3 | 1 | 2 | 2 |
| Réponses IA (copilote draft) | **1** | 3 | 3 | 0 | 2 | 3 | 2 | 3 |
| Auto-reply / autopilot IA | **0** | 2 | 3 | 0 | 1 | 3 | 1 | 2 |
| Auto-traduction | 2 | 2 | 2 | 1 | 1 | 2 | 2 | 3 |
| Scheduling | 2 | 3 | 3 | 2 | 2 | 3 | 2 | 2 |
| Hors-heures | 1 | 2 | 2 | 1 | 1 | 2 | 1 | 1 |
| Sentiment / urgence | 1 | 2 | 2 | 0 | 1 | 2 | 1 | 2 |
| Collaboration équipe | 2 | 3 | 3 | 1 | 2 | 2 | 3 | 2 |
| Knowledge base FAQ IA | 1 | 3 | 2 | 0 | 1 | 3 | 1 | 2 |
| **Moyenne (14 sous-fct.)** | **1,6** | **2,7** | **2,6** | **1,2** | **1,9** | **2,4** | **2,1** | **2,2** |

> **Lecture des scores.** Le **score domaine Clenzy = 2/3** (grille 0–3 appliquée au domaine : un standard de marché solide). La **moyenne granulaire de 1,6** est plus basse car elle inclut des sous-fonctionnalités où les leaders se différencient en 2025-2026 (autopilot IA, knowledge base, SMS, hors-heures) et où Clenzy est à 0-1. C'est précisément l'écart à combler. Confiance globale concurrents : **Confirmé** pour Hostaway/Guesty/Hospitable, **Probable** pour Smily/Avantio/Lodgify/Smoobu.

---

## Section 5 — Forces & faiblesses de Clenzy (positionnement)

**Parités (au niveau du marché)**
- **Inbox unifiée** : Clenzy = 3, à parité avec tous sauf Smoobu — point fort partagé.
- **Templates + interpolation** : standard atteint (2-3 chez tous).
- **Auto-traduction** : Clenzy = 2 (DeepL/Google 30 langues), à parité voire au-dessus de la moyenne ; seul Smily (GuestReply multilingue) se détache à 3.
- **Automatisations** : 6 déclencheurs cycle de vie + conditions = standard solide ; les leaders (3) ajoutent surtout de la profondeur (branchements, segments, multi-action).

**Avantages différenciants**
- **WhatsApp dual-provider (Meta + OpenWA) par organisation** : Clenzy = 3, **au-dessus de la moyenne** du panel. Hospitable (1) et Smoobu (1) sont faibles sur WhatsApp ; Meta+self-hosted est rare (la plupart = WhatsApp Business officiel seul, souvent en add-on payant — cf. Avantio).
- **Email sanitisé jsoup + conformité** : robustesse sécurité (héritée de l'audit 2026-06) que les pages produit concurrentes ne mettent pas en avant.

**Faiblesses critiques**
- **SMS = 0** : seul acteur du panel **sans aucun SMS** (tous les autres ont au moins un SMS natif ou add-on, Hostaway/Lodgify à 3). Écart le plus visible commercialement.
- **IA messagerie non productisée** : Clenzy = 1 (draft LLM existant mais OFF), **0 en autopilot**. Les leaders ont fait de l'IA messagerie LEUR différenciateur 2025-2026 (Guesty ReplyAI Autopilot avr. 2026, Hospitable Inbox AI, Hostaway +170 % adoption IA, Smily GuestReply 92 % d'automatisation). C'est l'écart le plus structurant.
- **Pas de knowledge base alimentant la messagerie** : Hostaway et Hospitable (Knowledge Hub) montent à 3 — c'est ce qui rend leurs réponses IA crédibles.

---

## Section 6 — Synthèse chiffrée & écarts

| Acteur | Score moyen (14 sous-fct.) | Positionnement |
|---|:---:|---|
| Hostaway | **2,7** | Leader complétude (SMS+WhatsApp+IA ChatGPT) |
| Guesty | **2,6** | Leader IA proactive (ReplyAI Autopilot 2026) |
| Hospitable | **2,4** | Référence automatisation + Inbox AI (Knowledge Hub) |
| Smily | **2,2** | FR, GuestReply AI (92 % auto, multilingue) |
| Avantio | **2,1** | Agences EU/FR, Harmony + SMS/WhatsApp add-on |
| Lodgify | **1,9** | Site direct + inbox (SMS/WhatsApp/appels) + AI Assistant |
| **Clenzy** | **1,6** | Inbox + WhatsApp dual forts ; SMS=0 & IA non productisée |
| Smoobu | **1,2** | Entrée de gamme, pas d'IA, WhatsApp non natif |

**Top 3 gaps** (écart le plus pénalisant pour le segment conciergerie pro FR)
1. **SMS absent (0 vs 1-3 partout)** — fonctionnalité de base attendue, repli email insuffisant pour le check-in/urgences.
2. **Réponses IA non activées + pas d'autopilot (1/0 vs 2-3 chez les leaders)** — le différenciateur n°1 du marché 2025-2026 ; capacité déjà codée mais dormante.
3. **Pas de knowledge base messagerie (1 vs 3 Hostaway/Hospitable)** — sans elle, l'IA suggérée reste générique.

**Top 3 avantages** (à défendre / mettre en avant)
1. **WhatsApp dual-provider Meta + OpenWA par org (3)** — supérieur à la moyenne, rare sur le marché.
2. **Inbox unifiée complète (3)** — assignation, temps réel, file « à trier », parité leaders.
3. **Auto-traduction branchée aux templates (DeepL/Google, 30 langues)** — au niveau/au-dessus du marché, atout pour une clientèle internationale.

**Parités confirmées** : inbox unifiée, templates+variables, auto-traduction, profondeur d'automatisation de base.

---

## Section 7 — Initiatives recommandées (priorisées)

> Format : `Titre | Type | Impact(1-3) | Effort(S/M/L) | Reach(1-3) | Confiance(0.1-1.0)`

1. **Activer + productiser l'IA de suggestion de réponse (flag ON par défaut, UI inbox)** | Quick-win/IA | Impact 3 | Effort S | Reach 3 | Confiance 0,9
   *La chaîne LLM existe déjà (`AiMessagingService.generateSuggestedResponseAi` + `AiMessagingController` + `AiMessagingControls.tsx`) ; il s'agit surtout d'activer `messaging-ai`, de calibrer le budget par org et de soigner l'UX dans le fil de conversation. Rattrape l'écart le plus structurant à faible coût.*

2. **Implémenter le canal SMS natif (bean `SmsChannel`)** | Parité | Impact 2 | Effort M | Reach 3 | Confiance 0,9
   *Brancher un transport SMS (provider FR/EU, ex. Brevo SMS déjà partenaire email, ou OVH/Vonage) sur l'interface `MessageChannel` existante → supprime le repli email et coche une case attendue par tous les prospects.*

3. **Mode auto-reply IA (autopilot) avec garde-fous** | Différenciation/IA | Impact 3 | Effort L | Reach 2 | Confiance 0,7
   *Au-dessus du draft suggéré : envoi automatique sur intentions « sûres » (WiFi, check-in, parking) avec confiance minimale, plage horaire, escalade humaine si urgence/sentiment négatif. Cible le palier Guesty Autopilot / Hospitable Inbox AI. Effort élevé (sécurité, validation, conformité).*

4. **Knowledge base de messagerie branchée à l'IA suggérée** | Différenciation/IA | Impact 2 | Effort M | Reach 2 | Confiance 0,8
   *Réutiliser le RAG pgvector interne (déjà en place pour l'assistant) pour alimenter les réponses guest depuis les infos propriété/règles/FAQ → crédibilise l'IA (équivalent Hospitable Knowledge Hub). Synergie forte avec l'initiative 1.*

5. **Auto-traduction bidirectionnelle dans l'inbox temps réel** | Quick-win | Impact 2 | Effort S | Reach 2 | Confiance 0,8
   *`TranslationService` traduit déjà les templates sortants ; étendre à l'affichage des messages entrants (traduction à la volée + langue d'origine visible) dans `ThreadView.tsx`. Rejoint le niveau Smily/Guesty multilingue.*

---

### Sources (veille datée)
- Hospitable — Unified Inbox / Inbox AI / Auto Reply : hospitable.com/features/unified-inbox, /features/inboxai, help.hospitable.com (2025).
- Guesty — Unified Inbox + ReplyAI : guesty.com/features/unified-inbox, PR Guesty « ReplyAI Autopilot » (avr. 2026), shorttermrentalz.com & travolution.com (2024), help.guesty.com (2025).
- Hostaway — Guest Communication AI : hostaway.com/features/communication, support.hostaway.com « Guest Messaging AI », hostaway.com/blog (2025).
- Smoobu — Guest communication : smoobu.com/en/automatic-guest-communications-vacation-rentals, support.smoobu.com (2025).
- Lodgify — Unified Inbox / AI Assistant / Conduit : lodgify.com/unified-inbox, /guest-management, /blog (mai 2025).
- Avantio — Unified Inbox / Harmony : avantio.com/unified-inbox, avantio.com/blog/vacation-rental-unified-inbox (2025).
- Smily — Unified Inbox / GuestReply AI : smily.com/software/features/unified-inbox, changelog.bookingsync.com, manual.bookingsync.com (2025).
- Enso Connect — « Best AI for STR Guest Messaging (2025 Guide) » : ensoconnect.com (panel transverse).
