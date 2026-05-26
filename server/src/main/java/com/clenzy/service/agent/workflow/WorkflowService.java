package com.clenzy.service.agent.workflow;

import com.clenzy.model.AssistantWorkflowRun;
import com.clenzy.repository.AssistantWorkflowRunRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * Orchestration des workflows : creation d'un run, transitions entre etapes,
 * persistance en BDD. Les operations purement logiques sont deleguees au
 * {@link WorkflowEngine} (sans etat, plus facile a tester).
 *
 * <p>Le service garantit que :
 * <ul>
 *   <li>Tout {@code run} retourne appartient a l'user (ownership filter).</li>
 *   <li>Les transitions sont atomiques (transaction unique).</li>
 *   <li>Les workflow IDs invalides remontent une {@link IllegalArgumentException}.</li>
 * </ul>
 */
@Service
@Transactional
public class WorkflowService {

    private static final Logger log = LoggerFactory.getLogger(WorkflowService.class);

    private final WorkflowRegistry registry;
    private final WorkflowEngine engine;
    private final AssistantWorkflowRunRepository repository;

    public WorkflowService(WorkflowRegistry registry,
                            WorkflowEngine engine,
                            AssistantWorkflowRunRepository repository) {
        this.registry = registry;
        this.engine = engine;
        this.repository = repository;
    }

    /** Liste les workflows disponibles (read-only). */
    @Transactional(readOnly = true)
    public List<WorkflowDefinition> listWorkflows() {
        return registry.listAll();
    }

    /**
     * Cree un nouveau run pour le workflow demande et retourne l'etat initial
     * (step 0).
     *
     * @throws IllegalArgumentException si le workflow_id n'existe pas
     */
    public WorkflowRunSnapshot startWorkflow(String workflowId, Long organizationId,
                                              String keycloakId, Long conversationId) {
        return startWorkflow(workflowId, organizationId, keycloakId, conversationId,
                WorkflowEngine.DEFAULT_LANGUAGE);
    }

    /** Variante multilingue — le prompt initial sera rendu dans la langue demandee. */
    public WorkflowRunSnapshot startWorkflow(String workflowId, Long organizationId,
                                              String keycloakId, Long conversationId,
                                              String language) {
        WorkflowDefinition def = registry.getById(workflowId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Workflow inconnu : '" + workflowId + "'"));

        AssistantWorkflowRun run = new AssistantWorkflowRun(
                organizationId, keycloakId, conversationId, workflowId);
        run = repository.save(run);

        log.info("startWorkflow: run={} workflow='{}' user={} lang={}",
                run.getId(), workflowId, keycloakId, language);
        return buildSnapshot(run, def, language);
    }

    /**
     * Avance le run : stocke la reponse de l'user au step courant, puis incremente
     * l'index. Si on etait au dernier step et qu'il declare une {@code action},
     * la suggestion d'action est portee dans le snapshot retourne.
     *
     * @throws IllegalArgumentException si le run n'existe pas ou n'appartient pas a l'user
     * @throws IllegalStateException    si le run n'est plus ACTIVE
     */
    public WorkflowRunSnapshot advanceWorkflow(Long runId, String keycloakId, String userResponse) {
        return advanceWorkflow(runId, keycloakId, userResponse, WorkflowEngine.DEFAULT_LANGUAGE);
    }

    /** Variante multilingue — le prompt du step suivant sera rendu dans la langue demandee. */
    public WorkflowRunSnapshot advanceWorkflow(Long runId, String keycloakId,
                                                  String userResponse, String language) {
        // Garde-fou centralise : une reponse blank ne doit jamais avancer un run
        // silencieusement (sinon le step en cours est skippe sans donnees). Cette
        // verification etait jusqu'ici uniquement dans AdvanceWorkflowTool ; on
        // la deplace ici pour proteger TOUS les callers (tests, futurs endpoints).
        if (userResponse == null || userResponse.isBlank()) {
            throw new IllegalArgumentException(
                    "userResponse est requis pour avancer le run " + runId);
        }

        AssistantWorkflowRun run = repository.findByIdAndUser(runId, keycloakId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Run " + runId + " introuvable ou non autorise"));
        if (run.getStatusEnum() != AssistantWorkflowRun.Status.ACTIVE) {
            throw new IllegalStateException(
                    "Run " + runId + " n'est plus actif (status=" + run.getStatus() + ")");
        }
        WorkflowDefinition def = registry.getById(run.getWorkflowId())
                .orElseThrow(() -> new IllegalStateException(
                        "Definition '" + run.getWorkflowId() + "' introuvable pour run " + runId));

        // Defense en profondeur : si le YAML a ete tronque entre start et advance,
        // l'index courant peut etre hors limite. On detecte avant de toucher au run.
        if (run.getCurrentStepIdx() >= def.steps.size()) {
            throw new IllegalStateException(
                    "Run " + runId + " pointe sur step " + run.getCurrentStepIdx()
                            + " mais le workflow '" + def.id + "' n'a que "
                            + def.steps.size() + " steps (definition mise a jour ?). "
                            + "Annule ce run et relance-le.");
        }

        // 1. Capture le step courant AVANT avancement (pour declenchement action)
        WorkflowDefinition.Step previousStep = engine.currentStep(run, def);

        // 2. Stocke la reponse user (peut throw WorkflowValidationException — propagee)
        engine.collectData(run, def, userResponse);

        // 3. Avance d'un step
        engine.advanceStep(run, def);

        // 4. Save — si conflict optimiste (double-submit), Hibernate throw
        //    OptimisticLockingFailureException qu'on traduit en message clair.
        AssistantWorkflowRun saved;
        try {
            saved = repository.save(run);
        } catch (org.springframework.dao.OptimisticLockingFailureException e) {
            throw new IllegalStateException(
                    "Run " + runId + " a deja ete avance par une autre requete (conflit "
                            + "optimiste). Rafraichis l'etat avant de retenter.", e);
        }

        WorkflowRunSnapshot snapshot = buildSnapshot(saved, def, language);
        if (previousStep != null
                && previousStep.action != null && !previousStep.action.isBlank()) {
            snapshot.suggestedAction = engine.executeStepAction(previousStep, saved, language);
        }
        return snapshot;
    }

    /**
     * Marque un run actif comme ABANDONED. Idempotent : si le run est deja
     * cloture, ne fait rien.
     */
    public void abandonWorkflow(Long runId, String keycloakId) {
        Optional<AssistantWorkflowRun> opt = repository.findByIdAndUser(runId, keycloakId);
        if (opt.isEmpty()) return;
        AssistantWorkflowRun run = opt.get();
        if (run.getStatusEnum() != AssistantWorkflowRun.Status.ACTIVE) return;
        run.setStatusEnum(AssistantWorkflowRun.Status.ABANDONED);
        run.setCompletedAt(java.time.LocalDateTime.now());
        repository.save(run);
    }

    /** Construit un snapshot serialisable pour le LLM/frontend. */
    private WorkflowRunSnapshot buildSnapshot(AssistantWorkflowRun run, WorkflowDefinition def,
                                                String language) {
        WorkflowRunSnapshot snapshot = new WorkflowRunSnapshot();
        snapshot.runId = run.getId();
        snapshot.workflowId = def.id;
        snapshot.title = def.title;
        snapshot.description = def.description;
        snapshot.estimatedDuration = def.estimatedDuration;
        snapshot.totalSteps = def.steps.size();
        snapshot.currentStepIdx = run.getCurrentStepIdx();
        snapshot.status = run.getStatusEnum() == null
                ? AssistantWorkflowRun.Status.ACTIVE.name()
                : run.getStatusEnum().name();
        snapshot.collectedDataJson = run.getCollectedData();

        // Step courant ou null si COMPLETED
        WorkflowDefinition.Step currentStep = engine.currentStep(run, def);
        if (currentStep != null
                && run.getStatusEnum() == AssistantWorkflowRun.Status.ACTIVE) {
            snapshot.currentStep = new StepSnapshot();
            snapshot.currentStep.id = currentStep.id;
            snapshot.currentStep.title = currentStep.title;
            snapshot.currentStep.prompt = engine.renderPrompt(currentStep, run, language);
            snapshot.currentStep.expectsData = currentStep.expectsData;
            snapshot.currentStep.suggestTool = currentStep.suggestTool;
        }
        snapshot.steps = def.steps;
        return snapshot;
    }

    // ─── DTOs exposes par le service ────────────────────────────────────────

    /**
     * Photographie d'un run a un instant T. Sert de payload pour les tools
     * {@code start_workflow} et {@code advance_workflow}.
     */
    public static class WorkflowRunSnapshot {
        public Long runId;
        public String workflowId;
        public String title;
        public String description;
        public Integer estimatedDuration;
        public int totalSteps;
        public int currentStepIdx;
        public String status;
        public StepSnapshot currentStep;
        /** JSON brut des donnees collectees (peut etre null). */
        public String collectedDataJson;
        /** Liste complete des steps (pour le stepper visuel cote frontend). */
        public List<WorkflowDefinition.Step> steps;
        /** Suggestion d'action en fin d'etape (null si pas d'action sur le step precedent). */
        public java.util.Map<String, Object> suggestedAction;
    }

    public static class StepSnapshot {
        public String id;
        public String title;
        /** Prompt rendu (apres interpolation des variables). */
        public String prompt;
        public java.util.Map<String, Object> expectsData;
        public WorkflowDefinition.ToolReference suggestTool;
    }
}
