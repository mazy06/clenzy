package com.clenzy.service.agent.multiagent;

import com.clenzy.config.ai.ChatEvent;
import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.config.ai.ChatMessage;
import com.clenzy.config.ai.ChatRequest;
import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.model.AssistantMemory;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.AgentSseEvent;
import com.clenzy.service.agent.kb.KbSearchService.KbSearchHit;
import com.clenzy.service.agent.prompt.PromptSecurityGuidance;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;

/**
 * Orchestrateur principal du multi-agent system : decide quel(s)
 * {@link AgentSpecialist} appeler via un meta-tool unique {@code delegate_to}.
 *
 * <p><b>Flow</b> :</p>
 * <ol>
 *   <li>LLM call #1 (orchestrator) : prompt = liste des spécialistes, tool = delegate_to</li>
 *   <li>Le LLM choisit un spécialiste + une query</li>
 *   <li>L'orchestrateur invoque {@link AgentSpecialist#handle} (qui fait LLM call #2)</li>
 *   <li>Le résultat est reinjecte comme tool_result a l'orchestrator</li>
 *   <li>Boucle jusqu'a ce que l'orchestrator produise une reponse texte finale
 *       (ou max iterations atteintes)</li>
 * </ol>
 *
 * <p><b>Pourquoi 1 seul meta-tool</b> : la litterature LLM dit que la qualite
 * de routing dégrade au-dela de ~10 tools. Avec UN seul tool (delegate_to),
 * l'orchestrateur a un choix trivial : "qui est le bon spécialiste pour cette
 * query ?". Pas de distraction par les arguments concrets des tools metier.</p>
 */
@Component
public class OrchestratorAgent {

    private static final Logger log = LoggerFactory.getLogger(OrchestratorAgent.class);

    /** Plafond de delegations par message user (anti-boucle infinie). */
    public static final int MAX_DELEGATIONS = 3;
    public static final int MAX_TOKENS = 1024;
    public static final double TEMPERATURE = 0.1;  // tres deterministe pour le routing

    public static final String DELEGATE_TOOL_NAME = "delegate_to";

    private final ChatLLMProvider chatProvider;
    private final SpecialistRegistry registry;
    private final ObjectMapper objectMapper;
    private final MeterRegistry meterRegistry;
    private final Timer orchestrateTimer;

    /**
     * Feature flag : HITL natif multi-agent. Si {@code true} (defaut), un tool
     * a confirmation rencontre par un specialist met le flow EN PAUSE (le
     * multi-agent gere lui-meme la confirmation, le pont AG-UI traduit en
     * interrupt). Si {@code false}, comportement legacy : on re-leve
     * {@link ConfirmationRequiredException} simple → fallback mono-agent.
     *
     * <p>Override : {@code clenzy.assistant.multi-agent.hitl.enabled=false}</p>
     */
    private final boolean hitlEnabled;

    // @Autowired explicite : 2 constructeurs publics existent (5-arg Spring +
    // 4-arg retro-compat tests) → sans cette annotation Spring cherche un
    // constructeur no-arg et echoue au boot ("No default constructor found").
    @org.springframework.beans.factory.annotation.Autowired
    public OrchestratorAgent(ChatLLMProvider chatProvider,
                               SpecialistRegistry registry,
                               ObjectMapper objectMapper,
                               MeterRegistry meterRegistry,
                               @org.springframework.beans.factory.annotation.Value(
                                       "${clenzy.assistant.multi-agent.hitl.enabled:true}")
                               boolean hitlEnabled) {
        this.chatProvider = chatProvider;
        this.registry = registry;
        this.objectMapper = objectMapper;
        this.meterRegistry = meterRegistry;
        this.hitlEnabled = hitlEnabled;
        this.orchestrateTimer = Timer.builder("assistant.orchestrator.handle")
                .description("Latence d'une orchestration complete (orchestrator + N specialists)")
                .publishPercentiles(0.5, 0.95, 0.99)
                .register(meterRegistry);
    }

    /**
     * Constructeur retro-compatible (sans flag HITL) — HITL natif active par
     * defaut. Conserve pour les tests existants qui instancient l'orchestrateur
     * a 4 arguments.
     */
    public OrchestratorAgent(ChatLLMProvider chatProvider,
                               SpecialistRegistry registry,
                               ObjectMapper objectMapper,
                               MeterRegistry meterRegistry) {
        this(chatProvider, registry, objectMapper, meterRegistry, true);
    }

    /**
     * Lance l'orchestration synchrone et retourne le texte final.
     *
     * <p><b>Legacy 2-arg</b> : seul le user message est envoye au LLM, sans
     * historique conversationnel. Ce chemin est conserve pour compatibilite
     * (tests existants, appels ponctuels) mais ne devrait PAS etre utilise
     * en production pour un assistant chat multi-tour.</p>
     *
     * <p>Prefer la signature 3-arg {@link #orchestrate(List, AgentContext)}
     * qui transmet l'historique complet.</p>
     */
    public OrchestrationResult orchestrate(String userMessage, AgentContext context) {
        return orchestrate(List.of(ChatMessage.user(userMessage)), context, OrchestrationContext.empty());
    }

    /**
     * Lance l'orchestration avec l'historique conversationnel complet.
     *
     * <p>Backwards-compat : delegue a la version 3-arg avec un contexte vide
     * (pas de memoire ni de RAG). Prefer la version 3-arg pour beneficier de
     * la personnalisation user et de la doc Clenzy.</p>
     */
    public OrchestrationResult orchestrate(List<ChatMessage> messages, AgentContext context) {
        return orchestrate(messages, context, OrchestrationContext.empty());
    }

    /**
     * Lance l'orchestration avec historique + contexte (memoire + RAG) pre-charges.
     *
     * <p><b>{@code messages}</b> contient l'historique chronologique des
     * echanges user/assistant/tool de la conversation, le dernier element
     * etant la question courante de l'utilisateur.</p>
     *
     * <p><b>{@code orchestrationCtx}</b> porte les memoires long-terme et
     * les snippets RAG pre-charges par AgentOrchestrator. Ces elements sont
     * injectes dans le system prompt de l'orchestrator (pour decider quel
     * specialist invoquer en connaissance) ET propages aux specialists via
     * SpecialistRequest (pour qu'ils citent la doc et respectent les
     * preferences user).</p>
     *
     * <p>Version non-streaming (PoC). Le streaming SSE bidirectionnel
     * (orchestrator emet tools + specialists emettent au fur et a mesure)
     * sera ajoute en v2 quand l'integration AgentOrchestrator sera faite.</p>
     */
    public OrchestrationResult orchestrate(List<ChatMessage> messages, AgentContext context,
                                             OrchestrationContext orchestrationCtx) {
        return orchestrate(messages, context, orchestrationCtx, null);
    }

    /**
     * Lance l'orchestration avec apiKey BYOK explicite.
     *
     * <p><b>{@code apiKey}</b> est la cle Anthropic resolue par AgentOrchestrator
     * (priorite BYOK org > cle plateforme). Si {@code null}, le chatProvider
     * utilise la cle plateforme. Cette cle est propagee aux specialists via
     * {@link SpecialistRequest#apiKey()} pour qu'ils consomment sur la meme
     * cle (Fix bloquant #4 de l'audit pre-prod).</p>
     *
     * <p>La cle n'est JAMAIS loggee.</p>
     */
    public OrchestrationResult orchestrate(List<ChatMessage> messages, AgentContext context,
                                             OrchestrationContext orchestrationCtx,
                                             String apiKey) {
        return orchestrate(messages, context, orchestrationCtx, apiKey, null);
    }

    /**
     * Variante streaming : {@code textDeltaSink} (nullable) recoit chaque
     * fragment de texte de l'orchestrateur des qu'il arrive. Permet a
     * l'AgentOrchestrator de relayer la reponse finale en SSE progressif
     * (parite UX avec le mono-agent {@code streamOneTurn}).
     *
     * <p>Si {@code null} : comportement non-streaming inchange (le texte n'est
     * disponible que dans {@link OrchestrationResult#finalText()}).</p>
     *
     * <p>En pratique seul le tour final produit du texte — l'orchestrateur
     * delegue via tool calls sans preambule (cf. son system prompt). Les rares
     * fragments emis sur un tour de delegation sont relayes ET accumules dans
     * {@code finalText}, donc le texte streame == le texte persiste.</p>
     */
    public OrchestrationResult orchestrate(List<ChatMessage> messages, AgentContext context,
                                             OrchestrationContext orchestrationCtx,
                                             String apiKey,
                                             Consumer<String> textDeltaSink) {
        return orchestrate(messages, context, orchestrationCtx, apiKey, textDeltaSink, null);
    }

    /**
     * Variante avec un {@code activitySink} (nullable) qui recoit l'activite des
     * agents au fil de l'orchestration (specialist demarre / agit / termine +
     * etat orchestrateur), pour alimenter la constellation « Superviseur d'agents »
     * cote front (via le pont AG-UI {@code STATE_SNAPSHOT}).
     *
     * <p>Purement observationnel : n'altere NI le flux texte, NI le routing, NI
     * les tools. Si {@code null} : comportement inchange (aucun event d'activite).</p>
     */
    public OrchestrationResult orchestrate(List<ChatMessage> messages, AgentContext context,
                                             OrchestrationContext orchestrationCtx,
                                             String apiKey,
                                             Consumer<String> textDeltaSink,
                                             Consumer<AgentSseEvent> activitySink) {
        long startNanos = System.nanoTime();
        try {
            return doOrchestrate(messages, context,
                    orchestrationCtx == null ? OrchestrationContext.empty() : orchestrationCtx,
                    apiKey, textDeltaSink, activitySink);
        } finally {
            orchestrateTimer.record(System.nanoTime() - startNanos, TimeUnit.NANOSECONDS);
        }
    }

    private OrchestrationResult doOrchestrate(List<ChatMessage> messages, AgentContext context,
                                                 OrchestrationContext orchestrationCtx,
                                                 String apiKey,
                                                 Consumer<String> textDeltaSink,
                                                 Consumer<AgentSseEvent> activitySink) {
        // Pas de specialistes -> impossible d'orchestrer
        if (registry.size() == 0) {
            return OrchestrationResult.error("Aucun specialiste enregistre, orchestration impossible");
        }
        if (messages == null || messages.isEmpty()) {
            return OrchestrationResult.error("Messages history vide, impossible d'orchestrer");
        }

        String systemPrompt = buildOrchestratorSystemPrompt(orchestrationCtx, context);
        List<ToolDescriptor> tools = List.of(buildDelegateToolDescriptor());
        ChatRequest req = new ChatRequest(
                systemPrompt,
                messages,
                tools,
                context.modelOverride(),       // modele resolu (Settings/BYOK) ou null = defaut provider
                TEMPERATURE,
                MAX_TOKENS,
                null,                           // system mono-bloc (pas de suffixe volatil)
                context.aiProvider(),           // provider effectif (routage multi-provider)
                context.aiBaseUrl()
        );

        List<String> delegationsLog = new ArrayList<>();
        List<ToolInvocationSnapshot> aggregatedToolInvocations = new ArrayList<>();
        AtomicInteger totalPromptTokens = new AtomicInteger();
        AtomicInteger totalCompletionTokens = new AtomicInteger();
        StringBuilder finalText = new StringBuilder();
        // Garde-boucle orchestrateur (parallele du cache specialist) : signature
        // (specialist::query) -> synthese deja obtenue. Un modele peut re-deleguer
        // une delegation IDENTIQUE ; on reutilise la synthese SANS re-deleguer (pas
        // de re-execution des tools du specialist, pas de cout LLM supplementaire).
        java.util.Map<String, String> delegationCache = new java.util.HashMap<>();
        // Derniere synthese de specialist exploitable comme repli si l'orchestrateur
        // n'arrive pas a produire un texte final (cf. terminaison forcee).
        String lastSpecialistSynthesis = null;

        for (int iter = 0; iter < MAX_DELEGATIONS; iter++) {
            AtomicReference<String> textOut = new AtomicReference<>("");
            AtomicReference<List<ChatMessage.ToolCall>> toolCallsRef = new AtomicReference<>(List.of());
            AtomicReference<String> errorMsg = new AtomicReference<>();

            // Fix bloquant #4 : utiliser la cle BYOK org si fournie.
            Consumer<ChatEvent> eventConsumer = event -> {
                if (event instanceof ChatEvent.TextDelta td) {
                    textOut.set(textOut.get() + td.delta());
                    // Relai SSE progressif : forwarde le fragment des qu'il arrive.
                    if (textDeltaSink != null) {
                        textDeltaSink.accept(td.delta());
                    }
                } else if (event instanceof ChatEvent.ToolCallRequest tcr) {
                    toolCallsRef.set(tcr.calls());
                } else if (event instanceof ChatEvent.Done done) {
                    totalPromptTokens.addAndGet(done.promptTokens());
                    totalCompletionTokens.addAndGet(done.completionTokens());
                } else if (event instanceof ChatEvent.Error err) {
                    errorMsg.set(err.message());
                }
            };
            if (apiKey != null) {
                chatProvider.streamChat(req, eventConsumer, apiKey);
            } else {
                chatProvider.streamChat(req, eventConsumer);
            }

            if (errorMsg.get() != null) {
                return OrchestrationResult.error("Orchestrator LLM error : " + errorMsg.get());
            }

            // Accumule le texte de CE tour (vide sur les tours de delegation —
            // l'orchestrateur delegue sans preambule). Garantit que le texte
            // persiste == le texte relaye via textDeltaSink.
            finalText.append(textOut.get());

            List<ChatMessage.ToolCall> toolCalls = toolCallsRef.get();
            if (toolCalls.isEmpty()) {
                // Pas de delegation : l'orchestrator a tranche directement.
                // Terminaison forcee : si le texte est vide APRES >=1 delegation,
                // on retombe sur un repli non-vide (jamais de reponse vide au user).
                return OrchestrationResult.success(
                        ensureFinalText(finalText.toString().strip(), lastSpecialistSynthesis,
                                aggregatedToolInvocations, !delegationsLog.isEmpty()),
                        delegationsLog,
                        aggregatedToolInvocations,
                        totalPromptTokens.get(),
                        totalCompletionTokens.get(),
                        iter
                );
            }

            // Append message assistant + executer chaque delegation
            req = req.withAppendedMessage(ChatMessage.assistantToolCalls(toolCalls));
            // Detecte une boucle sterile : si l'orchestrateur ne fait que re-deleguer
            // des delegations DEJA satisfaites (toutes en cache), on arrete apres ce
            // tour (le modele tourne en rond) et on synthetise un repli.
            boolean anyNewDelegation = false;
            for (ChatMessage.ToolCall tc : toolCalls) {
                if (!DELEGATE_TOOL_NAME.equals(tc.name())) {
                    log.warn("Orchestrator emitted unknown tool '{}'", tc.name());
                    req = req.withAppendedMessage(ChatMessage.tool(tc.id(),
                            "Tool inconnu, seul '" + DELEGATE_TOOL_NAME + "' est autorise"));
                    continue;
                }
                DelegateArgs args = parseDelegateArgs(tc.arguments());
                if (args == null) {
                    req = req.withAppendedMessage(ChatMessage.tool(tc.id(),
                            "Arguments invalides pour delegate_to (besoin de specialist + query)"));
                    continue;
                }
                // Garde-boucle : delegation identique deja resolue -> reutiliser la
                // synthese cachee SANS re-deleguer (parallele du cache specialist).
                String cacheKey = args.specialist() + "::" + args.query();
                String cached = delegationCache.get(cacheKey);
                if (cached != null) {
                    log.info("Orchestrator reusing cached delegation '{}' (no re-delegation)",
                            args.specialist());
                    req = req.withAppendedMessage(ChatMessage.tool(tc.id(), cached));
                    continue;
                }
                anyNewDelegation = true;
                // Constellation : le specialist demarre puis reflechit (le LLM
                // call #2 du specialist tourne). `query` = libelle metier court.
                emitActivity(activitySink, args.specialist(), "started", null, args.query());
                emitActivity(activitySink, args.specialist(), "thinking", null, args.query());
                SpecialistResult result;
                try {
                    result = invokeSpecialist(args, context, orchestrationCtx, apiKey);
                } catch (ConfirmationRequiredException e) {
                    // Le specialist a rencontre un tool a confirmation.
                    if (hitlEnabled && e.hasResumeContext()) {
                        // HITL natif : capturer l'etat d'orchestration et signaler
                        // une pause resumable (PAS de fallback mono-agent). `req`
                        // contient deja le tour assistant delegate_to (appended
                        // ci-dessus) → on capture cet historique + l'id du call.
                        // Constellation : le specialist attend une validation humaine.
                        emitActivity(activitySink, args.specialist(), "acting", e.toolName(), args.query());
                        MultiAgentPendingContext pending = new MultiAgentPendingContext(
                                args.specialist(),
                                e.specialistHistory(),
                                e.toolCall(),
                                req.messages(),
                                tc.id(),
                                context
                        );
                        meterRegistry.counter("assistant.orchestrator.confirmation_pause",
                                "specialist", args.specialist(),
                                "tool", e.toolName()).increment();
                        throw new MultiAgentConfirmationPauseException(pending);
                    }
                    // Legacy : re-leve tel quel → AgentOrchestrator fallback mono.
                    throw e;
                }
                // Constellation : le specialist a agi (un event par outil reel
                // qu'il a invoque), puis a termine.
                emitToolActivity(activitySink, args.specialist(), result);
                emitActivity(activitySink, args.specialist(), "done", null, args.query());
                delegationsLog.add(args.specialist() + " → " + (result.isSuccess() ? "OK" : "ERR"));
                // Aggregation des widgets : permet au frontend de continuer a afficher
                // les visualisations (KPI cards, charts) en mode multi-agent.
                aggregatedToolInvocations.addAll(result.toolInvocations());
                totalPromptTokens.addAndGet(result.promptTokens());
                totalCompletionTokens.addAndGet(result.completionTokens());
                // Degradation gracieuse : si le specialist a echoue, on injecte un
                // message clair (PAS la stacktrace/erreur brute) pour que
                // l'orchestrateur puisse quand meme formuler une reponse utile.
                String toolResultContent = toolResultFor(result, args.specialist());
                if (result.isSuccess()) {
                    lastSpecialistSynthesis = result.synthesis();
                }
                delegationCache.put(args.specialist() + "::" + args.query(), toolResultContent);
                req = req.withAppendedMessage(ChatMessage.tool(tc.id(), toolResultContent));
                meterRegistry.counter("assistant.orchestrator.delegations",
                        "specialist", args.specialist()).increment();
            }

            // Boucle sterile : le tour n'a fait que re-deleguer des delegations
            // deja resolues (cache). Le modele tourne en rond -> on arrete et on
            // synthetise le repli, sans gaspiller le quota de delegations restant.
            if (!anyNewDelegation) {
                log.info("Orchestrator breaking sterile delegation loop (only duplicate delegations)");
                meterRegistry.counter("assistant.orchestrator.sterile_loop_break").increment();
                return OrchestrationResult.success(
                        ensureFinalText(finalText.toString().strip(), lastSpecialistSynthesis,
                                aggregatedToolInvocations, true),
                        delegationsLog, aggregatedToolInvocations,
                        totalPromptTokens.get(), totalCompletionTokens.get(), iter);
            }
        }

        // Iterations atteintes — terminaison forcee : TOUJOURS un texte non-vide
        // (repli sur la derniere synthese / les widgets), jamais un finalText brut vide.
        meterRegistry.counter("assistant.orchestrator.max_delegations_reached").increment();
        return OrchestrationResult.truncated(
                ensureFinalText(finalText.toString().strip(), lastSpecialistSynthesis,
                        aggregatedToolInvocations, !delegationsLog.isEmpty()),
                delegationsLog,
                aggregatedToolInvocations,
                totalPromptTokens.get(),
                totalCompletionTokens.get()
        );
    }

    /**
     * Terminaison forcee : garantit un texte final NON VIDE pour l'utilisateur.
     *
     * <p>Si l'orchestrateur a produit un texte, on le garde. Sinon (LLM muet apres
     * une delegation, ou max delegations atteint) :</p>
     * <ul>
     *   <li>repli sur la derniere synthese de specialist exploitable ;</li>
     *   <li>sinon un message generique qui s'appuie sur les widgets deja emis
     *       (KPI/tableaux) s'il y en a ;</li>
     *   <li>en dernier recours, un message d'excuse honnete.</li>
     * </ul>
     *
     * @param produced            texte produit par l'orchestrateur (peut etre vide)
     * @param lastSynthesis       derniere synthese de specialist (nullable)
     * @param widgets             widgets agreges (pour adapter le message de repli)
     * @param hadDelegation       true si au moins une delegation a eu lieu
     */
    private static String ensureFinalText(String produced, String lastSynthesis,
                                          List<ToolInvocationSnapshot> widgets,
                                          boolean hadDelegation) {
        if (produced != null && !produced.isBlank()) {
            return produced;
        }
        if (!hadDelegation) {
            // Aucune delegation et texte vide : l'orchestrateur n'a rien produit.
            return "Je n'ai pas pu traiter votre demande pour le moment. "
                    + "Pouvez-vous reformuler ?";
        }
        if (lastSynthesis != null && !lastSynthesis.isBlank()) {
            return lastSynthesis.strip();
        }
        boolean hasWidgets = widgets != null
                && widgets.stream().anyMatch(w -> !w.isError());
        if (hasWidgets) {
            return "Voici ce que j'ai trouve.";
        }
        return "Je n'ai pas reussi a recuperer les informations demandees. "
                + "Reessayez dans un instant.";
    }

    /**
     * Degradation gracieuse : transforme un {@link SpecialistResult} en contenu de
     * tool_result a reinjecter a l'orchestrateur. En cas d'echec, on remonte un
     * message clair et borne (PAS de stacktrace ni de detail technique brut), pour
     * que l'orchestrateur formule un repli utile sans fuite d'information.
     */
    private static String toolResultFor(SpecialistResult result, String specialist) {
        if (result.isSuccess()) {
            return result.synthesis();
        }
        return "Le specialiste '" + specialist + "' n'a pas pu repondre a cette demande. "
                + "Indique a l'utilisateur que cette information n'a pas pu etre recuperee, "
                + "sans detailler l'erreur technique.";
    }

    private SpecialistResult invokeSpecialist(DelegateArgs args, AgentContext context,
                                                 OrchestrationContext orchestrationCtx,
                                                 String apiKey) {
        // ConfirmationRequiredException remonte intacte (re-throw automatique du
        // .map(...).orElseGet(...)) : le caller (doOrchestrate) l'intercepte pour
        // soit signaler une pause HITL native (MultiAgentConfirmationPauseException),
        // soit la re-lever pour fallback mono-agent (mode legacy).
        // OrchestrationContext propage memoire + RAG aux specialists ;
        // apiKey assure que les specialists consomment sur la meme cle BYOK
        // que l'orchestrator (Fix bloquant #4).
        return registry.find(args.specialist())
                .map(spec -> spec.handle(SpecialistRequest.of(args.query(), context,
                        orchestrationCtx, apiKey)))
                .orElseGet(() -> SpecialistResult.error(
                        "Specialiste inconnu : '" + args.specialist() + "'. "
                                + "Specialistes disponibles : " + registry.all().keySet()
                ));
    }

    /**
     * Reprend un flow multi-agent suspendu sur une confirmation user (HITL natif).
     *
     * <p><b>État machine — phase RESUME</b> :</p>
     * <ol>
     *   <li>Le specialist reprend sa boucle depuis l'historique capturé +
     *       le {@code toolResult} (execution reelle si confirmé, "annulé" sinon),
     *       et produit sa {@code synthesis}.</li>
     *   <li>Cette synthesis est réinjectée comme tool_result du {@code delegate_to}
     *       dans l'historique de l'orchestrateur ({@code orchestratorMessages}).</li>
     *   <li>La boucle d'orchestration reprend (delegations restantes possibles)
     *       jusqu'à la réponse texte finale.</li>
     * </ol>
     *
     * <p>Le {@code toolResult} est fourni par le caller (AgentOrchestrator), qui
     * a déjà exécuté ou refusé le tool — ce tool n'est PAS ré-exécuté ici (pas de
     * double-exécution).</p>
     *
     * @param pending      contexte de reprise capturé à la pause
     * @param resumeContext AgentContext courant (identité/JWT du resume). La cible
     *                      LLM (modèle/provider/baseUrl) est reprise de
     *                      {@code pending.effectiveContext()}.
     * @param orchestrationCtx mémoire + RAG (rechargés par AgentOrchestrator)
     * @param apiKey       clé BYOK résolue (peut différer si re-résolue au resume)
     * @param toolResult   résultat du tool confirmé/refusé
     * @param textDeltaSink relai SSE progressif (nullable)
     */
    public OrchestrationResult resumeOrchestration(MultiAgentPendingContext pending,
                                                    AgentContext resumeContext,
                                                    OrchestrationContext orchestrationCtx,
                                                    String apiKey,
                                                    com.clenzy.service.agent.ToolResult toolResult,
                                                    Consumer<String> textDeltaSink) {
        return resumeOrchestration(pending, resumeContext, orchestrationCtx, apiKey,
                toolResult, textDeltaSink, null);
    }

    /**
     * Variante resume avec {@code activitySink} (nullable) — emet l'activite des
     * agents repris vers la constellation (cf. {@link #orchestrate}).
     */
    public OrchestrationResult resumeOrchestration(MultiAgentPendingContext pending,
                                                    AgentContext resumeContext,
                                                    OrchestrationContext orchestrationCtx,
                                                    String apiKey,
                                                    com.clenzy.service.agent.ToolResult toolResult,
                                                    Consumer<String> textDeltaSink,
                                                    Consumer<AgentSseEvent> activitySink) {
        long startNanos = System.nanoTime();
        try {
            return doResumeOrchestration(pending,
                    resumeContext == null ? pending.effectiveContext() : resumeContext,
                    orchestrationCtx == null ? OrchestrationContext.empty() : orchestrationCtx,
                    apiKey, toolResult, textDeltaSink, activitySink);
        } finally {
            orchestrateTimer.record(System.nanoTime() - startNanos, TimeUnit.NANOSECONDS);
        }
    }

    private OrchestrationResult doResumeOrchestration(MultiAgentPendingContext pending,
                                                       AgentContext context,
                                                       OrchestrationContext orchestrationCtx,
                                                       String apiKey,
                                                       com.clenzy.service.agent.ToolResult toolResult,
                                                       Consumer<String> textDeltaSink,
                                                       Consumer<AgentSseEvent> activitySink) {
        // Constellation : le specialist en pause reprend (l'humain a tranche).
        emitActivity(activitySink, pending.specialistName(), "thinking", null, null);

        // 1) Reprendre le specialist depuis son historique capturé + le tool result.
        AgentSpecialist specialist = registry.find(pending.specialistName()).orElse(null);
        if (specialist == null || !(specialist instanceof AbstractAgentSpecialist resumable)) {
            // Specialist disparu (hot reload) ou non-resumable : on degrade en
            // injectant directement le tool result comme synthese minimale, pour
            // que l'orchestrateur puisse quand meme conclure.
            log.warn("Resume: specialist '{}' introuvable ou non-resumable — synthese degradee",
                    pending.specialistName());
            emitActivity(activitySink, pending.specialistName(), "done", null, null);
            return continueOrchestratorAfterDelegation(pending, context, apiKey,
                    toolResult.isError()
                            ? "Action non effectuee : " + toolResult.content()
                            : "Action effectuee. Resultat : " + toolResult.content(),
                    new java.util.ArrayList<>(), textDeltaSink, activitySink);
        }

        SpecialistRequest specialistRequest = SpecialistRequest.of(
                "(reprise apres confirmation)", context, orchestrationCtx, apiKey);
        SpecialistResult specResult = resumable.resumeWithToolResult(
                specialistRequest, pending.specialistHistory(),
                pending.pendingToolCall().id(), toolResult);

        // Constellation : action confirmee appliquee + tout outil read-only
        // supplementaire, puis le specialist termine.
        if (!toolResult.isError()) {
            emitActivity(activitySink, pending.specialistName(), "acting",
                    pending.pendingToolCall().name(), null);
        }
        emitToolActivity(activitySink, pending.specialistName(), specResult);
        emitActivity(activitySink, pending.specialistName(), "done", null, null);

        // 2/3) Réinjecter la synthesis comme tool_result du delegate_to et
        //       continuer la boucle d'orchestration.
        return continueOrchestratorAfterDelegation(pending, context, apiKey,
                specResult.synthesis(),
                new java.util.ArrayList<>(specResult.toolInvocations()), textDeltaSink, activitySink);
    }

    /**
     * Continue la boucle d'orchestration apres qu'une delegation (le specialist
     * en pause) a produit sa synthese — réinjectée comme tool_result du
     * {@code delegate_to} dans l'historique capturé de l'orchestrateur.
     */
    private OrchestrationResult continueOrchestratorAfterDelegation(
            MultiAgentPendingContext pending,
            AgentContext context,
            String apiKey,
            String delegateSynthesis,
            List<ToolInvocationSnapshot> seedInvocations,
            Consumer<String> textDeltaSink,
            Consumer<AgentSseEvent> activitySink) {

        String systemPrompt = buildOrchestratorSystemPrompt(OrchestrationContext.empty(), context);
        List<ToolDescriptor> tools = List.of(buildDelegateToolDescriptor());

        // Historique = messages orchestrateur capturés (jusqu'au delegate_to inclus)
        // + le tool_result du delegate_to (= synthese du specialist repris).
        List<ChatMessage> resumed = new ArrayList<>(pending.orchestratorMessages());
        resumed.add(ChatMessage.tool(pending.delegateToolCallId(), delegateSynthesis));

        ChatRequest req = new ChatRequest(
                systemPrompt, resumed, tools,
                context.modelOverride(), TEMPERATURE, MAX_TOKENS, null,
                context.aiProvider(), context.aiBaseUrl());

        List<String> delegationsLog = new ArrayList<>();
        delegationsLog.add(pending.specialistName() + " → RESUMED");
        List<ToolInvocationSnapshot> aggregatedToolInvocations = new ArrayList<>(seedInvocations);
        AtomicInteger totalPromptTokens = new AtomicInteger();
        AtomicInteger totalCompletionTokens = new AtomicInteger();
        StringBuilder finalText = new StringBuilder();
        // Memes gardes de robustesse que doOrchestrate : cache anti-boucle +
        // repli sur la derniere synthese (ici seedee par le specialist repris).
        java.util.Map<String, String> delegationCache = new java.util.HashMap<>();
        String lastSpecialistSynthesis = (delegateSynthesis != null && !delegateSynthesis.isBlank())
                ? delegateSynthesis : null;

        for (int iter = 0; iter < MAX_DELEGATIONS; iter++) {
            AtomicReference<String> textOut = new AtomicReference<>("");
            AtomicReference<List<ChatMessage.ToolCall>> toolCallsRef = new AtomicReference<>(List.of());
            AtomicReference<String> errorMsg = new AtomicReference<>();

            Consumer<ChatEvent> eventConsumer = event -> {
                if (event instanceof ChatEvent.TextDelta td) {
                    textOut.set(textOut.get() + td.delta());
                    if (textDeltaSink != null) {
                        textDeltaSink.accept(td.delta());
                    }
                } else if (event instanceof ChatEvent.ToolCallRequest tcr) {
                    toolCallsRef.set(tcr.calls());
                } else if (event instanceof ChatEvent.Done done) {
                    totalPromptTokens.addAndGet(done.promptTokens());
                    totalCompletionTokens.addAndGet(done.completionTokens());
                } else if (event instanceof ChatEvent.Error err) {
                    errorMsg.set(err.message());
                }
            };
            if (apiKey != null) {
                chatProvider.streamChat(req, eventConsumer, apiKey);
            } else {
                chatProvider.streamChat(req, eventConsumer);
            }

            if (errorMsg.get() != null) {
                return OrchestrationResult.error("Orchestrator LLM error : " + errorMsg.get());
            }

            finalText.append(textOut.get());

            List<ChatMessage.ToolCall> toolCalls = toolCallsRef.get();
            if (toolCalls.isEmpty()) {
                return OrchestrationResult.success(
                        ensureFinalText(finalText.toString().strip(), lastSpecialistSynthesis,
                                aggregatedToolInvocations, true),
                        delegationsLog, aggregatedToolInvocations,
                        totalPromptTokens.get(), totalCompletionTokens.get(), iter);
            }

            // Délégations supplémentaires après reprise : exécutées normalement.
            // Un specialist qui re-demande une confirmation re-pause (chainage).
            req = req.withAppendedMessage(ChatMessage.assistantToolCalls(toolCalls));
            boolean anyNewDelegation = false;
            for (ChatMessage.ToolCall tc : toolCalls) {
                if (!DELEGATE_TOOL_NAME.equals(tc.name())) {
                    req = req.withAppendedMessage(ChatMessage.tool(tc.id(),
                            "Tool inconnu, seul '" + DELEGATE_TOOL_NAME + "' est autorise"));
                    continue;
                }
                DelegateArgs args = parseDelegateArgs(tc.arguments());
                if (args == null) {
                    req = req.withAppendedMessage(ChatMessage.tool(tc.id(),
                            "Arguments invalides pour delegate_to (besoin de specialist + query)"));
                    continue;
                }
                String cacheKey = args.specialist() + "::" + args.query();
                String cached = delegationCache.get(cacheKey);
                if (cached != null) {
                    log.info("Orchestrator (resume) reusing cached delegation '{}'", args.specialist());
                    req = req.withAppendedMessage(ChatMessage.tool(tc.id(), cached));
                    continue;
                }
                anyNewDelegation = true;
                emitActivity(activitySink, args.specialist(), "started", null, args.query());
                emitActivity(activitySink, args.specialist(), "thinking", null, args.query());
                SpecialistResult result;
                try {
                    result = invokeSpecialist(args, context, OrchestrationContext.empty(), apiKey);
                } catch (ConfirmationRequiredException e) {
                    if (hitlEnabled && e.hasResumeContext()) {
                        emitActivity(activitySink, args.specialist(), "acting", e.toolName(), args.query());
                        MultiAgentPendingContext nextPending = new MultiAgentPendingContext(
                                args.specialist(), e.specialistHistory(), e.toolCall(),
                                req.messages(), tc.id(), context);
                        throw new MultiAgentConfirmationPauseException(nextPending);
                    }
                    throw e;
                }
                emitToolActivity(activitySink, args.specialist(), result);
                emitActivity(activitySink, args.specialist(), "done", null, args.query());
                delegationsLog.add(args.specialist() + " → " + (result.isSuccess() ? "OK" : "ERR"));
                aggregatedToolInvocations.addAll(result.toolInvocations());
                totalPromptTokens.addAndGet(result.promptTokens());
                totalCompletionTokens.addAndGet(result.completionTokens());
                String toolResultContent = toolResultFor(result, args.specialist());
                if (result.isSuccess()) {
                    lastSpecialistSynthesis = result.synthesis();
                }
                delegationCache.put(cacheKey, toolResultContent);
                req = req.withAppendedMessage(ChatMessage.tool(tc.id(), toolResultContent));
            }

            if (!anyNewDelegation) {
                log.info("Orchestrator (resume) breaking sterile delegation loop");
                meterRegistry.counter("assistant.orchestrator.sterile_loop_break").increment();
                return OrchestrationResult.success(
                        ensureFinalText(finalText.toString().strip(), lastSpecialistSynthesis,
                                aggregatedToolInvocations, true),
                        delegationsLog, aggregatedToolInvocations,
                        totalPromptTokens.get(), totalCompletionTokens.get(), iter);
            }
        }

        meterRegistry.counter("assistant.orchestrator.max_delegations_reached").increment();
        return OrchestrationResult.truncated(
                ensureFinalText(finalText.toString().strip(), lastSpecialistSynthesis,
                        aggregatedToolInvocations, true),
                delegationsLog, aggregatedToolInvocations,
                totalPromptTokens.get(), totalCompletionTokens.get());
    }

    private DelegateArgs parseDelegateArgs(String json) {
        try {
            JsonNode node = objectMapper.readTree(json);
            String specialist = node.path("specialist").asText(null);
            String query = node.path("query").asText(null);
            if (specialist == null || specialist.isBlank() || query == null || query.isBlank()) {
                return null;
            }
            return new DelegateArgs(specialist, query);
        } catch (Exception e) {
            log.warn("Failed to parse delegate_to args : {}", e.getMessage());
            return null;
        }
    }

    /**
     * Backwards-compat : delegue avec contexte vide + AgentContext null.
     */
    String buildOrchestratorSystemPrompt() {
        return buildOrchestratorSystemPrompt(OrchestrationContext.empty(), null);
    }

    /** Backwards-compat 2-arg (sans AgentContext) — utilise par tests existants. */
    String buildOrchestratorSystemPrompt(OrchestrationContext orchestrationCtx) {
        return buildOrchestratorSystemPrompt(orchestrationCtx, null);
    }

    /**
     * System prompt orchestrator avec injection optionnelle de :
     * <ul>
     *   <li>Section {@code <user_context>} : langue + page courante + propriete
     *       selectionnee dans l'UI (Fix bloquant #5)</li>
     *   <li>Section {@code <memory>} : faits/preferences/objectifs de l'user</li>
     *   <li>Section {@code <knowledge_base>} : snippets doc relevants pour
     *       la query, avec source pour citation</li>
     * </ul>
     *
     * <p>Les sections ne sont rendues QUE si elles ont du contenu.</p>
     */
    String buildOrchestratorSystemPrompt(OrchestrationContext orchestrationCtx,
                                            AgentContext agentContext) {
        StringBuilder sb = new StringBuilder(1024);

        // Context UI (langue + page + propriete) — utile a l'orchestrator pour
        // contextualiser la query au specialist ("je suis sur /properties/42" →
        // si la query est ambigue, assumer que c'est la propriete 42).
        String contextSection = renderUserContextSection(agentContext);
        if (!contextSection.isEmpty()) {
            sb.append(contextSection).append("\n\n");
        }

        // Memoire long-terme : injectee pour que le LLM en tienne compte des
        // l'analyse de la question (ex: "user prefere EUR" → orchestrator peut
        // pre-formater la query au specialist).
        String memorySection = renderMemorySection(orchestrationCtx.memories());
        if (!memorySection.isEmpty()) {
            sb.append(memorySection).append("\n\n");
        }

        // RAG : snippets doc avec source pour citation.
        String kbSection = renderKbSection(orchestrationCtx.kbHits());
        if (!kbSection.isEmpty()) {
            sb.append(kbSection).append("\n\n");
        }

        sb.append("<role>\n")
                .append("Tu es l'orchestrateur principal de l'assistant Clenzy PMS. ")
                .append("Tu ne reponds JAMAIS directement aux questions metier — tu delegues ")
                .append("a un specialiste via le tool delegate_to.\n")
                .append("</role>\n\n");

        // Garde anti-injection : memoire + RAG (donnees non fiables) sont injectees
        // ci-dessus ; rappeler que seules les instructions du user/system comptent.
        sb.append(PromptSecurityGuidance.block()).append("\n\n");

        sb.append("<specialists>\n");
        for (Map.Entry<String, AgentSpecialist> entry : registry.all().entrySet()) {
            AgentSpecialist spec = entry.getValue();
            sb.append("- <name>").append(spec.name()).append("</name> : ")
                    .append(spec.description().replace("\n", " ").strip())
                    .append('\n');
        }
        sb.append("</specialists>\n\n");

        sb.append("<workflow>\n")
                .append("1. Lis la question utilisateur.\n")
                .append("2. Choisis LE specialiste le plus pertinent (1 seul a la fois si possible).\n")
                .append("3. Appelle delegate_to(specialist, query) avec une query precise.\n")
                .append("4. Recois la synthese du specialiste.\n")
                .append("5. Si une autre delegation est necessaire, recommence (max ")
                .append(MAX_DELEGATIONS).append(").\n")
                .append("6. Quand tu as toutes les infos, produis la reponse user finale ")
                .append("(2-4 phrases, conversationnel professionnel).\n")
                .append("</workflow>\n\n");

        sb.append("<output_format>\n")
                .append("- Reponse finale : courte (2-4 phrases), ton conversationnel professionnel.\n")
                .append("- Pas de meta-commentaires (\"j'ai delegue a...\", \"le specialiste m'a dit...\").\n")
                .append("- N'ECRIS JAMAIS la description d'un appel de fonction ni de delegation : ")
                .append("interdit d'ecrire \"The function call...\", \"delegate_to\", \"{name:...}\" ou ")
                .append("tout JSON d'outil. Reponds DIRECTEMENT a l'utilisateur, en langage naturel.\n")
                .append("- Cite la source si l'info vient de la doc (Selon [titre](path)).\n");
        // Directive de langue placee EN DERNIER (poids de recence maximal pour le LLM).
        String lang = (agentContext != null && agentContext.language() != null
                && !agentContext.language().isBlank()) ? agentContext.language() : "fr";
        String langLabel = switch (lang) {
            case "en" -> "English";
            case "ar" -> "Arabic";
            default -> "francais";
        };
        sb.append("- REPONDS IMPERATIVEMENT EN ").append(langLabel.toUpperCase())
                .append(" (la langue de l'utilisateur), quelle que soit la langue des donnees internes.\n");
        sb.append("</output_format>");

        return sb.toString();
    }

    /**
     * Render XML du contexte UI (langue + page + propriete). Vide si pas
     * d'AgentContext ou pas d'info contextuelle (au-dela de la langue par
     * defaut "fr").
     */
    private String renderUserContextSection(AgentContext ctx) {
        if (ctx == null) return "";
        boolean hasUiHint = ctx.currentPage() != null || ctx.selectedPropertyId() != null;
        boolean hasNonDefaultLang = ctx.language() != null && !"fr".equals(ctx.language());
        if (!hasUiHint && !hasNonDefaultLang) return "";

        StringBuilder sb = new StringBuilder(192);
        sb.append("<user_context>\n");
        if (ctx.language() != null && !ctx.language().isBlank()) {
            sb.append("  <language>").append(escapeXml(ctx.language())).append("</language>\n");
            // Hint explicite pour le LLM (le code langue seul ne suffit pas toujours)
            sb.append("  <!-- Reponds en ");
            switch (ctx.language()) {
                case "en" -> sb.append("English");
                case "ar" -> sb.append("Arabic (RTL)");
                case "fr" -> sb.append("francais");
                default -> sb.append("la langue indiquee");
            }
            sb.append(". -->\n");
        }
        if (ctx.currentPage() != null && !ctx.currentPage().isBlank()) {
            sb.append("  <current_page>").append(escapeXml(ctx.currentPage())).append("</current_page>\n");
        }
        if (ctx.selectedPropertyId() != null) {
            sb.append("  <selected_property_id>").append(ctx.selectedPropertyId())
                    .append("</selected_property_id>\n");
            sb.append("  <!-- L'utilisateur regarde cette propriete : si la query est ambigue, ")
                    .append("assume qu'elle concerne cette propriete. -->\n");
        }
        sb.append("</user_context>");
        return sb.toString();
    }

    /** Render XML de la memoire user (vide si rien). */
    private String renderMemorySection(List<AssistantMemory> memories) {
        if (memories == null || memories.isEmpty()) return "";
        StringBuilder sb = new StringBuilder(256);
        sb.append("<memory>\n")
                .append("  <!-- Memoire long-terme de l'utilisateur (preferences, faits, objectifs, projets). ")
                .append("Utilise-la pour personnaliser la query envoyee au specialist. -->\n");
        for (AssistantMemory m : memories) {
            AssistantMemory.Scope scope = m.getScopeEnum();
            sb.append("  <item scope=\"")
                    .append(scope == null ? "unknown" : scope.name().toLowerCase())
                    .append("\" key=\"").append(escapeXml(m.getMemoryKey())).append("\">")
                    .append(escapeXml(m.getMemoryValue()))
                    .append("</item>\n");
        }
        sb.append("</memory>");
        return sb.toString();
    }

    /** Render XML des snippets RAG (vide si rien). */
    private String renderKbSection(List<KbSearchHit> kbHits) {
        if (kbHits == null || kbHits.isEmpty()) return "";
        StringBuilder sb = new StringBuilder(512);
        sb.append("<knowledge_base>\n")
                .append("  <!-- Snippets de la documentation Clenzy lies a la question. ")
                .append("Le specialist doit citer source (titre + path) s'il utilise un extrait. ")
                .append("N'invente JAMAIS une procedure qui n'est pas dans ces snippets. -->\n");
        for (int i = 0; i < kbHits.size(); i++) {
            KbSearchHit h = kbHits.get(i);
            sb.append("  <snippet idx=\"").append(i + 1).append("\" ")
                    .append("title=\"").append(escapeXml(h.title() != null ? h.title() : "Document")).append("\" ")
                    .append("path=\"").append(escapeXml(h.sourcePath())).append("\" ")
                    .append("relevance=\"").append(Math.round(h.relevance() * 100)).append("%\">\n")
                    .append("    ").append(escapeXml(h.snippet())).append("\n")
                    .append("  </snippet>\n");
        }
        sb.append("</knowledge_base>");
        return sb.toString();
    }

    /** Delegate au StringUtils partage pour eviter la divergence avec AbstractAgentSpecialist. */
    private static String escapeXml(String s) {
        return com.clenzy.util.StringUtils.escapeXml(s);
    }

    /** Schema JSON du meta-tool delegate_to. */
    private ToolDescriptor buildDelegateToolDescriptor() {
        try {
            ObjectNode schema = objectMapper.createObjectNode();
            schema.put("type", "object");
            ObjectNode properties = schema.putObject("properties");

            ObjectNode specialistProp = properties.putObject("specialist");
            specialistProp.put("type", "string");
            specialistProp.put("description",
                    "Nom du specialiste a invoquer (voir <specialists> dans le system prompt)");
            // enum dynamique avec les noms enregistres
            specialistProp.putArray("enum")
                    .addAll(registry.all().keySet().stream()
                            .map(objectMapper.getNodeFactory()::textNode)
                            .toList());

            ObjectNode queryProp = properties.putObject("query");
            queryProp.put("type", "string");
            queryProp.put("description",
                    "Query precise a deleguer au specialiste (langage naturel)");

            schema.putArray("required").add("specialist").add("query");
            schema.put("additionalProperties", false);

            return ToolDescriptor.readOnly(
                    DELEGATE_TOOL_NAME,
                    "Delegue la query a un specialiste expert d'un domaine. UTILISE ABSOLUMENT pour repondre aux questions metier.",
                    schema
            );
        } catch (Exception e) {
            throw new IllegalStateException("Failed to build delegate_to descriptor", e);
        }
    }

    /**
     * Emet (best-effort) un event d'activite agent vers la constellation. Un
     * echec du sink ne doit JAMAIS casser l'orchestration → on avale et on logge
     * en debug (l'activite est purement informative).
     */
    private void emitActivity(Consumer<AgentSseEvent> sink, String specialist, String phase,
                              String toolName, String task) {
        if (sink == null) return;
        try {
            sink.accept(AgentSseEvent.agentActivity(specialist, phase, toolName, task));
        } catch (Exception e) {
            log.debug("activitySink emit failed ({} {}): {}", specialist, phase, e.getMessage());
        }
    }

    /**
     * Emet un event {@code acting} par outil reel invoque par le specialist
     * (lus depuis {@link SpecialistResult#toolInvocations()}). Permet a la
     * constellation d'afficher l'agent « en train d'agir » avec le nom de l'outil.
     * Les outils en erreur sont ignores (pas d'action visible).
     */
    private void emitToolActivity(Consumer<AgentSseEvent> sink, String specialist,
                                  SpecialistResult result) {
        if (sink == null || result == null) return;
        for (ToolInvocationSnapshot snap : result.toolInvocations()) {
            if (!snap.isError()) {
                emitActivity(sink, specialist, "acting", snap.toolName(), null);
            }
        }
    }

    /** Args parses du tool delegate_to. */
    private record DelegateArgs(String specialist, String query) {}

    /**
     * Resultat de orchestrate().
     *
     * <p>Les {@code toolInvocations} agrègent les widgets de tous les
     * spécialistes invoqués — l'AgentOrchestrator les émet en SSE comme
     * {@code tool_call_executed} events pour preserver le rendu frontend.</p>
     */
    public record OrchestrationResult(
            String finalText,
            List<String> delegationsLog,
            List<ToolInvocationSnapshot> toolInvocations,
            int totalPromptTokens,
            int totalCompletionTokens,
            boolean truncated,
            String error
    ) {
        public OrchestrationResult {
            delegationsLog = (delegationsLog == null) ? List.of() : List.copyOf(delegationsLog);
            toolInvocations = (toolInvocations == null) ? List.of() : List.copyOf(toolInvocations);
        }

        public static OrchestrationResult success(String text, List<String> log,
                                                    List<ToolInvocationSnapshot> tools,
                                                    int prompt, int completion, int iterations) {
            return new OrchestrationResult(text, log, tools, prompt, completion, false, null);
        }
        public static OrchestrationResult truncated(String text, List<String> log,
                                                      List<ToolInvocationSnapshot> tools,
                                                      int prompt, int completion) {
            return new OrchestrationResult(text, log, tools, prompt, completion, true, null);
        }
        public static OrchestrationResult error(String message) {
            return new OrchestrationResult("", List.of(), List.of(), 0, 0, false, message);
        }
        public boolean isSuccess() {
            return error == null;
        }
    }
}
