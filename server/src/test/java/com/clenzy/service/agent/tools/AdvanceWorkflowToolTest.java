package com.clenzy.service.agent.tools;

import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolResult;
import com.clenzy.service.agent.workflow.WorkflowService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class AdvanceWorkflowToolTest {

    private WorkflowService workflowService;
    private AdvanceWorkflowTool tool;
    private ObjectMapper om;
    private AgentContext ctx;

    @BeforeEach
    void setUp() {
        workflowService = mock(WorkflowService.class);
        om = new ObjectMapper();
        tool = new AdvanceWorkflowTool(workflowService, om);
        ctx = AgentContext.minimal(1L, "user-1");
    }

    private static WorkflowService.WorkflowRunSnapshot completedSnapshot() {
        WorkflowService.WorkflowRunSnapshot snap = new WorkflowService.WorkflowRunSnapshot();
        snap.runId = 7L;
        snap.workflowId = "wf";
        snap.status = "COMPLETED";
        snap.currentStepIdx = 1;
        snap.totalSteps = 2;
        snap.suggestedAction = Map.of(
                "toolName", "create_property",
                "collectedData", Map.of("name", "Loft"),
                "reason", "Etape 'confirm' completee");
        return snap;
    }

    @Test
    void descriptor_isReadOnly() {
        assertEquals("advance_workflow", tool.name());
        assertFalse(tool.descriptor().requiresConfirmation());
    }

    @Test
    void execute_passesRunIdAndUserResponse_returnsSnapshot() throws Exception {
        when(workflowService.advanceWorkflow(eq(7L), eq("user-1"), eq("Alice"), eq("fr")))
                .thenReturn(completedSnapshot());

        ObjectNode args = om.createObjectNode();
        args.put("run_id", 7);
        args.put("user_response", "Alice");

        ToolResult result = tool.execute(args, ctx);
        assertFalse(result.isError());
        assertEquals("workflow_step", result.displayHint());

        JsonNode payload = om.readTree(result.content());
        assertEquals("COMPLETED", payload.path("status").asText());
        assertEquals("create_property", payload.path("suggestedAction").path("toolName").asText());
    }

    @Test
    void execute_missingRunId_throws() {
        ObjectNode args = om.createObjectNode();
        args.put("user_response", "x");
        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(args, ctx));
        assertTrue(ex.getMessage().toLowerCase().contains("run_id"));
    }

    @Test
    void execute_missingUserResponse_throws() {
        ObjectNode args = om.createObjectNode();
        args.put("run_id", 7);
        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(args, ctx));
        assertTrue(ex.getMessage().toLowerCase().contains("user_response"));
    }

    @Test
    void execute_unauthorizedOrUnknownRun_throws() {
        when(workflowService.advanceWorkflow(any(), any(), any(), any()))
                .thenThrow(new IllegalArgumentException("Run 999 introuvable"));

        ObjectNode args = om.createObjectNode();
        args.put("run_id", 999);
        args.put("user_response", "x");
        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(args, ctx));
        assertTrue(ex.getMessage().contains("999"));
    }

    @Test
    void execute_alreadyCompletedRun_throws() {
        when(workflowService.advanceWorkflow(any(), any(), any(), any()))
                .thenThrow(new IllegalStateException("Run 5 n'est plus actif (status=COMPLETED)"));

        ObjectNode args = om.createObjectNode();
        args.put("run_id", 5);
        args.put("user_response", "x");
        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(args, ctx));
        assertTrue(ex.getMessage().toLowerCase().contains("plus actif"));
    }
}
