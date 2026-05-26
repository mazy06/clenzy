package com.clenzy.service.agent.workflow;

/**
 * Exception levee quand la reponse utilisateur ne respecte pas le contrat
 * {@code expectsData} du step en cours.
 *
 * <p>L'orchestrateur la propage au tool (AdvanceWorkflowTool) qui la traduit
 * en {@code ToolExecutionException} avec un message clair pour le LLM. Le LLM
 * peut alors re-prompter l'utilisateur avec les details d'erreur.</p>
 */
public class WorkflowValidationException extends RuntimeException {

    private final String stepId;

    public WorkflowValidationException(String stepId, String message) {
        super(message);
        this.stepId = stepId;
    }

    public String getStepId() {
        return stepId;
    }
}
