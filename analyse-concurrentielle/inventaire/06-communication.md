# Inventaire interne — Domaine 6 : Communication voyageurs

> **Source de vérité :** code `server/src/main/java/com/clenzy/` + `client/src/modules/`.
> **Méthode :** lecture de fichiers (statut + preuve fichier:ligne). Date : 2026-06-13.
> **Score domaine (nous) :** **2 / 3** (standard du marché, sans le palier IA/autopilot des leaders).

---

## 1. Vue d'ensemble

Clenzy dispose d'une **inbox unifiée multi-canal** réelle (Airbnb, Booking, WhatsApp, Email, SMS*, Interne), d'un **moteur d'automatisation natif** événementiel (déclencheurs cycle de vie + conditions + offset/heure), d'un **WhatsApp dual-provider** (Meta Cloud API + OpenWA self-hosted) par organisation, d'une **traduction automatique** (DeepL/Google, 30 langues, branchée aux templates), et d'un **bloc IA messagerie** (suggestion de réponse + détection d'intention LLM) **branché de bout en bout mais désactivé par défaut** (feature flag).

Les deux écarts majeurs face aux leaders (Hostaway/Guesty/Hospitable) :
1. **SMS sans implémentation** (canal déclaré dans les enums, aucun bean d'envoi → repli email).
2. **IA messagerie non productisée** : capacité « suggestion de réponse » présente mais OFF par défaut ; **aucun mode auto-reply / autopilot** (le différenciateur 2025-2026 de Hospitable/Guesty).

\* SMS : enum déclaré, **0 implémentation** (voir §6).

---

## 2. Inbox unifiée multi-canal

| Élément | Statut | Preuve |
|---|---|---|
| Service inbox unifié | ✅ Implémenté | `service/messaging/ConversationService.java` (425 l.) |
| Canaux supportés | ✅ 6 canaux | `model/ConversationChannel.java` : `AIRBNB, BOOKING, WHATSAPP, EMAIL, SMS, INTERNAL` |
| Statuts de conversation | ✅ | `OPEN / CLOSED / ARCHIVED` (`ConversationStatus`) — inbox active exclut `ARCHIVED` |
| Assignation à un opérateur | ✅ | `assignConversation()` + `NotificationKey.CONVERSATION_ASSIGNED` (`ConversationService:259`) |
| Non-lu / compteur | ✅ | `setUnread`, `getUnreadCount()` (`ConversationService:403`) |
| Temps réel (WebSocket) | ✅ | `ConversationEventPublisher.publishNewMessage()` |
| Filtre par canaux | ✅ | `getInboxByChannels(orgId, channels, ...)` (`ConversationService:378`) |
| « À trier » + rattachement résa | ✅ | `attachToReservation()` : conv. orpheline (org SYSTEM) → réservation + mémo numéro WhatsApp (`ConversationService:296`) |
| UI inbox | ✅ | `client/src/modules/messaging/conversations/` (`unified.tsx`, `ConversationList.tsx`, `ThreadView.tsx`, `ChannelThread.tsx`, `InternalThread.tsx`) + `modules/contact/` |

---

## 3. Messagerie OTA native (Airbnb / Booking)

| Élément | Statut | Preuve |
|---|---|---|
| Réception messages OTA (inbound) | ✅ via Channex | `integration/channex/service/ChannexMessagingService.java:74` `onChannexMessage(payload)` → crée `ConversationMessage` |
| Envoi messages OTA (outbound) | ✅ via Channex | `ChannexMessagingService:145` `sendOutgoingMessage()` (refuse si canal ≠ AIRBNB/BOOKING) |
| Lister les threads par propriété | ✅ | `ChannexMessagingService:181` `listThreadsForProperty()` |
| Mapping canal Channex → enum | ✅ | `mapToConversationChannel()` (AIRBNB/BOOKING) |
| Webhook Channex | ✅ | `integration/channex/controller/ChannexWebhookController.java` |

> **Nuance vs briefing** : l'inbox OTA n'est pas « partielle » au sens fonctionnel — c'est une messagerie OTA two-way **réelle**. La réserve est architecturale : elle **dépend de Channex** comme intermédiaire (pas d'API Airbnb/Booking en direct pour la messagerie). Si l'OTA n'est pas connectée via Channex, pas de messagerie OTA.

---

## 4. Email (Brevo)

| Élément | Statut | Preuve |
|---|---|---|
| Canal email | ✅ | `service/messaging/EmailChannel.java` (bean `MessageChannel`, `getChannelType()=EMAIL`) |
| Client Brevo (transactionnel) | ✅ | `integration/brevo/BrevoApiClient.java` |
| Wrapper HTML / templates | ✅ | `service/messaging/EmailWrapperService.java` (14,8 KB), `SystemEmailTemplateService.java` |
| Sanitisation HTML (jsoup) | ✅ | `util/EmailHtmlSanitizer.java` (règle sécurité Z7-SEC-01/02) appliquée stockage + rendu |

---

## 5. WhatsApp (dual-provider, par organisation)

| Élément | Statut | Preuve |
|---|---|---|
| Résolution provider par-org | ✅ | `service/messaging/whatsapp/WhatsAppProviderResolver.java` (EnumMap `WhatsAppProviderType`, défaut `META`) |
| Provider Meta Cloud API | ✅ | `MetaWhatsAppProvider.java` — Graph API **v23.0** par défaut (`clenzy.whatsapp.meta.graph-api-base`) |
| Provider OpenWA (self-hosted) | ✅ | `OpenWaWhatsAppProvider.java`, `OpenWaSessionService.java` |
| Templates Meta + provisioning | ✅ | `MetaTemplateProvisioner.java`, `WhatsAppTemplateLoader/Service/Sender.java` |
| Fenêtre de service 24h Meta | ✅ | `ConversationService.deliverViaWhatsApp()` : hors fenêtre → `WINDOW_EXPIRED`, template requis (`ConversationService:211-223`) |
| Signature message (host + propriété) | ✅ | `buildSignedContent()` : « Jean (Villa Azur) : message » |
| Routage inbound | ✅ | `WhatsAppInboundRouter.java`, `WhatsAppWebhookService.java`, `OpenWaWebhookService.java` |
| Vérif. signature webhook | ✅ | `WhatsAppSignatureVerifier.java`, `OpenWaSignatureVerifier.java` |
| Onboarding embedded signup Meta | ✅ | `MetaSignupService.java` (14,5 KB) |
| Bannière statut front | ✅ | `client/src/modules/messaging/WhatsAppStatusBanner.tsx` |

> Le WhatsApp dual-provider est une **force différenciante** : OpenWA permet un canal WhatsApp non-officiel auto-hébergé (utile pour onboarding sans compte Meta Business vérifié), Meta Cloud API pour la conformité. La plupart des PMS s'appuient sur le seul WhatsApp Business API officiel (souvent en add-on payant).

---

## 6. SMS — **ABSENT** (enum sans implémentation)

| Élément | Statut | Preuve |
|---|---|---|
| Enum canal SMS | ⚠️ Déclaré | `model/MessageChannelType.java` (`SMS`), `model/ConversationChannel.java` (`SMS`) |
| Bean d'envoi SMS | ❌ Absent | Beans `MessageChannel` existants = **uniquement** `EmailChannel` + `WhatsAppChannel` (aucun `SmsChannel`) |
| Routage `findChannel(SMS)` | ❌ → null | `GuestMessagingService.findChannel()` retourne `null` pour SMS → **repli email** |
| Twilio | ❌ Retiré | Twilio entièrement retiré (PR #196, 2026-06-04) ; WhatsApp Meta+OpenWA conservés |

> **Verdict** : SMS = **0/3**. Le `case WHATSAPP, SMS -> request.recipientPhone()` (`GuestMessagingService:343`) prépare le terrain mais aucun transport SMS n'existe. Claim marketing « SMS Twilio + WhatsApp » = **faux** sur la partie SMS (cf. cadrage §8).

---

## 7. Automatisations natives (déclencheurs + conditions + templates)

| Élément | Statut | Preuve |
|---|---|---|
| CRUD règles d'automation | ✅ | `service/AutomationRuleService.java` (org-scopé, ownership) |
| Déclencheurs cycle de vie | ✅ 6 | `model/AutomationTrigger.java` : `RESERVATION_CONFIRMED, CHECK_IN_APPROACHING, CHECK_IN_DAY, CHECK_OUT_DAY, CHECK_OUT_PASSED, REVIEW_REMINDER` |
| Offset (jours) + heure d'envoi | ✅ | `triggerOffsetDays`, `triggerTime` (défaut `09:00`) (`AutomationRuleService:71-72`) |
| Conditions | ✅ | `conditions` (JSON) + `service/messaging/AutomationConditionEvaluator.java` |
| Action = envoi de message | ✅ | `AutomationAction.SEND_MESSAGE` + `template` + `deliveryChannel` (`MessageChannelType`) |
| Évaluation à la création de résa | ✅ | `AutomationEvaluationService.onReservationCreated()` (immédiat + planifié PENDING) |
| Drainage planifié | ✅ | `AutomationSchedulerService.java` |
| Idempotence d'exécution | ✅ | `existsByAutomationRuleIdAndReservationId()` (pas de double-envoi) |
| Historique d'exécution | ✅ | `AutomationExecutionRepository` + `getExecutions()` |
| UI automatisations | ✅ | `client/src/modules/messaging/MessagingAutomationSection.tsx` |

> **Distinct** de `service/AutomationService.java` qui gère des **webhooks sortants externes** (style Zapier/Make : `ExternalAutomation`, `AutomationPlatform`, `callbackUrl` + garde SSRF). C'est un canal d'intégration, pas le moteur de messages guest.

---

## 8. Templates + interpolation + traduction

| Élément | Statut | Preuve |
|---|---|---|
| Service templates | ✅ | `service/MessageTemplateService.java` |
| Interpolation variables (guest/résa/propriété) | ✅ | `service/messaging/TemplateInterpolationService.java` (15,4 KB) |
| Traduction automatique | ✅ Branchée | `interpolateAndTranslate()` traduit subject/HTML/plain via `TranslationService` (`TemplateInterpolationService:144-146`) |
| Provider DeepL | ✅ | `TranslationService.callDeepL()` (clé `deeplApiKey`) |
| Provider Google Translate | ✅ | `TranslationService.callGoogleTranslate()` |
| Langues supportées | ✅ 30 | `TranslationService.SUPPORTED_LANGUAGES` (fr, en, es, de, it, ar, zh, ja, ...) |
| Cache Redis | ✅ | clé `translation:<sha256>:<lang>`, TTL configurable |
| Éditeur de templates (front) | ✅ | `client/src/modules/messaging/MessageTemplateEditor.tsx`, `MessageTemplatesPage.tsx` |

> **Nuance vs briefing** : `TranslationService` est noté « partiel / pas branché aux templates » dans l'inventaire amont. Le code montre l'inverse — il **est** appelé par `TemplateInterpolationService.interpolateAndTranslate()`. La réserve réelle : c'est une **auto-traduction de templates** (sortants), pas une traduction bidirectionnelle de l'inbox temps réel (les messages guest reçus ne sont pas auto-traduits dans l'UI).

---

## 9. IA messagerie — **branchée mais OFF par défaut, sans autopilot**

| Élément | Statut | Preuve |
|---|---|---|
| Détection d'intention (règles) | ✅ | `AiMessagingService.detectIntent()` (mots-clés : CHECK_IN, WIFI, PARKING, PROBLEM, ...) |
| Réponse suggérée (templates fixes) | ✅ | `AiMessagingService.generateSuggestedResponse()` (templates pré-écrits + variables) |
| Urgence | ✅ | `isUrgent()` (mots-clés urgent/fuite/feu/enfermé) |
| Sentiment | ✅ basique | `analyzeSentiment()` (lexique positif/négatif, score -1..1) |
| **Détection d'intention LLM** | ⚠️ Branchée OFF | `detectIntentAi()` → `AiProviderRouter` (LLM réel) — exposé via `AiMessagingController` POST `/api/ai/messaging/ai-detect-intent` |
| **Réponse suggérée LLM** | ⚠️ Branchée OFF | `generateSuggestedResponseAi()` → LLM — POST `/api/ai/messaging/ai-suggest-response` ; UI `client/src/modules/messaging/AiMessagingControls.tsx` (hooks `useAiDetectIntent`/`useAiSuggestResponse`) |
| Feature flag | ⚠️ `false` | `config/AiProperties.java:119` `messagingAi = false` (défaut) ; gate `AiNotConfiguredException("AI_FEATURE_DISABLED")` |
| Budget tokens par org | ✅ | `AiTokenBudgetService.requireBudget(orgId, AiFeature.MESSAGING)` |
| Anonymisation PII avant LLM | ✅ | `AiAnonymizationService.anonymize()` (avant envoi au provider) |
| Auto-reply / autopilot | ❌ Absent | aucun mode d'envoi automatique de réponse IA sans validation humaine |

> **Correction importante de l'inventaire amont** : « Réponses IA / suggestions = ABSENT (sentiment seul) » est **trop sévère**. Le code contient une chaîne complète **suggestion de réponse par LLM** (back endpoint + UI + budget + anonymisation), mais :
> - elle est **désactivée par défaut** (`messaging-ai=false`) et donc **non productisée** ;
> - elle s'arrête au **draft suggéré** (human-in-the-loop), il n'y a **pas d'auto-reply / autopilot** comme Hospitable Inbox AI ou Guesty ReplyAI Autopilot.
>
> **Score IA sub-feature = 1** (capacité présente mais dormante et basique vs les copilotes/autopilots du marché).

---

## 10. Synthèse des sub-scores (nous)

| Sub-feature | Score | Commentaire |
|---|:---:|---|
| Inbox unifiée multi-canal | 3 | Statuts, assignation, non-lu, temps réel, filtres, « à trier » |
| Messagerie OTA native (Airbnb/Booking) | 2 | Two-way réel mais via Channex (pas d'API OTA directe) |
| Automatisations (déclencheurs/templates) | 2 | 6 déclencheurs cycle de vie + conditions + offset/heure — standard solide |
| Templates + interpolation | 2 | Variables guest/résa/propriété, éditeur front |
| Auto-traduction | 2 | DeepL/Google 30 langues, branchée aux templates sortants (pas l'inbox temps réel) |
| WhatsApp Business | 3 | Dual-provider Meta + OpenWA par org, fenêtre 24h, templates |
| SMS | 0 | Enum sans implémentation, repli email |
| Réponses IA / copilote | 1 | LLM branché mais OFF + pas d'autopilot |
| Sentiment | 1 | Lexical basique |
| **Score domaine** | **2** | Standard du marché ; manque le palier IA/SMS/autopilot des leaders |
