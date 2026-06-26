package com.clenzy.service.agent;

import com.clenzy.config.AiProperties;
import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.config.ai.ChatMessage;
import com.clenzy.config.ai.ChatRequest;
import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.model.AssistantConversation;
import com.clenzy.model.AssistantMemory;
import com.clenzy.model.AssistantMessage;
import com.clenzy.repository.AssistantConversationRepository;
import com.clenzy.repository.AssistantMessageRepository;
import com.clenzy.repository.OrgAiApiKeyRepository;
import com.clenzy.service.AssistantMemoryService;
import com.clenzy.service.PhotoStorageService;
import com.clenzy.service.agent.kb.KbSearchService;
import com.clenzy.service.agent.prompt.ComposedSystemPrompt;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
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
 *
 * <p><b>Collaborateurs</b> (refactor SRP — comportement strictement identique) :
 * <ul>
 *   <li>{@link AgentPromptComposer} : system prompt (v1 legacy / v2 PromptBuilder),
 *       memoire long-terme et RAG auto-injection</li>
 *   <li>{@link AssistantTargetResolver} : provider/modele/cle/baseUrl effectifs</li>
 *   <li>{@link AgentToolLoopRunner} : boucle tool-calling + streaming LLM + usage tokens</li>
 *   <li>{@link ConversationHistoryMapper} : historique BDD → messages LLM + attachments</li>
 * </ul>
 */
@Service
public class AgentOrchestrator {

    private static final Logger log = LoggerFactory.getLogger(AgentOrchestrator.class);
    private static final int MAX_TOKENS_PER_TURN = 4096;
    private static final double DEFAULT_TEMPERATURE = 0.3;

    private final ToolRegistry toolRegistry;
    private final AssistantConversationRepository conversationRepository;
    private final AssistantMessageRepository messageRepository;
    private final ObjectMapper objectMapper;
    private final PendingToolStore pendingToolStore;
    private final com.clenzy.service.agent.multiagent.OrchestratorAgent multiAgentOrchestrator;
    private final com.clenzy.service.agent.multiagent.SpecialistRegistry specialistRegistry;
    private final AgentPromptComposer promptComposer;
    private final AssistantTargetResolver targetResolver;
    private final AgentToolLoopRunner toolLoopRunner;
    private final ConversationHistoryMapper historyMapper;

    /**
     * Feature flag : si true, utilise l'architecture multi-agent (orchestrator
     * + spécialistes ≤10 tools chacun) au lieu du mono-agent (27 tools en bloc).
     *
     * <p><b>Defaut false</b> : audit pre-prod (2026-05-28) avait identifie 7
     * regressions bloquantes. Etat post-fixes (2026-05-28) :</p>
     * <ul>
     *   <li>✅ Fix #1 — Confirmation user des write tools : detection
     *       {@code requiresConfirmation} dans AbstractAgentSpecialist →
     *       fallback mono-agent (ConfirmationRequiredException).</li>
     *   <li>✅ Fix #2 — History conversationnelle transmise via la signature
     *       {@code orchestrate(List<ChatMessage>, ...)}.</li>
     *   <li>✅ Fix #3 — Memory long-terme + RAG pre-charges, transmis via
     *       {@link com.clenzy.service.agent.multiagent.OrchestrationContext}.</li>
     *   <li>✅ Fix #4 — BYOK apiKey propage a l'orchestrator + specialists.</li>
     *   <li>✅ Fix #5 — Langue + currentPage + selectedPropertyId injectes
     *       en {@code <user_context>} XML dans les prompts.</li>
     *   <li>✅ Fix #6 (implicite via #1) — Audit logging des write tools :
     *       les writes passent par mono-agent qui log normalement.</li>
     *   <li>✅ Fix #7 (implicite via #1) — resumeAfterConfirmation reste
     *       utilisable car les writes basculent toujours en mono-agent.</li>
     * </ul>
     *
     * <p>Le flag reste OFF par defaut jusqu'a validation manuelle en dev
     * avec de vrais appels LLM (les tests unitaires/integration couvrent
     * la mecanique mais pas les sorties LLM reelles).</p>
     *
     * <p>Override (en dev pour tester) :
     * {@code clenzy.assistant.multi-agent.enabled=true}</p>
     */
    private final boolean multiAgentEnabled;

    /** Constructeur Spring : injection des collaborateurs extraits. */
    @Autowired
    public AgentOrchestrator(ToolRegistry toolRegistry,
                              AssistantConversationRepository conversationRepository,
                              AssistantMessageRepository messageRepository,
                              ObjectMapper objectMapper,
                              PendingToolStore pendingToolStore,
                              com.clenzy.service.agent.multiagent.OrchestratorAgent multiAgentOrchestrator,
                              com.clenzy.service.agent.multiagent.SpecialistRegistry specialistRegistry,
                              AgentPromptComposer promptComposer,
                              AssistantTargetResolver targetResolver,
                              AgentToolLoopRunner toolLoopRunner,
                              ConversationHistoryMapper historyMapper,
                              @org.springframework.beans.factory.annotation.Value("${clenzy.assistant.multi-agent.enabled:false}")
                              boolean multiAgentEnabled) {
        this.toolRegistry = toolRegistry;
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.objectMapper = objectMapper;
        this.pendingToolStore = pendingToolStore;
        this.multiAgentOrchestrator = multiAgentOrchestrator;
        this.specialistRegistry = specialistRegistry;
        this.promptComposer = promptComposer;
        this.targetResolver = targetResolver;
        this.toolLoopRunner = toolLoopRunner;
        this.historyMapper = historyMapper;
        this.multiAgentEnabled = multiAgentEnabled;
    }

    /**
     * Constructeur retro-compatible (signature historique pre-extraction des
     * collaborateurs). Conserve pour les tests existants : construit les
     * collaborateurs a partir des dependances unitaires.
     *
     * @deprecated utiliser le constructeur a collaborateurs injectes.
     */
    @Deprecated(since = "2026-06")
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
                              com.clenzy.service.AiTokenBudgetService aiTokenBudgetService,
                              com.clenzy.service.PlatformAiConfigService platformAiConfigService,
                              boolean promptV2Enabled,
                              boolean multiAgentEnabled) {
        this(toolRegistry, conversationRepository, messageRepository, objectMapper,
                pendingToolStore, multiAgentOrchestrator, specialistRegistry,
                new AgentPromptComposer(memoryService, kbSearchService, promptBuilder, promptV2Enabled),
                new AssistantTargetResolver(platformAiConfigService, orgAiApiKeyRepository, aiProperties),
                // Instrumentation audit/metrics = null sur ce chemin legacy test-only
                // (AgentToolLoopRunner est null-safe). Le chemin Spring @Primary injecte
                // les vrais beans AgentActionAuditService + AgentToolMetrics.
                new AgentToolLoopRunner(chatProvider, toolRegistry, messageRepository,
                        pendingToolStore, objectMapper, aiTokenBudgetService, null, null),
                new ConversationHistoryMapper(objectMapper, photoStorageService),
                multiAgentEnabled);
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
                ? historyMapper.serializeAttachmentsSafe(attachments)
                : null;
        AssistantMessage userMsg = AssistantMessage.user(
                conversation.getId(), context.organizationId(), effectiveMessage, attachmentsJson);
        messageRepository.save(userMsg);

        // 3. Charger l'historique complet (post-insert du user message)
        List<AssistantMessage> history = messageRepository.findByConversation(conversation.getId());
        List<ChatMessage> chatMessages = historyMapper.toChatMessages(history);

        // 4. Pre-charge memoires + RAG + apiKey UNE SEULE FOIS, partagees entre
        //    multi-agent et mono-agent fallback. Evite la duplication d'appels
        //    Voyage/OpenAI embeddings (~$0.000002 / call) ET de lookups BYOK
        //    quand le multi-agent fallback (ConfirmationRequiredException, throw,
        //    OrchestrationResult.error, etc.).
        List<AssistantMemory> memories = promptComposer.loadMemories(context, effectiveMessage);
        List<KbSearchService.KbSearchHit> kbHits =
                promptComposer.loadRelevantKbHits(effectiveMessage, context.organizationId());
        // Cible LLM resolue UNE SEULE FOIS (provider effectif + modele + cle + baseUrl),
        // partagee entre le flow multi-agent et le fallback mono-agent.
        AssistantTargetResolver.ChatTarget target =
                targetResolver.resolve(context.organizationId(), context.modelOverride());
        String apiKey = target.apiKey();

        // 5. Tentative multi-agent (si flag on + sans attachments + spécialistes prêts).
        //    Attachments → fallback mono-agent car les spécialistes ne gerent pas
        //    encore les images Vision (TODO v2).
        //    Pas de spécialiste → impossible, fallback aussi.
        //    Si multi-agent throw, on log et fallback automatiquement.
        if (canUseMultiAgent(context, hasAttachments)) {
            try {
                com.clenzy.service.agent.multiagent.OrchestrationContext orchestrationCtx =
                        new com.clenzy.service.agent.multiagent.OrchestrationContext(memories, kbHits);
                // Modele + provider + baseUrl resolus (cf. target) propages aux
                // specialists multi-agents via le contexte (routage multi-provider :
                // Anthropic, OpenAI, ou modele plateforme OpenAI-compatible).
                AgentContext effectiveContext = context.withAiTarget(
                        target.model(), target.provider(), target.baseUrl());

                boolean handledByMultiAgent = tryMultiAgentFlow(
                        effectiveMessage, chatMessages, orchestrationCtx, apiKey,
                        effectiveContext, conversation, consumer);
                if (handledByMultiAgent) {
                    // 6. Update conversation updatedAt + title si manquant
                    conversation.setUpdatedAt(LocalDateTime.now());
                    if (conversation.getTitle() == null) {
                        conversation.setTitle(deriveTitle(effectiveMessage));
                    }
                    conversationRepository.save(conversation);
                    return conversation.getId();
                }
            } catch (com.clenzy.service.agent.multiagent.ConfirmationRequiredException e) {
                // Cas attendu : un specialist a tente d'invoquer un write tool
                // sensible (block_calendar, cancel_reservation, etc.). Le multi-agent
                // ne sait pas faire la pause-confirmation → fallback mono-agent
                // qui exposera la confirmation au user. Log info, pas warn.
                //
                // NB: les eventuels widgets/snapshots accumules par le specialist
                // AVANT le throw (read tools precedents) sont volontairement perdus :
                // ils n'avaient pas encore ete emis en SSE (l'emission ne se fait qu'a
                // la fin de tryMultiAgentFlow), et le mono-agent va de toute facon
                // re-invoquer ses propres tools → pas de risque de duplicate ni
                // d'incohérence.
                log.info("Multi-agent fallback to mono-agent (tool '{}' requires confirmation)",
                        e.toolName());
            } catch (Exception e) {
                log.warn("Multi-agent flow failed, falling back to mono-agent : {}",
                        e.getMessage(), e);
            }
        }

        // 7 (fallback). Boucle tool-calling mono-agent (27 tools), avec reutilisation
        //    des memoires + RAG pre-chargees (pas de second appel embeddings).
        //    Resolution du modele (priorite decroissante) :
        //      1. context.modelOverride() : forcage explicite (briefings = Haiku)
        //      2. Modele assigne a la feature ASSISTANT_CHAT dans Settings > IA
        //      3. null → defaut provider (Anthropic Sonnet)
        // RBAC least-privilege : un role operationnel ne voit que ses outils d'intervention.
        List<ToolDescriptor> tools = RoleToolPolicy.filterForRole(toolRegistry.listDescriptors(), context);
        ComposedSystemPrompt systemPrompt =
                promptComposer.buildSegmentedSystemPrompt(context, effectiveMessage, memories, kbHits);
        ChatRequest request = new ChatRequest(
                systemPrompt.cacheablePrefix(), chatMessages, tools, target.model(),
                DEFAULT_TEMPERATURE, MAX_TOKENS_PER_TURN, systemPrompt.volatileSuffix(),
                target.provider(), target.baseUrl());

        toolLoopRunner.runToolLoop(request, conversation, context, apiKey, consumer);

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

        // Recharger la conv pour update updatedAt en fin de boucle. La validation
        // d'ownership est double : consume() (keycloakId du pending) + findByIdAndUser
        // (conversation scopee au user).
        AssistantConversation conversation = conversationRepository
                .findByIdAndUser(pending.conversationId(), context.keycloakId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Conversation " + pending.conversationId() + " introuvable"));

        // Construire le tool result : execution reelle OU "annule par user".
        // Partage entre les deux flux (mono + multi-agent).
        ToolResult result = confirmed
                ? toolLoopRunner.executeConfirmed(pending, context)
                : ToolResult.error("L'utilisateur a refuse l'execution de cette action.");

        consumer.accept(AgentSseEvent.toolCallExecuted(
                pending.toolName(), pending.toolCallId(),
                result.isError(), result.displayHint(),
                result.isError() ? null : result.content()));

        // Persister le tool result
        AssistantMessage toolMsg = AssistantMessage.tool(
                conversation.getId(), context.organizationId(),
                pending.toolCallId(), result.content());
        messageRepository.save(toolMsg);

        // ─── Branche HITL multi-agent : re-entrer dans le flow multi-agent ───
        if (pending.isMultiAgent()) {
            resumeMultiAgentAfterConfirmation(pending, result, context, conversation, consumer);
            conversation.setUpdatedAt(LocalDateTime.now());
            conversationRepository.save(conversation);
            return conversation.getId();
        }

        // ─── Branche mono-agent (inchangée) ───
        // Construire le ChatRequest a partir de l'historique stocke + tool result
        List<ChatMessage> messages = new ArrayList<>(pending.pendingHistory());
        messages.add(ChatMessage.tool(pending.toolCallId(), result.content()));

        ComposedSystemPrompt resumeSystem = promptComposer.buildSegmentedSystemPrompt(context);
        AssistantTargetResolver.ChatTarget target =
                targetResolver.resolve(context.organizationId(), context.modelOverride());
        ChatRequest request = new ChatRequest(
                resumeSystem.cacheablePrefix(), messages,
                RoleToolPolicy.filterForRole(toolRegistry.listDescriptors(), context),
                target.model() != null ? target.model() : conversation.getModel(),
                DEFAULT_TEMPERATURE, MAX_TOKENS_PER_TURN, resumeSystem.volatileSuffix(),
                target.provider(), target.baseUrl());

        toolLoopRunner.runToolLoop(request, conversation, context, target.apiKey(), consumer);

        conversation.setUpdatedAt(LocalDateTime.now());
        conversationRepository.save(conversation);
        return conversation.getId();
    }

    /**
     * Reprise du flow multi-agent apres confirmation/refus (HITL natif).
     *
     * <p>Re-entre dans le moteur multi-agent : le specialist en pause finit sa
     * boucle avec le tool result injecte (cf.
     * {@link com.clenzy.service.agent.multiagent.OrchestratorAgent#resumeOrchestration}),
     * puis l'orchestrateur continue jusqu'a la reponse finale. Emet les widgets +
     * texte + done, et persiste le message assistant — parite avec
     * {@link #tryMultiAgentFlow}.</p>
     *
     * <p>Re-pause (chainage) : si le specialist re-demande une confirmation, on
     * re-persiste le nouveau contexte et on emet une nouvelle pause.</p>
     */
    private void resumeMultiAgentAfterConfirmation(
            PendingToolStore.PendingTool pending,
            ToolResult confirmedToolResult,
            AgentContext context,
            AssistantConversation conversation,
            Consumer<AgentSseEvent> consumer) {

        com.clenzy.service.agent.multiagent.MultiAgentPendingContext maCtx =
                pending.multiAgentContext();

        // Re-charger memoires + RAG (le dernier message user est en BDD) pour que
        // le specialist repris + l'orchestrateur disposent du meme contexte.
        // Best-effort : si la conv n'a pas de dernier message user (cas limite),
        // contexte vide → degradation gracieuse.
        com.clenzy.service.agent.multiagent.OrchestrationContext orchestrationCtx =
                com.clenzy.service.agent.multiagent.OrchestrationContext.empty();

        // Cible LLM : reprise depuis le contexte effectif capture a la pause
        // (modele/provider/baseUrl resolus). Re-resoudre la cle BYOK au resume.
        AgentContext effective = context.withAiTarget(
                maCtx.effectiveContext().modelOverride(),
                maCtx.effectiveContext().aiProvider(),
                maCtx.effectiveContext().aiBaseUrl());
        AssistantTargetResolver.ChatTarget target =
                targetResolver.resolve(context.organizationId(), effective.modelOverride());
        String apiKey = target.apiKey();

        com.clenzy.service.agent.multiagent.OrchestratorAgent.OrchestrationResult result;
        try {
            result = multiAgentOrchestrator.resumeOrchestration(
                    maCtx, effective, orchestrationCtx, apiKey, confirmedToolResult,
                    delta -> consumer.accept(AgentSseEvent.textDelta(delta)),
                    consumer);
        } catch (com.clenzy.service.agent.multiagent.MultiAgentConfirmationPauseException pause) {
            // Chainage : une nouvelle confirmation est requise. On re-pause.
            pauseMultiAgentForConfirmation(pause.pendingContext(),
                    new ArrayList<>(pending.pendingHistory()), context, conversation, consumer);
            return;
        }

        if (!result.isSuccess()) {
            // Pas de fallback possible ici (le tool a deja ete execute). On remonte
            // l'erreur au user proprement.
            consumer.accept(AgentSseEvent.error(
                    "Reprise multi-agent en erreur : " + result.error()));
            return;
        }

        // Emission widgets + persistance + usage + 'done' : logique partagee avec
        // tryMultiAgentFlow (cf. finalizeMultiAgentTurn).
        finalizeMultiAgentTurn(result, conversation, context, consumer);
    }

    /**
     * Finalise un tour multi-agent : emet les widgets (dedup anti-boucle), persiste le
     * message assistant + tokens, track l'usage (badge cout), puis emet {@code done}.
     *
     * <p>Logique unique partagee entre le flux nominal ({@link #tryMultiAgentFlow}) et la
     * reprise apres confirmation ({@link #resumeMultiAgentAfterConfirmation}) — auparavant
     * dupliquee a l'identique (consolidation #4).</p>
     *
     * <p>Le {@code toolCallId} "ma-"+UUID ("ma" = multi-agent prefix) evite la collision
     * de React key cote front ; les widgets sont serialises dans la meme shape que le SSE
     * pour se re-hydrater a l'identique au reload de la conversation.</p>
     */
    private void finalizeMultiAgentTurn(
            com.clenzy.service.agent.multiagent.OrchestratorAgent.OrchestrationResult result,
            AssistantConversation conversation,
            AgentContext context,
            Consumer<AgentSseEvent> consumer) {
        List<PersistedToolCall> widgets = new ArrayList<>();
        java.util.Set<String> seenWidgets = new java.util.HashSet<>();
        for (com.clenzy.service.agent.multiagent.ToolInvocationSnapshot snap : result.toolInvocations()) {
            // Dedup anti-boucle : un modele qui re-appelle le meme tool (memes args
            // -> meme contenu) ne doit produire qu'UN widget (sinon N cartes identiques).
            String wsig = snap.toolName() + "::" + (snap.content() == null ? "" : snap.content());
            if (!seenWidgets.add(wsig)) continue;
            String widgetId = "ma-" + java.util.UUID.randomUUID();
            String toolResult = snap.isError() ? null : snap.content();
            consumer.accept(AgentSseEvent.toolCallExecuted(
                    snap.toolName(), widgetId, snap.isError(), snap.displayHint(), toolResult));
            widgets.add(new PersistedToolCall(
                    snap.toolName(), widgetId, snap.isError(), snap.displayHint(), toolResult));
        }

        String finalText = result.finalText() == null ? "" : result.finalText();
        AssistantMessage assistantMsg = AssistantMessage.assistant(
                conversation.getId(), context.organizationId(),
                finalText, serializeWidgetsSafe(widgets));
        assistantMsg.setPromptTokens(result.totalPromptTokens());
        assistantMsg.setCompletionTokens(result.totalCompletionTokens());
        assistantMsg.setFinishReason(result.truncated() ? "length" : "end_turn");
        messageRepository.save(assistantMsg);

        // Track usage : 1 record aggregate par tour multi-agent (orchestrator + somme des
        // specialists). Le modele de reference est le modele primaire stocke sur la conv
        // (estimation conservative du cout si plusieurs modeles).
        String multiAgentModel = conversation.getModel() != null
                ? conversation.getModel() : "claude-sonnet-4";
        toolLoopRunner.recordUsageSafe(context.organizationId(),
                context.aiProvider() != null ? context.aiProvider() : "anthropic",
                result.totalPromptTokens(), result.totalCompletionTokens(),
                multiAgentModel, result.truncated() ? "length" : "end_turn");

        consumer.accept(AgentSseEvent.done(result.truncated() ? "length" : "end_turn"));
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
        // Roles operationnels (technicien/menage/supervisor...) : on force le mono-agent,
        // ou le sous-ensemble d'outils restreint (RoleToolPolicy) s'applique. Les
        // specialists multi-agent portent des outils trop larges pour ces roles.
        if (RoleToolPolicy.isOperational(context)) return false;
        // Briefings (BriefingComposer) forcent un modelOverride Haiku — skip multi-agent
        // pour preserver leur flow specifique (prompts structures DAILY/WEEKLY/ALERTS).
        if (context.modelOverride() != null) return false;
        if (multiAgentOrchestrator == null) return false;
        return specialistRegistry != null && specialistRegistry.size() > 0;
    }

    /**
     * Detecte un echec de type rate-limit (HTTP 429 / "Too Many Requests") dans
     * le message d'erreur d'une orchestration. Sur ce cas, retenter en mono-agent
     * sur le meme provider est inutile (re-429 immediat) → on rend l'erreur
     * gracieuse directement.
     */
    private static boolean isRateLimitError(String error) {
        if (error == null) return false;
        String e = error.toLowerCase();
        return e.contains("429") || e.contains("too many requests") || e.contains("rate-limit")
                || e.contains("rate limit");
    }

    /**
     * Execute le flow multi-agent et stream les events SSE.
     *
     * @param userMessage      le message texte du tour courant (utilise pour
     *                          deriver le titre et le logging — pas pour le LLM)
     * @param chatHistory      historique complet de la conversation (incluant le
     *                          message user courant en derniere position). Transmis
     *                          a l'orchestrator pour preserver le contexte multi-tour.
     * @param orchestrationCtx memoire + RAG pre-charges (Fix bloquant #3) :
     *                          memory long-terme + snippets doc relevants. Injectes
     *                          dans le system prompt de l'orchestrator et propages
     *                          aux specialists via SpecialistRequest.
     * @return true si le flow a reussi et les events ont ete emis ;
     *         false si une condition empeche le multi-agent (caller fallback mono-agent)
     */
    private boolean tryMultiAgentFlow(String userMessage,
                                        List<ChatMessage> chatHistory,
                                        com.clenzy.service.agent.multiagent.OrchestrationContext orchestrationCtx,
                                        String apiKey,
                                        AgentContext context,
                                        AssistantConversation conversation,
                                        Consumer<AgentSseEvent> consumer) {
        // Streaming progressif : l'orchestrateur relaie chaque fragment du texte
        // final via ce sink des qu'il arrive (parite UX avec le mono-agent), au
        // lieu d'un unique delta apres coup. Seul le tour final produit du texte.
        com.clenzy.service.agent.multiagent.OrchestratorAgent.OrchestrationResult result;
        try {
            // activitySink : relaie l'activite des agents (constellation Superviseur)
            // sur le MEME consumer SSE. Purement informatif (le pont AG-UI le
            // traduit en STATE_SNAPSHOT) — n'altere pas le flux texte/tools.
            result = multiAgentOrchestrator.orchestrate(chatHistory, context, orchestrationCtx, apiKey,
                    delta -> consumer.accept(AgentSseEvent.textDelta(delta)),
                    consumer);
        } catch (com.clenzy.service.agent.multiagent.MultiAgentConfirmationPauseException pause) {
            // HITL natif : un specialist a rencontre un tool a confirmation. On
            // met le flow EN PAUSE (sans fallback mono) et on expose la
            // confirmation au user via SSE. Le pont AG-UI traduit en interrupt.
            pauseMultiAgentForConfirmation(pause.pendingContext(), chatHistory,
                    context, conversation, consumer);
            return true;  // "handled" : surtout PAS de fallback mono-agent.
        }

        if (!result.isSuccess()) {
            // Sur un rate-limit (429), le fallback mono-agent est CONTRE-PRODUCTIF :
            // c'est le MEME provider/quota → il re-429 immediatement (double la charge
            // sur le quota free-tier + ~3s de latence inutile). On rend l'erreur
            // gracieuse directement (le pont AG-UI la traduit en message user lisible).
            if (isRateLimitError(result.error())) {
                log.warn("Multi-agent rate-limited ({}) — pas de fallback mono (meme provider)",
                        result.error());
                consumer.accept(AgentSseEvent.error(result.error()));
                return true;  // "handled" : surtout PAS de fallback mono-agent.
            }
            log.warn("Multi-agent returned error : {} — fallback mono-agent", result.error());
            return false;
        }

        // Emettre les tool_call_executed events pour chaque widget ET les collecter
        // pour la persistance. Un seul toolCallId synthetique par widget, partage
        // entre le SSE (streaming) et le JSON tool_calls (reload) → les widgets se
        // re-hydratent a l'identique au reload de la conversation (sinon ils
        // disparaissent car parseToolCallsJsonSafe ne trouve rien — bug rapporte
        // "les schemas/tableaux/graphiques disparaissent au reload").
        //    toolCallId "ma-"+UUID : "ma" = multi-agent prefix ; evite la React key
        //    collision ("multiple children with key=null") quand plusieurs tools
        //    sont invoques. Pas de flow pause-confirm en multi-agent v1 donc pas
        //    besoin d'un id "trackable".
        //    Le frontend range les widgets dans draft.toolCalls[] (slot distinct du
        //    texte) : l'ordre vis-a-vis des text_delta deja streames est sans effet
        //    sur le rendu final.
        // Emission widgets + persistance + usage + 'done' : logique partagee avec la
        // reprise apres confirmation (cf. finalizeMultiAgentTurn, consolidation #4).
        finalizeMultiAgentTurn(result, conversation, context, consumer);
        return true;
    }

    /**
     * Met le flow multi-agent EN PAUSE sur un tool a confirmation : persiste le
     * contexte de reprise dans {@link PendingToolStore} (clé = id du tool call,
     * comme le mono-agent) et emet les events SSE de pause.
     *
     * <p>Le {@code pendingHistory} BDD (chatHistory) est conservé pour parité
     * avec le mono — la reprise multi-agent s'appuie sur le
     * {@link com.clenzy.service.agent.multiagent.MultiAgentPendingContext}.</p>
     */
    private void pauseMultiAgentForConfirmation(
            com.clenzy.service.agent.multiagent.MultiAgentPendingContext pending,
            List<ChatMessage> chatHistory,
            AgentContext context,
            AssistantConversation conversation,
            Consumer<AgentSseEvent> consumer) {

        ChatMessage.ToolCall toolCall = pending.pendingToolCall();

        String description = toolRegistry.find(toolCall.name())
                .map(h -> h.descriptor() != null ? h.descriptor().description() : null)
                .orElse(null);

        // Persistance : meme cle (toolCallId) + memes garanties (TTL, ownership
        // keycloakId, index Redis "en attente") que le mono-agent. Le
        // multiAgentContext distingue la reprise multi-agent de la reprise mono.
        pendingToolStore.put(
                toolCall.id(),
                conversation.getId(),
                context.organizationId(),
                context.keycloakId(),
                toolCall.name(),
                toolCall.arguments(),
                chatHistory,
                pending,
                description
        );

        consumer.accept(AgentSseEvent.toolConfirmationRequest(
                toolCall.name(), toolCall.id(), toolCall.arguments(), description));
        consumer.accept(AgentSseEvent.pausedAwaitingConfirmation());

        log.info("Multi-agent paused for confirmation (tool '{}', specialist '{}', conv {})",
                toolCall.name(), pending.specialistName(), conversation.getId());
    }

    // ─── Helpers ───────────────────────────────────────────────────────────

    /**
     * Construit le system prompt pour cette conversation (delegue a
     * {@link AgentPromptComposer}).
     *
     * <p>Variante sans userMessage : utilisee dans les resume-after-confirmation
     * (pas de nouvelle query memoire/RAG).</p>
     */
    String buildSystemPrompt(AgentContext context) {
        return promptComposer.buildSegmentedSystemPrompt(context).full();
    }

    /**
     * Variante avec userMessage : selection memoire par similarite + RAG
     * auto-injection (delegue a {@link AgentPromptComposer}).
     */
    String buildSystemPrompt(AgentContext context, String latestUserMessage) {
        return promptComposer.buildSegmentedSystemPrompt(context, latestUserMessage).full();
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

    /**
     * Forme persistee d'un widget multi-agent, alignee sur l'interface frontend
     * {@code ToolCallExecuted} (toolName / toolCallId / toolError / displayHint /
     * toolResult). Jackson serialise les composants du record sous ces memes
     * cles, ce que {@code parseToolCallsJsonSafe} attend pour re-hydrater les
     * widgets au reload — a l'identique du shape SSE streame en direct.
     */
    private record PersistedToolCall(
            String toolName,
            String toolCallId,
            boolean toolError,
            String displayHint,
            String toolResult
    ) {}

    private String serializeWidgetsSafe(List<PersistedToolCall> widgets) {
        if (widgets == null || widgets.isEmpty()) return null;
        try {
            return objectMapper.writeValueAsString(widgets);
        } catch (JsonProcessingException e) {
            // Best-effort (les widgets ne se rehydrateront pas au reload, le flux
            // SSE direct n'est pas impacte), mais trace complete pour diagnostic
            // (T-SOLID-7 : avant, message seul).
            log.warn("Failed to serialize multi-agent widgets ({} widget(s)) : {}",
                    widgets.size(), e.getMessage(), e);
            return null;
        }
    }

    private String deriveTitle(String firstMessage) {
        if (firstMessage == null) return null;
        String trimmed = firstMessage.strip().replaceAll("\\s+", " ");
        if (trimmed.length() <= 60) return trimmed;
        return trimmed.substring(0, 57) + "...";
    }
}
