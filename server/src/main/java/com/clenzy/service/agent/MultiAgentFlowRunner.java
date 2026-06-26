package com.clenzy.service.agent;

import com.clenzy.config.ai.ChatMessage;
import com.clenzy.model.AssistantConversation;
import com.clenzy.model.AssistantMessage;
import com.clenzy.repository.AssistantMessageRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

/**
 * Flux multi-agent de l'assistant : tentative d'orchestration via l'architecture
 * multi-agent (orchestrateur + spécialistes ≤10 tools chacun) au lieu du mono-agent
 * (27 tools en bloc), avec gestion native de la confirmation HITL (pause/reprise).
 *
 * <p>Extrait de {@code AgentOrchestrator} (consolidation moteur #4) — comportement
 * strictement identique : memes events SSE, meme persistance, meme ordre d'emission,
 * memes messages. Pur deplacement de methodes + delegation.</p>
 *
 * <p><b>Collaborateurs</b> :
 * <ul>
 *   <li>{@link com.clenzy.service.agent.multiagent.OrchestratorAgent} : moteur multi-agent</li>
 *   <li>{@link com.clenzy.service.agent.multiagent.SpecialistRegistry} : disponibilite des specialistes</li>
 *   <li>{@link AssistantTargetResolver} : provider/modele/cle/baseUrl effectifs (reprise)</li>
 *   <li>{@link AgentToolLoopRunner} : tracking usage tokens ({@code recordUsageSafe})</li>
 *   <li>{@link AssistantMessageRepository} : persistance du message assistant</li>
 *   <li>{@link PendingToolStore} : pause-confirmation (clé = toolCallId)</li>
 *   <li>{@link ToolRegistry} : description du tool en pause</li>
 *   <li>{@code ObjectMapper} : serialisation des widgets pour re-hydratation au reload</li>
 * </ul>
 */
@Component
public class MultiAgentFlowRunner {

    private static final Logger log = LoggerFactory.getLogger(MultiAgentFlowRunner.class);

    private final com.clenzy.service.agent.multiagent.OrchestratorAgent multiAgentOrchestrator;
    private final com.clenzy.service.agent.multiagent.SpecialistRegistry specialistRegistry;
    private final AssistantMessageRepository messageRepository;
    private final PendingToolStore pendingToolStore;
    private final AgentToolLoopRunner toolLoopRunner;
    private final AssistantTargetResolver targetResolver;
    private final ToolRegistry toolRegistry;
    private final ObjectMapper objectMapper;

    /**
     * Feature flag : si true, le multi-agent peut etre tente (cf. {@link #canUse}).
     *
     * <p>Defaut false. Override (en dev) :
     * {@code clenzy.assistant.multi-agent.enabled=true}</p>
     */
    private final boolean multiAgentEnabled;

    public MultiAgentFlowRunner(
            com.clenzy.service.agent.multiagent.OrchestratorAgent multiAgentOrchestrator,
            com.clenzy.service.agent.multiagent.SpecialistRegistry specialistRegistry,
            AssistantMessageRepository messageRepository,
            PendingToolStore pendingToolStore,
            AgentToolLoopRunner toolLoopRunner,
            AssistantTargetResolver targetResolver,
            ToolRegistry toolRegistry,
            ObjectMapper objectMapper,
            @Value("${clenzy.assistant.multi-agent.enabled:false}") boolean multiAgentEnabled) {
        this.multiAgentOrchestrator = multiAgentOrchestrator;
        this.specialistRegistry = specialistRegistry;
        this.messageRepository = messageRepository;
        this.pendingToolStore = pendingToolStore;
        this.toolLoopRunner = toolLoopRunner;
        this.targetResolver = targetResolver;
        this.toolRegistry = toolRegistry;
        this.objectMapper = objectMapper;
        this.multiAgentEnabled = multiAgentEnabled;
    }

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
    public boolean canUse(AgentContext context, boolean hasAttachments) {
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
    public boolean tryFlow(String userMessage,
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
     * Reprise du flow multi-agent apres confirmation/refus (HITL natif).
     *
     * <p>Re-entre dans le moteur multi-agent : le specialist en pause finit sa
     * boucle avec le tool result injecte (cf.
     * {@link com.clenzy.service.agent.multiagent.OrchestratorAgent#resumeOrchestration}),
     * puis l'orchestrateur continue jusqu'a la reponse finale. Emet les widgets +
     * texte + done, et persiste le message assistant — parite avec
     * {@link #tryFlow}.</p>
     *
     * <p>Re-pause (chainage) : si le specialist re-demande une confirmation, on
     * re-persiste le nouveau contexte et on emet une nouvelle pause.</p>
     */
    public void resumeAfterConfirmation(
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
        // tryFlow (cf. finalizeMultiAgentTurn).
        finalizeMultiAgentTurn(result, conversation, context, consumer);
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

    /**
     * Finalise un tour multi-agent : emet les widgets (dedup anti-boucle), persiste le
     * message assistant + tokens, track l'usage (badge cout), puis emet {@code done}.
     *
     * <p>Logique unique partagee entre le flux nominal ({@link #tryFlow}) et la
     * reprise apres confirmation ({@link #resumeAfterConfirmation}) — auparavant
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
}
