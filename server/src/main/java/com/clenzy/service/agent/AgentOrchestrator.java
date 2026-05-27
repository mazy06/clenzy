package com.clenzy.service.agent;

import com.clenzy.config.AiProperties;
import com.clenzy.config.ai.ChatEvent;
import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.config.ai.ChatMessage;
import com.clenzy.config.ai.ChatRequest;
import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.config.ai.MessageAttachment;
import com.clenzy.model.AssistantConversation;
import com.clenzy.model.AssistantMemory;
import com.clenzy.model.AssistantMessage;
import com.clenzy.model.OrgAiApiKey;
import com.clenzy.repository.AssistantConversationRepository;
import com.clenzy.repository.AssistantMessageRepository;
import com.clenzy.repository.OrgAiApiKeyRepository;
import com.clenzy.service.AssistantMemoryService;
import com.clenzy.service.PhotoStorageService;
import com.clenzy.service.agent.kb.KbSearchService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Consumer;

/**
 * Orchestrateur de l'assistant conversationnel.
 *
 * <p><b>Boucle principale</b> : a chaque tour, on envoie au LLM l'historique de la
 * conversation + la liste des tools. Le LLM peut :
 * <ol>
 *   <li>Repondre en texte → on persiste, on emet les deltas, fin du tour</li>
 *   <li>Demander l'execution d'outils → on execute chaque tool, on appelle le LLM
 *       a nouveau avec les resultats, on continue jusqu'a obtenir une reponse texte
 *       (ou MAX_ITERATIONS pour borner la boucle).</li>
 * </ol>
 *
 * <p><b>Securite</b> :
 * <ul>
 *   <li>Les tools s'executent dans le contexte tenant/user du caller (rien ne bypass).</li>
 *   <li>Les conversations sont scoped par {@code keycloakId} (verifie en amont).</li>
 *   <li>La cle API est resolue via BYOK → fallback plateforme ; jamais loggee.</li>
 * </ul>
 *
 * <p><b>Persistance</b> : a chaque tour, les messages user/assistant/tool sont
 * persistes en BDD avant emission SSE — si la connexion SSE casse en cours
 * de stream, l'historique est conserve.</p>
 */
@Service
public class AgentOrchestrator {

    private static final Logger log = LoggerFactory.getLogger(AgentOrchestrator.class);
    private static final int MAX_TOOL_ITERATIONS = 5;
    private static final int MAX_TOKENS_PER_TURN = 4096;
    private static final double DEFAULT_TEMPERATURE = 0.3;
    private static final int MAX_MEMORY_ENTRIES = 30;
    /** Nombre de chunks RAG injectes dans le system prompt par tour. */
    private static final int RAG_TOP_K = 4;
    /** Seuil de relevance en dessous duquel un chunk RAG n'est pas injecte. */
    private static final double RAG_RELEVANCE_MIN = 0.70;
    private static final String DEFAULT_SYSTEM_PROMPT = """
            Tu es l'assistant strategique Clenzy, un PMS (Property Management System) pour la
            location courte duree. Ton role : aider l'utilisateur a COMPRENDRE ses donnees,
            CONSEILLER une strategie, et le GUIDER dans le PMS via des liens cliquables.

            Tu es plus qu'un chatbot : tu es un copilote business. Tu interpretes les insights,
            tu pose des questions de clarification quand utile, tu suggeres des actions concretes.

            Regles de communication :
            - Reponds toujours en francais, ton conversationnel mais professionnel.
            - Markdown autorise : **gras**, *italique*, listes a puces, liens [texte](/route).
            - Format des dates en francais : "12 juin 2026" plutot que "2026-06-12" dans le texte.
            - Si un outil retourne une erreur, explique le probleme sans inventer la donnee.

            IMPORTANT — Rendu visuel automatique des donnees :
            - Quand un outil retourne des donnees structurees (KPIs, listes, graphiques, insights),
              le frontend affiche AUTOMATIQUEMENT un widget visuel au-dessus de ton texte.
            - Ne reproduis donc PAS les donnees brutes (pas de tableau markdown, pas de liste
              exhaustive d'items, pas de pourcentages que le pie chart affiche deja).
            - Limite-toi a un COMMENTAIRE strategique (2-4 phrases) qui :
              * synthetise l'insight cle ("le pic est en juillet", "3 alertes critiques")
              * POSE des questions ou suggere des actions ("veux-tu qu'on regarde X ?", "tu devrais Y")
              * propose un lien vers la bonne section du PMS via suggest_navigation
            - Exemple : "Tu as 12 reservations cette semaine, dont 3 a Paris. Le pic est jeudi.
              Tu veux que je verifie si tes menages sont bien planifies pour ces jours-la ?"

            ─── Catalogue d'outils ─────────────────────────────────────────────

            DONNEES (read-only) :
            - get_dashboard_summary → KPI plateforme (uptime, double bookings, etc.)
            - list_properties / list_reservations / list_cleaning_tasks → tables
            - get_interventions_by_status → pie chart distribution statuts
            - get_reservation_trend → line chart N mois evolution reservations
            - get_financial_summary → bar chart revenus/depenses/profit par mois
            - get_properties_performance → bar chart top N proprietes (revenus + interventions)

            STRATEGIQUE (AI-powered) :
            - get_business_insights(propertyId) → liste d'insights AI (anomalies, recommandations,
              warnings, tendances) pour UNE propriete. Tu DOIS interpreter chaque insight et
              proposer une strategie globale a l'utilisateur, pas juste lire.
            - get_occupancy_forecast(propertyId, days) → prevision occupation N jours.
              Repere les pics et creux, suggere des actions (yield management, promotion, etc.).
            - simulate_pricing_change(propertyId, pctChange, from?, to?) → projection revenue
              d'un changement de prix (-50..+50%). Modele d'elasticite 0.5.
            - simulate_calendar_block(propertyId, from, to) → estimation de la perte revenue
              si une plage de dates est bloquee (base sur l'annee precedente).
            Utiliser ces simulations pour 'que se passe-t-il si', 'simulation', 'scenario',
            'what if', 'combien je perds si je bloque', 'combien je gagne en baissant'.

            STRATEGIQUE PORTFOLIO :
            - analyze_portfolio(daysBack?) → vue d'ensemble cross-property + patterns + top
              et sous-performers. Utiliser pour 'vue d'ensemble', 'tout mon portfolio',
              'comparer mes properties', 'analyse globale'. Le widget affiche KPI globaux,
              top 3, sous-performants avec recommandations, patterns detectes (volatilite,
              ratings par ville). Ne reproduis PAS les chiffres ; commente la sante globale
              et propose 1 action prioritaire.

            CONTEXTE EXTERIEUR (donnees publiques pour contextualiser tes recos) :
            - get_weather_forecast(city|propertyId, days?) → previsions meteo 1..7 jours.
              Utiliser pour nourrir des recos pricing/promo (ex: pluie samedi a Paris →
              "propose une promo last-minute" ou "renforce le check-in indoor").
              Si propertyId fourni, la ville de la propriete est utilisee.
            - get_local_events(city, from?, to?) → jours feries, festivals, salons, evenements
              sportifs. Utiliser pour expliquer un pic de demande passe ou anticiper un
              pic futur (ex: Roland-Garros → "tarifs +15% recommandes sur la quinzaine").

            DOCUMENTATION (RAG knowledge base) — REGLES STRICTES :
            - search_knowledge_base(query, topK?) → recherche par embeddings dans la doc
              Clenzy (globale) + les notes internes de l'org.
            - Utilise-le quand l'user demande "selon la doc...", "comment fonctionne X dans
              Clenzy", "quelle est la procedure officielle pour Y".

            ANTI-HALLUCINATION (impératif) :
            1. Si tu utilises un snippet retourne par ce tool OU fourni dans le "Contexte
               documentation pertinente" du system prompt, tu DOIS le citer explicitement
               sous la forme : « Selon [titre](sourcePath), ... ».
            2. Si la question concerne un point precis (procedure, fonctionnalite specifique,
               regle de pricing/billing/legal) et que la doc ne le couvre pas, dis
               explicitement : "La documentation Clenzy ne couvre pas ce point precis,
               je peux te donner mon analyse mais sans garantie d'exactitude."
               N'invente JAMAIS une procedure, un numero d'article ou un nom de fonctionnalite
               qui n'apparait pas dans les snippets fournis.
            3. Si plusieurs snippets se contredisent, signale-le ("La doc presente deux
               approches differentes : ...") au lieu de choisir arbitrairement.
            4. La relevance affichee est indicative — un snippet a 60% peut etre faux. Si
               le contenu ne repond pas vraiment a la question, dis-le.

            WORKFLOWS (procedures guidees multi-etapes) :
            Si l'user demande "aide-moi a...", "guide-moi pour...", "comment je fais pour...",
            propose un workflow et lance-le via start_workflow. Workflows disponibles :
            - onboard_property : 5 etapes (basic info → pricing → channels → photos → confirm).
            - end_of_month_closing : 4 etapes (verify revenue → payouts → reports → close).
            - prepare_high_season : 5 etapes (window → pricing → amenities → housekeeping → events).
            Boucle :
              1. start_workflow(workflow_id) → recoit step #1 dans le payload.
              2. Affiche le prompt du step a l'user (le widget l'affiche aussi visuellement).
              3. Quand l'user repond, appelle advance_workflow(run_id, user_response).
              4. Si le payload contient suggestedAction, propose-la a l'user et invoque-la
                 si confirmation positive.

            ECRITURE (avec confirmation user — toujours valide avant d'agir) :
            - block_calendar_day → bloque une plage de dates sur le calendrier
            - create_intervention → cree une intervention (menage/maintenance/etc.) sur une propriete
            - assign_intervention → assigne une intervention a un user OU une team
            - cancel_reservation → annule une reservation (irreversible)
            - update_property_status → change statut propriete (ACTIVE/INACTIVE/UNDER_MAINTENANCE/ARCHIVED)
            - send_guest_message → envoie un message via template au guest d'une reservation
            - forget_fact → supprime une entree de la memoire long-terme (irreversible, confirmation requise)

            MEMOIRE LONG-TERME (personnalisation cross-conversations) :
            Tu as une memoire long-terme. Utilise remember_fact des qu'un utilisateur te donne
            une info utile pour le futur. Quatre categories (scope) :
              * preference : preference d'usage (briefing_time=08:00, user_prefers_metric=true, currency=EUR)
              * fact       : fait persistant (owner_42_difficile, villa_med_bruit_recurrent, guest_VIP_carlos)
              * goal       : objectif business mesurable (Q3_target_80_occupancy, reduce_cleanings_cost_15pct)
              * project    : chantier en cours avec deadline (renovation_appt_paris_juin, refonte_pricing_2026)
            La cle (key) DOIT etre stable, explicite, en snake_case — elle sera ecrasee si reutilisee.
            Ne demande pas la permission de retenir : retiens automatiquement et confirme brievement.
            - remember_fact(key, value, scope) → enregistre/met a jour une entree (pas de confirmation)
            - forget_fact(key) → supprime une entree (confirmation requise)
            La memoire deja connue est listee en debut de system prompt (section "Memoire utilisateur").

            NAVIGATION (guide l'utilisateur dans le PMS) :
            - suggest_navigation(path, label, reason) → produit un BOUTON CLIQUABLE qui amene
              l'utilisateur sur la bonne page du PMS. Utilise-le proactivement quand :
              * l'utilisateur demande "ou puis-je", "comment configurer", "ou trouver"
              * tu suggeres une action qui necessite d'aller ailleurs
              * apres avoir presente un insight qui appelle un parametrage

            ─── Carte des routes PMS (pour suggest_navigation) ─────────────────

            Operations :
              /planning            Calendrier multi-proprietes (vue d'ensemble drag&drop)
              /dashboard           Tableau de bord KPI quotidiens
              /properties          Gestion des proprietes (ajout, edition, photos, amenities)
              /interventions       Menages + maintenance + check-in/out
              /reservations        Liste des reservations
              /directory           Annuaire (equipes, prestataires, guests)

            Pilotage :
              /reports             Rapports detailles (Financier, Operationnel, Equipes, Proprietes)
              /reports?tab=financial    Bilan financier
              /reports?tab=interventions Reports operationnels
              /reports?tab=teams        Performance equipes
              /reports?tab=properties   Performance proprietes

            Revenue :
              /tarification        Pricing dynamique (regles, seasonalite, last-minute)
              /billing             Paiements, factures, payouts proprietaires
              /contracts           Contrats de gestion / mandats
              /channels            Connexions Airbnb / Booking / Vrbo / iCal
              /booking-engine      Widget direct sans commission

            Communication :
              /contact             Messages guests (email/SMS/WhatsApp)
              /documents           Templates documents (devis, factures, contrats)

            Configuration :
              /settings            Parametres globaux
              /settings?tab=ai     Configuration IA (cles BYOK, modeles, features ON/OFF)
              /settings?tab=notifications  Preferences notifications
              /settings?tab=organization   Profil organisation

            Admin (super-admin uniquement) :
              /monitoring          Monitoring infra (KPI tech, services)
              /shop                Boutique d'options et upsells

            Exemples d'usage de suggest_navigation :
            - Question : "comment activer l'IA analytics ?" → suggest_navigation(
                path="/settings?tab=ai", label="Parametres IA", reason="Active analyticsAi ici")
            - Apres insight "ton ADR est sous le marche" → suggest_navigation(
                path="/tarification", label="Ajuster la tarification",
                reason="Configure les regles de pricing dynamique")
            - Question "ou voir mes revenus mensuels" → suggest_navigation(
                path="/reports?tab=financial", label="Rapport financier",
                reason="Vue detaillee mensuelle des revenus et depenses")

            Tu peux appeler PLUSIEURS outils en chaine si necessaire (ex: get_business_insights
            pour l'analyse, puis suggest_navigation pour la CTA).
            """;

    private final ChatLLMProvider chatProvider;
    private final ToolRegistry toolRegistry;
    private final AssistantConversationRepository conversationRepository;
    private final AssistantMessageRepository messageRepository;
    private final ObjectMapper objectMapper;
    private final OrgAiApiKeyRepository orgAiApiKeyRepository;
    private final AiProperties aiProperties;
    private final PendingToolStore pendingToolStore;
    private final AssistantMemoryService memoryService;
    private final PhotoStorageService photoStorageService;
    private final KbSearchService kbSearchService;
    private final com.clenzy.service.agent.prompt.PromptBuilder promptBuilder;
    private final com.clenzy.service.agent.multiagent.OrchestratorAgent multiAgentOrchestrator;
    private final com.clenzy.service.agent.multiagent.SpecialistRegistry specialistRegistry;

    /**
     * Feature flag : si true, utilise l'architecture multi-agent (orchestrator
     * + spécialistes ≤10 tools chacun) au lieu du mono-agent (27 tools en bloc).
     *
     * <p><b>Defaut false</b> : audit pre-prod (2026-05-28) a identifie 7
     * regressions bloquantes (confirmation user des write tools, memoire
     * long-terme perdue, auto-injection RAG perdue, history conversationnelle
     * non transmise, BYOK ignore, audit logging perdu, langue user ignoree).
     * Le multi-agent reste opt-in jusqu'a ce que les fixes bloquants soient
     * livres et valides en dev.</p>
     *
     * <p>Override (uniquement en dev pour tester) :
     * {@code clenzy.assistant.multi-agent.enabled=true}</p>
     */
    private final boolean multiAgentEnabled;

    /**
     * Feature flag rollback : si true, utilise le nouveau {@link com.clenzy.service.agent.prompt.PromptBuilder}
     * (v2, sectionne en XML). Si false, fallback sur l'ancien {@link #DEFAULT_SYSTEM_PROMPT}.
     *
     * <p>Defaut true (v2 active). En cas de souci en prod, set
     * {@code clenzy.assistant.prompt.v2.enabled=false} → retour instantane a l'ancien
     * comportement sans redeploy de code.</p>
     *
     * <p>Garde-fou supplementaire : si v2 throw ou retourne null/blank, on log
     * + fallback automatique sur v1 (voir {@link #buildSystemPrompt}).</p>
     *
     * <p><b>Injecte via constructor</b> (pas via field) : permet aux tests
     * unitaires de l'instancier sans Spring tout en pouvant exercer les deux
     * chemins v1/v2 explicitement.</p>
     */
    private final boolean promptV2Enabled;

    /**
     * Constructeur Spring (lit la valeur via {@code @Value} sur le parametre).
     * Le parametre {@code promptV2Enabled} est injecte par Spring depuis la config.
     */
    public AgentOrchestrator(ChatLLMProvider chatProvider,
                              ToolRegistry toolRegistry,
                              AssistantConversationRepository conversationRepository,
                              AssistantMessageRepository messageRepository,
                              ObjectMapper objectMapper,
                              OrgAiApiKeyRepository orgAiApiKeyRepository,
                              AiProperties aiProperties,
                              PendingToolStore pendingToolStore,
                              AssistantMemoryService memoryService,
                              PhotoStorageService photoStorageService,
                              KbSearchService kbSearchService,
                              com.clenzy.service.agent.prompt.PromptBuilder promptBuilder,
                              com.clenzy.service.agent.multiagent.OrchestratorAgent multiAgentOrchestrator,
                              com.clenzy.service.agent.multiagent.SpecialistRegistry specialistRegistry,
                              @org.springframework.beans.factory.annotation.Value("${clenzy.assistant.prompt.v2.enabled:true}")
                              boolean promptV2Enabled,
                              @org.springframework.beans.factory.annotation.Value("${clenzy.assistant.multi-agent.enabled:false}")
                              boolean multiAgentEnabled) {
        this.chatProvider = chatProvider;
        this.toolRegistry = toolRegistry;
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.objectMapper = objectMapper;
        this.orgAiApiKeyRepository = orgAiApiKeyRepository;
        this.aiProperties = aiProperties;
        this.pendingToolStore = pendingToolStore;
        this.memoryService = memoryService;
        this.photoStorageService = photoStorageService;
        this.kbSearchService = kbSearchService;
        this.promptBuilder = promptBuilder;
        this.multiAgentOrchestrator = multiAgentOrchestrator;
        this.specialistRegistry = specialistRegistry;
        this.promptV2Enabled = promptV2Enabled;
        this.multiAgentEnabled = multiAgentEnabled;
    }

    /**
     * Lance ou continue une conversation et stream les evenements au consommateur SSE.
     *
     * @param conversationId conversation existante (null = nouvelle)
     * @param userMessage    message texte de l'utilisateur
     * @param context        contexte d'execution (org, user, jwt)
     * @param consumer       callback SSE pour pousser les evenements au frontend
     * @return id de la conversation (utile pour les nouvelles conversations)
     */
    public Long handleMessage(Long conversationId,
                               String userMessage,
                               AgentContext context,
                               Consumer<AgentSseEvent> consumer) {
        return handleMessage(conversationId, userMessage, List.of(), context, consumer);
    }

    /**
     * Variante avec attachments (images uploadees via {@code POST /assistant/upload}).
     * Pour chaque attachment, on stocke la ref JSON sur l'AssistantMessage et on
     * resout les bytes via {@link PhotoStorageService} pour les fournir en base64
     * au LLM (uniquement pour le tour courant — les tours suivants re-resoudront
     * depuis le storage en relisant l'historique).
     */
    public Long handleMessage(Long conversationId,
                               String userMessage,
                               List<AttachmentRef> attachments,
                               AgentContext context,
                               Consumer<AgentSseEvent> consumer) {
        boolean hasAttachments = attachments != null && !attachments.isEmpty();
        if ((userMessage == null || userMessage.isBlank()) && !hasAttachments) {
            throw new IllegalArgumentException("userMessage or attachments required");
        }
        String effectiveMessage = userMessage == null ? "" : userMessage;

        // 1. Resoudre la conversation (creer si null)
        AssistantConversation conversation = resolveOrCreateConversation(conversationId, context);
        if (conversationId == null) {
            consumer.accept(AgentSseEvent.conversationCreated(conversation.getId()));
        }

        // 2. Persister le message user (+ refs attachments JSON si presentes)
        String attachmentsJson = hasAttachments
                ? serializeAttachmentsSafe(attachments)
                : null;
        AssistantMessage userMsg = AssistantMessage.user(
                conversation.getId(), context.organizationId(), effectiveMessage, attachmentsJson);
        messageRepository.save(userMsg);

        // 3. Charger l'historique complet (post-insert du user message)
        List<AssistantMessage> history = messageRepository.findByConversation(conversation.getId());
        List<ChatMessage> chatMessages = toChatMessages(history);

        // 4. Tentative multi-agent (si flag on + sans attachments + spécialistes prêts).
        //    Attachments → fallback mono-agent car les spécialistes ne gerent pas
        //    encore les images Vision (TODO v2).
        //    Pas de spécialiste → impossible, fallback aussi.
        //    Si multi-agent throw, on log et fallback automatiquement.
        if (canUseMultiAgent(context, hasAttachments)) {
            try {
                boolean handledByMultiAgent = tryMultiAgentFlow(
                        effectiveMessage, context, conversation, consumer);
                if (handledByMultiAgent) {
                    // 5. Update conversation updatedAt + title si manquant
                    conversation.setUpdatedAt(LocalDateTime.now());
                    if (conversation.getTitle() == null) {
                        conversation.setTitle(deriveTitle(effectiveMessage));
                    }
                    conversationRepository.save(conversation);
                    return conversation.getId();
                }
            } catch (Exception e) {
                log.warn("Multi-agent flow failed, falling back to mono-agent : {}",
                        e.getMessage(), e);
            }
        }

        // 4 (fallback). Boucle tool-calling mono-agent (27 tools)
        String apiKey = resolveApiKey(context.organizationId());
        List<ToolDescriptor> tools = toolRegistry.listDescriptors();
        String systemPrompt = buildSystemPrompt(context, effectiveMessage);
        ChatRequest request = new ChatRequest(
                systemPrompt, chatMessages, tools, context.modelOverride(),
                DEFAULT_TEMPERATURE, MAX_TOKENS_PER_TURN);

        runToolLoop(request, conversation, context, apiKey, consumer);

        // 5. Update conversation updatedAt + title si manquant
        conversation.setUpdatedAt(LocalDateTime.now());
        if (conversation.getTitle() == null) {
            conversation.setTitle(deriveTitle(effectiveMessage.isBlank() ? "Photos" : effectiveMessage));
        }
        conversationRepository.save(conversation);

        return conversation.getId();
    }

    /**
     * Reprise apres confirmation/refus utilisateur sur un tool requiresConfirmation.
     *
     * <p>Si {@code confirmed=true} : execute le tool, persiste le resultat, et
     * relance la boucle LLM avec le resultat. Si {@code confirmed=false} : ecrit
     * un tool result "annule par l'utilisateur" et relance le LLM pour qu'il
     * formule une reponse "ok, j'ai annule".</p>
     *
     * @param toolCallId id du tool en attente
     * @param confirmed  decision user
     * @param context    contexte courant (peut differer de celui au moment de la pause)
     * @param consumer   callback SSE pour stream la suite
     * @return id de la conversation reprise
     */
    public Long resumeAfterConfirmation(String toolCallId,
                                         boolean confirmed,
                                         AgentContext context,
                                         Consumer<AgentSseEvent> consumer) {
        PendingToolStore.PendingTool pending = pendingToolStore
                .consume(toolCallId, context.keycloakId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Tool en attente " + toolCallId + " introuvable / expire / non autorise"));

        // Recharger la conv pour update updatedAt en fin de boucle
        AssistantConversation conversation = conversationRepository
                .findByIdAndUser(pending.conversationId(), context.keycloakId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Conversation " + pending.conversationId() + " introuvable"));

        // Construire le tool result : execution reelle OU "annule par user"
        ToolResult result;
        if (confirmed) {
            Optional<ToolHandler> handler = toolRegistry.find(pending.toolName());
            if (handler.isEmpty()) {
                result = ToolResult.error("Tool '" + pending.toolName() + "' n'est plus disponible");
            } else {
                try {
                    JsonNode args = parseArgsSafe(pending.argsJson());
                    result = handler.get().execute(args, context);
                } catch (ToolExecutionException e) {
                    log.info("Tool '{}' a echoue apres confirmation : {}", pending.toolName(), e.getMessage());
                    result = ToolResult.error(e.getMessage());
                } catch (Exception e) {
                    log.error("Tool '{}' exception inattendue apres confirmation", pending.toolName(), e);
                    result = ToolResult.error("Erreur interne lors de l'execution de " + pending.toolName());
                }
            }
        } else {
            result = ToolResult.error("L'utilisateur a refuse l'execution de cette action.");
        }

        consumer.accept(AgentSseEvent.toolCallExecuted(
                pending.toolName(), pending.toolCallId(),
                result.isError(), result.displayHint(),
                result.isError() ? null : result.content()));

        // Persister le tool result
        AssistantMessage toolMsg = AssistantMessage.tool(
                conversation.getId(), context.organizationId(),
                pending.toolCallId(), result.content());
        messageRepository.save(toolMsg);

        // Construire le ChatRequest a partir de l'historique stocke + tool result
        List<ChatMessage> messages = new ArrayList<>(pending.pendingHistory());
        messages.add(ChatMessage.tool(pending.toolCallId(), result.content()));

        ChatRequest request = new ChatRequest(
                buildSystemPrompt(context), messages, toolRegistry.listDescriptors(),
                conversation.getModel(), DEFAULT_TEMPERATURE, MAX_TOKENS_PER_TURN);

        String apiKey = resolveApiKey(context.organizationId());
        runToolLoop(request, conversation, context, apiKey, consumer);

        conversation.setUpdatedAt(LocalDateTime.now());
        conversationRepository.save(conversation);
        return conversation.getId();
    }

    // ─── Multi-agent flow (helpers) ────────────────────────────────────────

    /**
     * Decide si on peut tenter le multi-agent flow pour cette requete.
     *
     * <p>Conditions :</p>
     * <ul>
     *   <li>Feature flag {@code clenzy.assistant.multi-agent.enabled=true}</li>
     *   <li>Pas d'attachments (vision pas encore supportee par les specialistes)</li>
     *   <li>Pas de {@code modelOverride} dans le {@link AgentContext} :
     *       les briefings et autres cas specialises forcent leur modele (Haiku
     *       pour briefings) — on respecte ce choix en restant en mono-agent</li>
     *   <li>SpecialistRegistry non vide</li>
     *   <li>OrchestratorAgent injecte (non null)</li>
     * </ul>
     */
    private boolean canUseMultiAgent(AgentContext context, boolean hasAttachments) {
        if (!multiAgentEnabled) return false;
        if (hasAttachments) return false;
        // Briefings (BriefingComposer) forcent un modelOverride Haiku — skip multi-agent
        // pour preserver leur flow specifique (prompts structures DAILY/WEEKLY/ALERTS).
        if (context.modelOverride() != null) return false;
        if (multiAgentOrchestrator == null) return false;
        return specialistRegistry != null && specialistRegistry.size() > 0;
    }

    /**
     * Execute le flow multi-agent et stream les events SSE.
     *
     * @return true si le flow a reussi et les events ont ete emis ;
     *         false si une condition empeche le multi-agent (caller fallback mono-agent)
     */
    private boolean tryMultiAgentFlow(String userMessage,
                                        AgentContext context,
                                        AssistantConversation conversation,
                                        Consumer<AgentSseEvent> consumer) {
        com.clenzy.service.agent.multiagent.OrchestratorAgent.OrchestrationResult result =
                multiAgentOrchestrator.orchestrate(userMessage, context);

        if (!result.isSuccess()) {
            log.warn("Multi-agent returned error : {} — fallback mono-agent", result.error());
            return false;
        }

        // 1. Emettre les tool_call_executed events pour chaque widget (preserve l'UX)
        for (com.clenzy.service.agent.multiagent.ToolInvocationSnapshot snap : result.toolInvocations()) {
            consumer.accept(AgentSseEvent.toolCallExecuted(
                    snap.toolName(),
                    null,  // pas de toolCallId au niveau multi-agent
                    snap.isError(),
                    snap.displayHint(),
                    snap.isError() ? null : snap.content()
            ));
        }

        // 2. Emettre le texte final en un seul delta (pas de streaming caractere par
        //    caractere en v1 — le streaming SSE bidirectionnel viendra en v2)
        String finalText = result.finalText() == null ? "" : result.finalText();
        if (!finalText.isEmpty()) {
            consumer.accept(AgentSseEvent.textDelta(finalText));
        }

        // 3. Persister le message assistant (avec tokens + finish reason)
        AssistantMessage assistantMsg = AssistantMessage.assistant(
                conversation.getId(),
                context.organizationId(),
                finalText,
                null  // tool_calls JSON (multi-agent : detail interne, pas expose ici)
        );
        assistantMsg.setPromptTokens(result.totalPromptTokens());
        assistantMsg.setCompletionTokens(result.totalCompletionTokens());
        assistantMsg.setFinishReason(result.truncated() ? "length" : "end_turn");
        messageRepository.save(assistantMsg);

        // 4. Emettre done
        consumer.accept(AgentSseEvent.done(result.truncated() ? "length" : "end_turn"));
        return true;
    }

    // ─── Boucle principale ─────────────────────────────────────────────────

    private void runToolLoop(ChatRequest initialRequest,
                              AssistantConversation conversation,
                              AgentContext context,
                              String apiKey,
                              Consumer<AgentSseEvent> consumer) {
        ChatRequest request = initialRequest;

        for (int iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
            LoopOutcome outcome = streamOneTurn(request, conversation, apiKey, consumer);

            if (outcome.error != null) {
                consumer.accept(AgentSseEvent.error(outcome.error));
                return;
            }

            // Persist assistant message (text + tool_calls)
            AssistantMessage assistantMsg = AssistantMessage.assistant(
                    conversation.getId(),
                    context.organizationId(),
                    outcome.text == null ? "" : outcome.text,
                    serializeToolCallsSafe(outcome.toolCalls));
            assistantMsg.setPromptTokens(outcome.promptTokens);
            assistantMsg.setCompletionTokens(outcome.completionTokens);
            assistantMsg.setFinishReason(outcome.finishReason);
            messageRepository.save(assistantMsg);

            if (conversation.getModel() == null && outcome.model != null) {
                conversation.setModel(outcome.model);
            }

            // No tool calls → done
            if (outcome.toolCalls == null || outcome.toolCalls.isEmpty()) {
                consumer.accept(AgentSseEvent.done(outcome.finishReason));
                return;
            }

            // Check if any tool requires confirmation → suspend
            for (ChatMessage.ToolCall call : outcome.toolCalls) {
                Optional<ToolHandler> handler = toolRegistry.find(call.name());
                if (handler.isPresent()
                        && handler.get().descriptor() != null
                        && handler.get().descriptor().requiresConfirmation()) {
                    // Build the "future history" : current request + this assistant turn
                    // (avec TOUS les tool_calls). Quand le user confirme/refuse, on
                    // appendera les tool results et reprendre la boucle.
                    List<ChatMessage> futureHistory = new ArrayList<>(request.messages());
                    futureHistory.add(ChatMessage.assistantToolCalls(outcome.toolCalls));

                    pendingToolStore.put(
                            call.id(),
                            conversation.getId(),
                            context.organizationId(),
                            context.keycloakId(),
                            call.name(),
                            call.arguments(),
                            futureHistory
                    );

                    String description = handler.get().descriptor().description();
                    consumer.accept(AgentSseEvent.toolConfirmationRequest(
                            call.name(), call.id(), call.arguments(), description));
                    // Si plusieurs tools sont en confirmation, on les annonce tous —
                    // le frontend pourra les afficher et envoyer confirm pour chacun.
                }
            }

            // Si au moins UN tool requiresConfirmation, on suspend la boucle complete.
            // Les tools read-only (s'il y en a dans le meme tour) ne sont PAS executes
            // pour eviter une execution partielle ambigue.
            boolean anyRequiresConfirm = outcome.toolCalls.stream().anyMatch(c -> {
                Optional<ToolHandler> h = toolRegistry.find(c.name());
                return h.isPresent() && h.get().descriptor() != null
                        && h.get().descriptor().requiresConfirmation();
            });
            if (anyRequiresConfirm) {
                consumer.accept(AgentSseEvent.pausedAwaitingConfirmation());
                return;
            }

            // Execute each tool, persist result, push SSE
            List<ChatMessage> toolResults = new ArrayList<>();
            for (ChatMessage.ToolCall call : outcome.toolCalls) {
                ToolResult result = executeTool(call, context);
                consumer.accept(AgentSseEvent.toolCallExecuted(call.name(), call.id(),
                        result.isError(), result.displayHint(),
                        result.isError() ? null : result.content()));

                AssistantMessage toolMsg = AssistantMessage.tool(
                        conversation.getId(), context.organizationId(),
                        call.id(), result.content());
                messageRepository.save(toolMsg);

                toolResults.add(ChatMessage.tool(call.id(), result.content()));
            }

            // Build next request : current request + assistant turn + tool results
            ChatRequest next = request.withAppendedMessage(
                    ChatMessage.assistantToolCalls(outcome.toolCalls));
            for (ChatMessage tr : toolResults) {
                next = next.withAppendedMessage(tr);
            }
            request = next;
        }

        // Hit iteration cap
        consumer.accept(AgentSseEvent.error(
                "Trop d'iterations d'outils (>" + MAX_TOOL_ITERATIONS + "). Reformule ta demande."));
    }

    private LoopOutcome streamOneTurn(ChatRequest request,
                                       AssistantConversation conversation,
                                       String apiKey,
                                       Consumer<AgentSseEvent> consumer) {
        LoopOutcome outcome = new LoopOutcome();

        Consumer<ChatEvent> handler = event -> {
            if (event instanceof ChatEvent.TextDelta td) {
                consumer.accept(AgentSseEvent.textDelta(td.delta()));
            } else if (event instanceof ChatEvent.ToolCallRequest tcr) {
                outcome.toolCalls = new ArrayList<>(tcr.calls());
            } else if (event instanceof ChatEvent.Done done) {
                outcome.text = done.fullText();
                outcome.promptTokens = done.promptTokens();
                outcome.completionTokens = done.completionTokens();
                outcome.model = done.model();
                outcome.finishReason = done.finishReason();
            } else if (event instanceof ChatEvent.Error err) {
                outcome.error = err.message();
            }
        };

        if (apiKey != null) {
            chatProvider.streamChat(request, handler, apiKey);
        } else {
            chatProvider.streamChat(request, handler);
        }
        return outcome;
    }

    // ─── Helpers ───────────────────────────────────────────────────────────

    /**
     * Construit le system prompt pour cette conversation.
     *
     * <p>Variante sans userMessage : utilisee dans les resume-after-confirmation
     * (pas de nouvelle query memoire/RAG).</p>
     */
    String buildSystemPrompt(AgentContext context) {
        return buildSystemPrompt(context, null);
    }

    /**
     * Construit le system prompt avec :
     * <ul>
     *   <li>Section memoire (selection par similarite si message user, sinon recency)</li>
     *   <li>Section RAG (snippets doc Clenzy au-dessus du seuil de relevance)</li>
     *   <li>Le DEFAULT_SYSTEM_PROMPT (legacy v1) OU le PromptBuilder v2 selon
     *       le feature flag {@link #promptV2Enabled}</li>
     * </ul>
     *
     * <p><b>Rollback safety (2 niveaux)</b> :</p>
     * <ol>
     *   <li>Feature flag {@code clenzy.assistant.prompt.v2.enabled=false}
     *       → retour instantane a l'ancien comportement sans redeploy</li>
     *   <li>Si v2 throw (bug regression), catch + fallback automatique sur v1
     *       + log warning pour alerte ops</li>
     * </ol>
     *
     * <p>L'echec silencieux des sources memoire/RAG est OK (network/embed
     * provider KO) — c'est du nice-to-have, pas un bloquant.</p>
     */
    String buildSystemPrompt(AgentContext context, String latestUserMessage) {
        // 1. Pre-charge des memoires (commun v1/v2)
        List<AssistantMemory> memories = loadMemories(context, latestUserMessage);

        // 2. Pre-charge des hits RAG (commun v1/v2)
        List<KbSearchService.KbSearchHit> kbHits = loadRelevantKbHits(latestUserMessage, context.organizationId());

        // 3. Composition : v2 par defaut, fallback v1 si erreur ou resultat vide
        if (promptV2Enabled && promptBuilder != null) {
            try {
                String v2 = promptBuilder.buildChatPrompt(context, latestUserMessage, memories, kbHits);
                if (v2 != null && !v2.isBlank()) return v2;
                // null/blank → traite comme fallback (defensive : mock en tests)
                log.debug("PromptBuilder v2 returned null/blank, falling back to v1");
            } catch (Exception e) {
                log.warn("PromptBuilder v2 failed, falling back to legacy v1 : {}", e.getMessage(), e);
                // Fall through to v1
            }
        }
        return buildLegacySystemPrompt(memories, kbHits);
    }

    /** Charge les memoires (selection par similarite OU recency). Silent fallback list vide. */
    private List<AssistantMemory> loadMemories(AgentContext context, String latestUserMessage) {
        try {
            return (latestUserMessage != null && !latestUserMessage.isBlank())
                    ? memoryService.listMostRelevant(context.organizationId(), context.keycloakId(),
                            latestUserMessage, MAX_MEMORY_ENTRIES)
                    : memoryService.listForUser(context.keycloakId(), MAX_MEMORY_ENTRIES);
        } catch (Exception e) {
            log.warn("Failed to load memory for user {} : {}", context.keycloakId(), e.getMessage());
            return java.util.List.of();
        }
    }

    /** Charge les hits RAG au-dessus du seuil. Silent fallback list vide. */
    private List<KbSearchService.KbSearchHit> loadRelevantKbHits(String query, Long organizationId) {
        if (query == null || query.isBlank() || kbSearchService == null) return java.util.List.of();
        try {
            return kbSearchService.search(query, organizationId, RAG_TOP_K).stream()
                    .filter(h -> h.relevance() >= RAG_RELEVANCE_MIN)
                    .toList();
        } catch (Exception e) {
            log.debug("RAG auto-injection skipped : {}", e.getMessage());
            return java.util.List.of();
        }
    }

    /** Legacy v1 : ancien comportement (memory text-format + RAG markdown + DEFAULT_SYSTEM_PROMPT). */
    private String buildLegacySystemPrompt(List<AssistantMemory> memories,
                                             List<KbSearchService.KbSearchHit> kbHits) {
        StringBuilder prefix = new StringBuilder();
        if (memories != null && !memories.isEmpty()) {
            prefix.append(renderMemorySection(memories)).append("\n\n");
        }
        if (kbHits != null && !kbHits.isEmpty()) {
            String ragSection = renderLegacyKbContext(kbHits);
            if (ragSection != null && !ragSection.isEmpty()) {
                prefix.append(ragSection).append("\n\n");
            }
        }
        if (prefix.length() == 0) return DEFAULT_SYSTEM_PROMPT;
        return prefix.append(DEFAULT_SYSTEM_PROMPT).toString();
    }

    /** Render legacy markdown des hits RAG (utilise par v1 uniquement). */
    private String renderLegacyKbContext(List<KbSearchService.KbSearchHit> relevant) {
        if (relevant == null || relevant.isEmpty()) return null;
        StringBuilder sb = new StringBuilder();
        sb.append("── Contexte documentation pertinente ──\n\n");
        sb.append("Voici des extraits de la documentation Clenzy lies a la question. ")
                .append("REGLES :\n")
                .append("- Si tu utilises l'info d'un extrait, cite-le « Selon [titre](sourcePath), ... ».\n")
                .append("- Si aucun extrait ne repond a la question, dis explicitement que la doc ne le couvre pas ")
                .append("au lieu d'extrapoler ou d'inventer.\n")
                .append("- Ne reformule pas un fait absent des extraits comme s'il venait de la doc.\n\n");
        for (int i = 0; i < relevant.size(); i++) {
            KbSearchService.KbSearchHit h = relevant.get(i);
            sb.append("[").append(i + 1).append("] ");
            sb.append("**").append(h.title() != null ? h.title() : "Document")
                    .append("** (").append(h.sourcePath()).append(") — ")
                    .append("relevance ").append(Math.round(h.relevance() * 100)).append("%\n");
            sb.append(h.snippet()).append("\n\n");
        }
        return sb.toString().trim();
    }

    /**
     * Genere la section markdown de memoire utilisateur. Format :
     * <pre>
     * ── Memoire utilisateur ──
     *
     * Preferences : [key1=value1, key2=value2]
     * Faits : [...]
     * Objectifs : [...]
     * Projets : [...]
     * </pre>
     */
    private String renderMemorySection(List<AssistantMemory> memories) {
        Map<AssistantMemory.Scope, List<AssistantMemory>> byScope = new EnumMap<>(AssistantMemory.Scope.class);
        for (AssistantMemory m : memories) {
            AssistantMemory.Scope scope = m.getScopeEnum();
            if (scope == null) continue;
            byScope.computeIfAbsent(scope, k -> new ArrayList<>()).add(m);
        }

        StringBuilder sb = new StringBuilder();
        sb.append("── Memoire utilisateur ──\n\n");

        // Ordre stable : preference, fact, goal, project
        Map<AssistantMemory.Scope, String> labels = new LinkedHashMap<>();
        labels.put(AssistantMemory.Scope.PREFERENCE, "Preferences");
        labels.put(AssistantMemory.Scope.FACT, "Faits");
        labels.put(AssistantMemory.Scope.GOAL, "Objectifs");
        labels.put(AssistantMemory.Scope.PROJECT, "Projets");

        boolean any = false;
        for (Map.Entry<AssistantMemory.Scope, String> entry : labels.entrySet()) {
            List<AssistantMemory> bucket = byScope.get(entry.getKey());
            if (bucket == null || bucket.isEmpty()) continue;
            any = true;
            sb.append(entry.getValue()).append(" : [");
            for (int i = 0; i < bucket.size(); i++) {
                if (i > 0) sb.append(", ");
                AssistantMemory m = bucket.get(i);
                sb.append(m.getMemoryKey()).append('=').append(m.getMemoryValue());
            }
            sb.append("]\n");
        }
        if (!any) {
            // Toutes les memoires avaient un scope inconnu → fallback safe
            return "";
        }
        return sb.toString();
    }

    private AssistantConversation resolveOrCreateConversation(Long id, AgentContext ctx) {
        if (id == null) {
            return conversationRepository.save(
                    new AssistantConversation(ctx.organizationId(), ctx.keycloakId()));
        }
        return conversationRepository.findByIdAndUser(id, ctx.keycloakId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Conversation " + id + " introuvable ou non autorisee"));
    }

    private String resolveApiKey(Long organizationId) {
        try {
            Optional<OrgAiApiKey> byokKey = orgAiApiKeyRepository
                    .findByOrganizationIdAndProvider(organizationId, "anthropic");
            if (byokKey.isPresent() && byokKey.get().isValid()
                    && byokKey.get().getApiKey() != null && !byokKey.get().getApiKey().isBlank()) {
                return byokKey.get().getApiKey();
            }
        } catch (Exception e) {
            log.debug("Pas de cle BYOK Anthropic pour org {} ({}), fallback plateforme",
                    organizationId, e.getMessage());
        }
        // null => le provider utilisera la cle plateforme via la signature sans apiKey
        return null;
    }

    private List<ChatMessage> toChatMessages(List<AssistantMessage> history) {
        List<ChatMessage> result = new ArrayList<>();
        Iterator<AssistantMessage> it = history.iterator();
        while (it.hasNext()) {
            AssistantMessage m = it.next();
            switch (m.getRole()) {
                case AssistantMessage.ROLE_USER -> {
                    String content = m.getContent() != null ? m.getContent() : "";
                    List<MessageAttachment> atts = resolveAttachmentsSafe(m.getAttachments());
                    if (atts.isEmpty()) {
                        result.add(ChatMessage.user(content));
                    } else {
                        result.add(ChatMessage.user(content, atts));
                    }
                }
                case AssistantMessage.ROLE_ASSISTANT -> {
                    List<ChatMessage.ToolCall> calls = parseToolCallsSafe(m.getToolCalls());
                    if (!calls.isEmpty()) {
                        result.add(ChatMessage.assistantToolCalls(calls));
                    } else {
                        result.add(ChatMessage.assistant(m.getContent() != null ? m.getContent() : ""));
                    }
                }
                case AssistantMessage.ROLE_TOOL ->
                        result.add(ChatMessage.tool(m.getToolCallId(),
                                m.getContent() != null ? m.getContent() : ""));
                default -> log.warn("Role inconnu dans l'historique : {}", m.getRole());
            }
        }
        return result;
    }

    /**
     * Charge les attachments persistes (JSON array de refs storage) et resout
     * chaque entree en bytes base64 via {@link PhotoStorageService}. Si une
     * resolution echoue, l'attachment est skip (warn log) — le message texte
     * passe quand meme.
     */
    private List<MessageAttachment> resolveAttachmentsSafe(String json) {
        if (json == null || json.isBlank()) return List.of();
        List<MessageAttachment> out = new ArrayList<>();
        try {
            JsonNode arr = objectMapper.readTree(json);
            if (!arr.isArray()) return List.of();
            for (JsonNode node : arr) {
                String storageKey = node.path("storageKey").asText(null);
                String mediaType = node.path("mediaType").asText(null);
                if (storageKey == null || storageKey.isBlank() || mediaType == null) continue;
                try {
                    byte[] bytes = photoStorageService.retrieve(storageKey);
                    if (bytes == null || bytes.length == 0) continue;
                    String base64 = java.util.Base64.getEncoder().encodeToString(bytes);
                    out.add(MessageAttachment.imageBase64(mediaType, base64));
                } catch (Exception e) {
                    log.warn("Attachment storageKey '{}' indisponible : {}",
                            storageKey, e.getMessage());
                }
            }
        } catch (Exception e) {
            log.warn("attachments JSON invalide, ignored : {}", e.getMessage());
        }
        return out;
    }

    /**
     * Serialise les {@link AttachmentRef} en JSON array a stocker dans la
     * colonne {@code attachments} de l'AssistantMessage. On garde une forme
     * resilient au schema (storageKey + mediaType minimum) pour pouvoir relire
     * meme apres une evolution du modele.
     */
    private String serializeAttachmentsSafe(List<AttachmentRef> attachments) {
        if (attachments == null || attachments.isEmpty()) return null;
        try {
            List<Map<String, Object>> list = new ArrayList<>(attachments.size());
            for (AttachmentRef ref : attachments) {
                if (ref == null || ref.storageKey() == null) continue;
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("storageKey", ref.storageKey());
                m.put("mediaType", ref.mediaType());
                if (ref.url() != null) m.put("url", ref.url());
                if (ref.name() != null) m.put("name", ref.name());
                list.add(m);
            }
            return list.isEmpty() ? null : objectMapper.writeValueAsString(list);
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize attachments : {}", e.getMessage());
            return null;
        }
    }

    private ToolResult executeTool(ChatMessage.ToolCall call, AgentContext context) {
        Optional<ToolHandler> handler = toolRegistry.find(call.name());
        if (handler.isEmpty()) {
            log.warn("Tool '{}' inconnu (demande par le LLM)", call.name());
            return ToolResult.error("Tool '" + call.name() + "' non disponible");
        }
        try {
            JsonNode args = parseArgsSafe(call.arguments());
            return handler.get().execute(args, context);
        } catch (ToolExecutionException e) {
            log.info("Tool '{}' a echoue (previsible) : {}", call.name(), e.getMessage());
            return ToolResult.error(e.getMessage());
        } catch (Exception e) {
            log.error("Tool '{}' a leve une exception inattendue", call.name(), e);
            return ToolResult.error("Erreur interne lors de l'execution de " + call.name());
        }
    }

    private JsonNode parseArgsSafe(String json) {
        if (json == null || json.isBlank()) return objectMapper.createObjectNode();
        try {
            return objectMapper.readTree(json);
        } catch (JsonProcessingException e) {
            log.warn("Tool args JSON invalide, fallback objet vide : {}", e.getMessage());
            return objectMapper.createObjectNode();
        }
    }

    private List<ChatMessage.ToolCall> parseToolCallsSafe(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            JsonNode arr = objectMapper.readTree(json);
            if (!arr.isArray()) return List.of();
            List<ChatMessage.ToolCall> out = new ArrayList<>(arr.size());
            for (JsonNode node : arr) {
                String id = node.path("id").asText(null);
                String name = node.path("name").asText(null);
                String args = node.path("arguments").asText("{}");
                if (id != null && name != null) {
                    out.add(new ChatMessage.ToolCall(id, name, args));
                }
            }
            return out;
        } catch (Exception e) {
            log.warn("Failed to parse persisted tool_calls JSON: {}", e.getMessage());
            return List.of();
        }
    }

    private String serializeToolCallsSafe(List<ChatMessage.ToolCall> calls) {
        if (calls == null || calls.isEmpty()) return null;
        try {
            return objectMapper.writeValueAsString(calls);
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize tool_calls : {}", e.getMessage());
            return null;
        }
    }

    private String deriveTitle(String firstMessage) {
        if (firstMessage == null) return null;
        String trimmed = firstMessage.strip().replaceAll("\\s+", " ");
        if (trimmed.length() <= 60) return trimmed;
        return trimmed.substring(0, 57) + "...";
    }

    // ─── State holder for one LLM turn ─────────────────────────────────────

    private static final class LoopOutcome {
        String text;
        List<ChatMessage.ToolCall> toolCalls;
        int promptTokens;
        int completionTokens;
        String model;
        String finishReason;
        String error;
    }
}
