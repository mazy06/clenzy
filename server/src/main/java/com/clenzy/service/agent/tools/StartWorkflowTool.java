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
 * Tool {@code start_workflow} — initialise un nouveau run d'un workflow guide
 * et retourne le premier step.
 *
 * <p>Read-only au sens fonctionnel (cree un run mais n'agit sur aucune ressource
 * metier), pas de confirmation. Le LLM ensuite expose le prompt du step a l'user,
 * recupere la reponse, et appelle {@code advance_workflow}.</p>
 */
@Component
public class StartWorkflowTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(StartWorkflowTool.class);
    private static final String NAME = "start_workflow";

    private final WorkflowService workflowService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public StartWorkflowTool(WorkflowService workflowService, ObjectMapper objectMapper) {
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
        String workflowId = args.path("workflow_id").asText(null);
        if (workflowId == null || workflowId.isBlank()) {
            throw new ToolExecutionException(NAME, "workflow_id est requis");
        }

        try {
            WorkflowService.WorkflowRunSnapshot snapshot = workflowService.startWorkflow(
                    workflowId, context.organizationId(), context.keycloakId(), null,
                    context.language());
            return ToolResult.success(objectMapper.writeValueAsString(snapshot), "workflow_step");
        } catch (IllegalArgumentException e) {
            throw new ToolExecutionException(NAME, e.getMessage(), e);
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize workflow snapshot", e);
        } catch (Exception e) {
            log.warn("start_workflow failed for '{}': {}", workflowId, e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Workflow indisponible (" + e.getMessage() + ")", e);
        }
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "workflow_id": {"type":"string","description":"Id du workflow a demarrer (ex: onboard_property, end_of_month_closing, prepare_high_season)"}
                      },
                      "required": ["workflow_id"],
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.readOnly(
                    NAME,
                    "Demarre un workflow guide multi-etapes, retourne le 1er step. Workflows : onboard_property, end_of_month_closing, prepare_high_season. Pour 'guide-moi pour...'.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
