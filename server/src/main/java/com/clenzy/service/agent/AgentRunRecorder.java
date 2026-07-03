package com.clenzy.service.agent;

import com.clenzy.model.AgentRun;
import com.clenzy.model.AgentStep;
import com.clenzy.repository.AgentRunRepository;
import com.clenzy.repository.AgentStepRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.UUID;
import java.util.concurrent.Executor;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Enregistreur d'etat de run (campagne T-05, ADR-002) : persiste
 * {@link AgentRun}/{@link AgentStep} pour le replay Constellation et le futur
 * ledger de credits (T-06).
 *
 * <p><b>Best-effort, hors chemin critique</b> : toutes les ecritures partent
 * sur un executor dedie mono-thread a file bornee ({@code DiscardPolicy} en
 * surcharge — perdre une ligne de trace vaut mieux que ralentir un run) ; tout
 * echec est avale + logue debug. Le chemin SSE n'attend JAMAIS une ecriture.</p>
 *
 * <p><b>Portee du run</b> : ThreadLocal — le flux d'un run (orchestrateur,
 * specialists, boucle mono) s'execute dans le thread appelant (contrat
 * {@code ChatLLMProvider.streamChat} : streaming bloquant dans le thread).
 * {@code startRun}/{@code finishRun} DOIVENT s'apparier en try/finally chez
 * l'appelant ({@code AgentOrchestrator}). Sans run actif, toutes les methodes
 * de step sont des no-ops silencieux (composants instrumentes utilisables
 * hors run : briefings/batch non couverts en T-05).</p>
 */
@Component
public class AgentRunRecorder {

    private static final Logger log = LoggerFactory.getLogger(AgentRunRecorder.class);

    /** Etat du run actif du thread courant. */
    private static final class ActiveRun {
        final UUID runId;
        final AtomicInteger seq = new AtomicInteger(0);
        /** Sequence dediee au metering credits (T-06) — decorrelee des steps de trace. */
        final AtomicInteger meterSeq = new AtomicInteger(0);
        volatile boolean paused;

        ActiveRun(UUID runId) {
            this.runId = runId;
        }
    }

    private final ThreadLocal<ActiveRun> current = new ThreadLocal<>();

    private final AgentRunRepository runRepository;
    private final AgentStepRepository stepRepository;
    private final Executor writer;

    // @Autowired OBLIGATOIRE : la classe a 2 constructeurs (celui de test
    // ci-dessous) — sans l'annotation, Spring cherche un constructeur no-arg
    // inexistant et le boot echoue (constate au 1er boot reel du 2026-07-02,
    // invisible en mvn package qui ne monte pas le contexte complet).
    @org.springframework.beans.factory.annotation.Autowired
    public AgentRunRecorder(AgentRunRepository runRepository, AgentStepRepository stepRepository) {
        this(runRepository, stepRepository, defaultWriter());
    }

    /** Constructeur test : executor synchrone injectable (Runnable::run). */
    AgentRunRecorder(AgentRunRepository runRepository, AgentStepRepository stepRepository,
                     Executor writer) {
        this.runRepository = runRepository;
        this.stepRepository = stepRepository;
        this.writer = writer;
    }

    /** Mono-thread, file bornee 512, surcharge = drop silencieux (trace best-effort). */
    private static Executor defaultWriter() {
        return new ThreadPoolExecutor(1, 1, 60, TimeUnit.SECONDS,
                new LinkedBlockingQueue<>(512),
                r -> {
                    Thread t = new Thread(r, "agent-run-recorder");
                    t.setDaemon(true);
                    return t;
                },
                new ThreadPoolExecutor.DiscardPolicy());
    }

    /**
     * Demarre un run et l'attache au thread courant. Retourne le runId (connu
     * immediatement → emis en SSE sans attendre l'insert async).
     */
    public UUID startRun(Long organizationId, String keycloakUserId,
                         Long conversationId, String origin) {
        return startRun(organizationId, keycloakUserId, conversationId, origin, null);
    }

    /**
     * Variante avec la question utilisateur d'origine (L3, what-if replay) —
     * tronquee a 500 chars. Null OK (reprise, run autonome).
     */
    public UUID startRun(Long organizationId, String keycloakUserId,
                         Long conversationId, String origin, String userQuery) {
        UUID runId = UUID.randomUUID();
        current.set(new ActiveRun(runId));
        String truncatedQuery = userQuery == null ? null
                : (userQuery.length() <= 500 ? userQuery : userQuery.substring(0, 500));
        submit(() -> {
            AgentRun run = new AgentRun(runId, organizationId, keycloakUserId, conversationId, origin);
            run.setUserQuery(truncatedQuery);
            runRepository.save(run);
        });
        return runId;
    }

    /** Appel LLM (tour de boucle mono, synthese multi...). */
    public void recordLlmStep(String agent, String model, int promptTokens,
                              int completionTokens, int cachedPromptTokens, String finishReason) {
        step(AgentStep.KIND_LLM_CALL, agent, null, finishReason, AgentStep.STATUS_SUCCESS,
                model, promptTokens, completionTokens, cachedPromptTokens);
    }

    /** Execution d'un outil. PAS d'arguments dans detail (PII → audit masque). */
    public void recordToolStep(String agent, String toolName, boolean success) {
        step(AgentStep.KIND_TOOL_CALL, agent, toolName, null,
                success ? AgentStep.STATUS_SUCCESS : AgentStep.STATUS_ERROR,
                null, 0, 0, 0);
    }

    /** Delegation orchestrateur → specialist (tokens du specialist inclus). */
    public void recordDelegationStep(String specialistName, String querySummary,
                                     int promptTokens, int completionTokens, boolean success) {
        step(AgentStep.KIND_DELEGATION, "specialist:" + specialistName, null, querySummary,
                success ? AgentStep.STATUS_SUCCESS : AgentStep.STATUS_ERROR,
                null, promptTokens, completionTokens, 0);
    }

    /** Pause HITL (tool en attente de confirmation). Le run finira PAUSED. */
    public void recordPause(String agent, String toolName) {
        ActiveRun run = current.get();
        if (run != null) {
            run.paused = true;
        }
        step(AgentStep.KIND_PAUSE, agent, toolName, "attente confirmation utilisateur",
                AgentStep.STATUS_SUCCESS, null, 0, 0, 0);
    }

    /** Synthese de fin de tour multi-agent (totaux agreges). */
    public void recordSummaryStep(String agent, String model, int promptTokens,
                                  int completionTokens, String detail) {
        step(AgentStep.KIND_SUMMARY, agent, null, detail, AgentStep.STATUS_SUCCESS,
                model, promptTokens, completionTokens, 0);
    }

    /**
     * Clot le run du thread courant et detache le ThreadLocal (a appeler en
     * finally). Statut : ERROR si {@code error} non null, PAUSED si une pause
     * HITL a ete enregistree, COMPLETED sinon.
     */
    public void finishRun(String error) {
        ActiveRun run = current.get();
        if (run == null) {
            return;
        }
        current.remove();
        String status = error != null ? AgentRun.STATUS_ERROR
                : run.paused ? AgentRun.STATUS_PAUSED
                : AgentRun.STATUS_COMPLETED;
        UUID runId = run.runId;
        submit(() -> runRepository.findById(runId).ifPresent(r -> {
            r.finish(status, error);
            runRepository.save(r);
        }));
    }

    /** RunId actif du thread courant (null hors run) — pour l'emission SSE. */
    public UUID currentRunId() {
        ActiveRun run = current.get();
        return run != null ? run.runId : null;
    }

    /**
     * Prochaine sequence de metering credits du run courant (T-06) — sert de
     * composant de la cle d'idempotence du ledger ({@code runId:meter:N}).
     * -1 hors run actif.
     */
    public int nextMeterSeq() {
        ActiveRun run = current.get();
        return run != null ? run.meterSeq.incrementAndGet() : -1;
    }

    private void step(String kind, String agent, String toolName, String detail, String status,
                      String model, int promptTokens, int completionTokens, int cachedPromptTokens) {
        ActiveRun run = current.get();
        if (run == null) {
            return;
        }
        UUID runId = run.runId;
        int seq = run.seq.incrementAndGet();
        submit(() -> stepRepository.save(new AgentStep(runId, seq, kind, agent, toolName,
                detail, status, model, promptTokens, completionTokens, cachedPromptTokens)));
    }

    private void submit(Runnable write) {
        try {
            writer.execute(() -> {
                try {
                    write.run();
                } catch (Exception e) {
                    log.debug("agent_run trace write failed (best-effort) : {}", e.getMessage());
                }
            });
        } catch (Exception e) {
            log.debug("agent_run trace submit failed (best-effort) : {}", e.getMessage());
        }
    }
}
