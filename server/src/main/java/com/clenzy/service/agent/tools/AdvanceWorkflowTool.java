package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolHandler;
import com.clenzy.service.agent.ToolResult;
import com.clenzy.service.agent.workflow.WorkflowService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Tool {@code advance_workflow} — stocke la reponse utilisateur au step courant
 * d'un run et avance d'une etape.
 *
 * <p>Si on etait sur le dernier step et qu'il declare une action ({@code action:
 * tool_name}), le payload retourne contient une {@code suggestedAction} pour
 * que le LLM enchaine l'invocation du tool indique.</p>
 */
@Component
public class AdvanceWorkflowTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(AdvanceWorkflowTool.class);
    private static final String NAME = "advance_workflow";

    private final WorkflowService workflowService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public AdvanceWorkflowTool(WorkflowService workflowService, ObjectMapper objectMapper) {
        this.workflowService = workflowService;
        this.objectMapper = objectMapper;
        this.descriptor = buildDescriptor(objectMapper);
    }

    @Override
    public String name() {
        return NAME;
    }

    @Override
    public ToolDescriptor descriptor() {
        return descriptor;
    }

    @Override
    public ToolResult execute(JsonNode args, AgentContext context) {
        if (!args.has("run_id") || args.path("run_id").isNull()) {
            throw new ToolExecutionException(NAME, "run_id est requis");
        }
        Long runId = args.path("run_id").asLong();
        String userResponse = args.path("user_response").asText(null);
        if (userResponse == null || userResponse.isBlank()) {
            throw new ToolExecutionException(NAME, "user_response est requis");
        }

        try {
            WorkflowService.WorkflowRunSnapshot snapshot = workflowService.advanceWorkflow(
                    runId, context.keycloakId(), userResponse);
            return ToolResult.success(objectMapper.writeValueAsString(snapshot), "workflow_step");
        } catch (IllegalArgumentException | IllegalStateException e) {
            throw new ToolExecutionException(NAME, e.getMessage(), e);
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize workflow snapshot", e);
        } catch (Exception e) {
            log.warn("advance_workflow failed for run {}: {}", runId, e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Avancement impossible (" + e.getMessage() + ")", e);
        }
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "run_id":        {"type":"integer","description":"Id du run en cours (retourne par start_workflow)"},
                        "user_response": {"type":"string","description":"Reponse textuelle de l'user au prompt du step courant. Reproduis aussi fidelement que possible ce que l'user a dit, sans l'interpreter."}
                      },
                      "required": ["run_id","user_response"],
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.readOnly(
                    NAME,
                    "Avance un workflow en cours : stocke la reponse de l'user au step courant et retourne le step suivant (ou le statut COMPLETED). Si le step venant d'etre complete declare une action, le payload inclut une suggestedAction que tu peux invoquer ensuite.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
