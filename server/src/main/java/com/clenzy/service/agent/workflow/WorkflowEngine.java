package com.clenzy.service.agent.workflow;

import com.clenzy.model.AssistantWorkflowRun;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Moteur fonctionnel d'execution des workflows.
 *
 * <p>Le moteur est <b>sans etat</b> (aucun champ mutable) : il opere sur un
 * {@link AssistantWorkflowRun} fourni en entree et retourne le nouvel etat
 * sans persister. La persistance est faite par le {@link WorkflowService}.</p>
 *
 * <p>Operations exposees :
 * <ul>
 *   <li>{@link #collectData} : merge la reponse de l'user dans collected_data au step courant</li>
 *   <li>{@link #advanceStep} : incremente l'index ou marque COMPLETED si on est au dernier step</li>
 *   <li>{@link #renderPrompt} : interpole les variables {{summary}}/{{collectedData}} dans le prompt</li>
 *   <li>{@link #executeStepAction} : retourne la suggestion d'action structuree pour le LLM</li>
 * </ul>
 */
@Component
public class WorkflowEngine {

    private static final Logger log = LoggerFactory.getLogger(WorkflowEngine.class);

    /** Code langue par defaut quand l'AgentContext n'en fournit pas. */
    public static final String DEFAULT_LANGUAGE = "fr";

    private final ObjectMapper objectMapper;
    private final WorkflowValidator validator;

    public WorkflowEngine(ObjectMapper objectMapper, WorkflowValidator validator) {
        this.objectMapper = objectMapper;
        this.validator = validator;
    }

    /**
     * Merge la reponse utilisateur dans le {@code collected_data} du run sous
     * la cle du step courant. Mutation in-place du run.
     *
     * <p>La reponse est d'abord validee contre le contrat {@code expectsData}
     * via {@link WorkflowValidator}. Si la validation echoue, une
     * {@link WorkflowValidationException} est propagee — le caller decide quoi
     * en faire (typiquement re-prompter le user via le LLM).</p>
     *
     * @param run         run actif
     * @param definition  workflow correspondant
     * @param userResponse reponse texte de l'utilisateur (peut etre null/blank)
     * @throws WorkflowValidationException si la reponse viole le contrat declare
     */
    public void collectData(AssistantWorkflowRun run, WorkflowDefinition definition,
                              String userResponse) {
        if (run == null || definition == null) return;
        if (userResponse == null || userResponse.isBlank()) return;
        WorkflowDefinition.Step current = currentStep(run, definition);
        if (current == null) return;

        // Validation stricte : si OK on continue, sinon on throw
        validator.validate(current, userResponse);

        ObjectNode all = parseCollectedSafe(run.getCollectedData());
        all.put(current.id, userResponse);
        try {
            run.setCollectedData(objectMapper.writeValueAsString(all));
        } catch (JsonProcessingException e) {
            log.warn("collectData: serialization failed run={}, keeping previous state", run.getId());
        }
    }

    /**
     * Avance d'un step. Si on est au dernier, marque le run COMPLETED et
     * met {@code completedAt}. Retourne l'index courant apres avancement.
     */
    public int advanceStep(AssistantWorkflowRun run, WorkflowDefinition definition) {
        if (run == null || definition == null) {
            throw new IllegalArgumentException("run et definition sont requis");
        }
        if (run.getStatusEnum() != AssistantWorkflowRun.Status.ACTIVE) {
            // Idempotent : pas d'effet si deja COMPLETED/ABANDONED
            return run.getCurrentStepIdx();
        }
        int total = definition.steps.size();
        int next = run.getCurrentStepIdx() + 1;
        if (next >= total) {
            run.setStatusEnum(AssistantWorkflowRun.Status.COMPLETED);
            run.setCompletedAt(java.time.LocalDateTime.now());
            return run.getCurrentStepIdx();
        }
        run.setCurrentStepIdx(next);
        return next;
    }

    /**
     * Interpole les variables connues dans le prompt du step (langue par defaut).
     * Equivaut a {@link #renderPrompt(WorkflowDefinition.Step, AssistantWorkflowRun, String)}
     * avec {@link #DEFAULT_LANGUAGE}.
     */
    public String renderPrompt(WorkflowDefinition.Step step, AssistantWorkflowRun run) {
        return renderPrompt(step, run, DEFAULT_LANGUAGE);
    }

    /**
     * Interpole les variables connues dans le prompt du step pour la langue
     * demandee.
     *
     * <h3>Resolution multilingue</h3>
     * <ol>
     *   <li>{@code step.prompts[language]} si present</li>
     *   <li>{@code step.prompts["fr"]} (langue par defaut Clenzy)</li>
     *   <li>{@code step.prompt} (legacy)</li>
     * </ol>
     *
     * <h3>Interpolation</h3>
     * <ul>
     *   <li>{@code &#123;&#123;summary&#125;&#125;} → liste markdown des donnees collectees</li>
     *   <li>{@code &#123;&#123;collectedData&#125;&#125;} → dump JSON pretty</li>
     * </ul>
     * Les autres patterns sont laisses tels quels.
     */
    public String renderPrompt(WorkflowDefinition.Step step, AssistantWorkflowRun run,
                                 String language) {
        if (step == null) return "";
        String template = resolvePromptTemplate(step, language);
        if (template == null) return "";
        String prompt = template;
        if (prompt.contains("{{summary}}")) {
            prompt = prompt.replace("{{summary}}", buildSummary(run));
        }
        if (prompt.contains("{{collectedData}}")) {
            prompt = prompt.replace("{{collectedData}}", buildJsonDump(run));
        }
        return prompt;
    }

    /**
     * Choisit le template selon la langue demandee, avec fallback en cascade.
     * Visible aux tests pour valider le fallback isolement.
     */
    String resolvePromptTemplate(WorkflowDefinition.Step step, String language) {
        if (step == null) return null;
        String lang = (language == null || language.isBlank())
                ? DEFAULT_LANGUAGE
                : language.trim().toLowerCase(java.util.Locale.ROOT);
        if (step.prompts != null && !step.prompts.isEmpty()) {
            String byLang = step.prompts.get(lang);
            if (byLang != null && !byLang.isBlank()) return byLang;
            String fallback = step.prompts.get(DEFAULT_LANGUAGE);
            if (fallback != null && !fallback.isBlank()) return fallback;
        }
        return step.prompt;
    }

    /**
     * Construit la suggestion d'action (langue par defaut FR). Cf.
     * {@link #executeStepAction(WorkflowDefinition.Step, AssistantWorkflowRun, String)}.
     */
    public Map<String, Object> executeStepAction(WorkflowDefinition.Step step,
                                                   AssistantWorkflowRun run) {
        return executeStepAction(step, run, DEFAULT_LANGUAGE);
    }

    /**
     * Construit la suggestion d'action structuree retournee au LLM apres
     * completion d'un step qui declare {@code action: foo}. Le LLM est libre
     * de l'invoquer ou non — il peut demander une derniere confirmation a
     * l'user d'abord. La {@code reason} est localisee si la langue est
     * supportee, sinon fallback FR.
     */
    public Map<String, Object> executeStepAction(WorkflowDefinition.Step step,
                                                   AssistantWorkflowRun run,
                                                   String language) {
        if (step == null || step.action == null || step.action.isBlank()) {
            return Map.of();
        }
        Map<String, Object> suggestion = new LinkedHashMap<>();
        suggestion.put("toolName", step.action);
        suggestion.put("collectedData", parseCollectedSafe(run.getCollectedData()));
        suggestion.put("reason", localizedActionReason(step.id, language));
        return suggestion;
    }

    /** Localise le message expose au LLM en fin de step avec action. */
    private static String localizedActionReason(String stepId, String language) {
        String lang = (language == null || language.isBlank())
                ? DEFAULT_LANGUAGE
                : language.trim().toLowerCase(java.util.Locale.ROOT);
        return switch (lang) {
            case "en" -> "Step '" + stepId + "' completed — invoke this tool with the collected data.";
            case "ar" -> "اكتملت الخطوة '" + stepId + "' — استدع هذه الأداة بالبيانات المجمعة.";
            default -> "Etape '" + stepId + "' completee — invoque ce tool avec les donnees collectees.";
        };
    }

    /** Step courant du run ou null si l'index est hors limite. */
    public WorkflowDefinition.Step currentStep(AssistantWorkflowRun run,
                                                  WorkflowDefinition definition) {
        if (run == null || definition == null || definition.steps == null) return null;
        int idx = run.getCurrentStepIdx();
        if (idx < 0 || idx >= definition.steps.size()) return null;
        return definition.steps.get(idx);
    }

    // ─── Helpers ────────────────────────────────────────────────────────────

    private ObjectNode parseCollectedSafe(String json) {
        if (json == null || json.isBlank()) return objectMapper.createObjectNode();
        try {
            JsonNode node = objectMapper.readTree(json);
            if (node instanceof ObjectNode obj) return obj;
        } catch (Exception e) {
            log.debug("parseCollectedSafe: invalid json, falling back to empty");
        }
        return objectMapper.createObjectNode();
    }

    private String buildSummary(AssistantWorkflowRun run) {
        ObjectNode collected = parseCollectedSafe(run.getCollectedData());
        if (!collected.fields().hasNext()) {
            return "_aucune donnee collectee_";
        }
        StringBuilder sb = new StringBuilder();
        collected.fields().forEachRemaining(entry -> {
            sb.append("- **").append(entry.getKey()).append("** : ")
                    .append(stringify(entry.getValue())).append('\n');
        });
        return sb.toString().trim();
    }

    private String buildJsonDump(AssistantWorkflowRun run) {
        try {
            return objectMapper.writerWithDefaultPrettyPrinter()
                    .writeValueAsString(parseCollectedSafe(run.getCollectedData()));
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }

    private static String stringify(JsonNode node) {
        if (node == null || node.isNull()) return "(vide)";
        if (node.isTextual()) return node.asText();
        if (node.isNumber() || node.isBoolean()) return node.asText();
        return node.toString();
    }
}
