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

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class StartWorkflowToolTest {

    private WorkflowService workflowService;
    private StartWorkflowTool tool;
    private ObjectMapper om;
    private AgentContext ctx;

    @BeforeEach
    void setUp() {
        workflowService = mock(WorkflowService.class);
        om = new ObjectMapper();
        tool = new StartWorkflowTool(workflowService, om);
        ctx = AgentContext.minimal(1L, "user-1");
    }

    private static WorkflowService.WorkflowRunSnapshot sampleSnapshot() {
        WorkflowService.WorkflowRunSnapshot snap = new WorkflowService.WorkflowRunSnapshot();
        snap.runId = 42L;
        snap.workflowId = "onboard_property";
        snap.title = "Onboarding";
        snap.status = "ACTIVE";
        snap.currentStepIdx = 0;
        snap.totalSteps = 5;
        snap.currentStep = new WorkflowService.StepSnapshot();
        snap.currentStep.id = "basic_info";
        snap.currentStep.prompt = "Donne-moi l'adresse";
        return snap;
    }

    @Test
    void descriptor_isReadOnly() {
        assertEquals("start_workflow", tool.name());
        assertEquals("start_workflow", tool.descriptor().name());
        assertFalse(tool.descriptor().requiresConfirmation());
    }

    @Test
    void execute_buildsPayloadWithWorkflowStepHint() throws Exception {
        when(workflowService.startWorkflow(eq("onboard_property"), eq(1L),
                eq("user-1"), any(), eq("fr"))).thenReturn(sampleSnapshot());

        ObjectNode args = om.createObjectNode();
        args.put("workflow_id", "onboard_property");

        ToolResult result = tool.execute(args, ctx);

        assertFalse(result.isError());
        assertEquals("workflow_step", result.displayHint());

        JsonNode payload = om.readTree(result.content());
        assertEquals(42L, payload.path("runId").asLong());
        assertEquals("onboard_property", payload.path("workflowId").asText());
        assertEquals("ACTIVE", payload.path("status").asText());
        assertEquals("basic_info", payload.path("currentStep").path("id").asText());
    }

    @Test
    void execute_missingWorkflowId_throws() {
        ObjectNode args = om.createObjectNode();
        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(args, ctx));
        assertTrue(ex.getMessage().toLowerCase().contains("workflow_id"));
    }

    @Test
    void execute_unknownWorkflow_propagatesAsToolError() {
        when(workflowService.startWorkflow(any(), any(), any(), any(), any()))
                .thenThrow(new IllegalArgumentException("Workflow inconnu : 'ghost'"));

        ObjectNode args = om.createObjectNode();
        args.put("workflow_id", "ghost");
        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(args, ctx));
        assertTrue(ex.getMessage().contains("ghost"));
    }
}
