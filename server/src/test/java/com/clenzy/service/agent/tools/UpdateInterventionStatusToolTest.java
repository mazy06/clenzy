package com.clenzy.service.agent.tools;

import com.clenzy.dto.InterventionResponse;
import com.clenzy.service.InterventionLifecycleService;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class UpdateInterventionStatusToolTest {

    private InterventionLifecycleService interventionLifecycleService;
    private UpdateInterventionStatusTool tool;
    private ObjectMapper om;
    private AgentContext ctx;

    @BeforeEach
    void setUp() {
        interventionLifecycleService = mock(InterventionLifecycleService.class);
        om = new ObjectMapper();
        tool = new UpdateInterventionStatusTool(interventionLifecycleService, om);
        // jwt null en test (context minimal) — le tool le transmet tel quel au service mocke.
        ctx = AgentContext.minimal(1L, "user-1");
    }

    private ObjectNode validArgs() {
        ObjectNode args = om.createObjectNode();
        args.put("interventionId", 777);
        args.put("status", "IN_PROGRESS");
        return args;
    }

    private InterventionResponse stubResponse(String status) {
        return InterventionResponse.builder()
                .id(777L)
                .title("Menage checkout")
                .propertyName("Loft Bastille")
                .status(status)
                .build();
    }

    @Test
    void name_andDescriptor_requireConfirmation() {
        assertEquals("update_intervention_status", tool.name());
        assertEquals("update_intervention_status", tool.descriptor().name());
        assertTrue(tool.descriptor().requiresConfirmation());
        JsonNode schema = tool.descriptor().jsonSchema();
        String req = schema.path("required").toString();
        assertTrue(req.contains("interventionId"));
        assertTrue(req.contains("status"));
    }

    @Test
    void missingInterventionId_throws() {
        ObjectNode args = om.createObjectNode();
        args.put("status", "IN_PROGRESS");
        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(args, ctx));
        assertTrue(ex.getMessage().toLowerCase().contains("interventionid"));
    }

    @Test
    void missingStatus_throws() {
        ObjectNode args = om.createObjectNode();
        args.put("interventionId", 777);
        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(args, ctx));
        assertTrue(ex.getMessage().toLowerCase().contains("status"));
    }

    @Test
    void happyPath_returnsSummary() throws Exception {
        when(interventionLifecycleService.updateStatus(eq(777L), eq("IN_PROGRESS"), any()))
                .thenReturn(stubResponse("IN_PROGRESS"));

        ToolResult result = tool.execute(validArgs(), ctx);

        assertFalse(result.isError());
        assertEquals("summary", result.displayHint());

        JsonNode payload = om.readTree(result.content());
        assertEquals(777L, payload.path("id").asLong());
        assertEquals("Menage checkout", payload.path("title").asText());
        assertEquals("Loft Bastille", payload.path("propertyName").asText());
        assertEquals("IN_PROGRESS", payload.path("newStatus").asText());
        assertTrue(payload.path("message").asText().contains("IN_PROGRESS"));
    }

    @Test
    void delegatesToService_withInterventionIdStatusAndJwt() {
        when(interventionLifecycleService.updateStatus(eq(777L), eq("IN_PROGRESS"), any()))
                .thenReturn(stubResponse("IN_PROGRESS"));

        tool.execute(validArgs(), ctx);

        // jwt du context (null en test) propage tel quel au service.
        verify(interventionLifecycleService).updateStatus(777L, "IN_PROGRESS", ctx.jwt());
    }

    @Test
    void serviceThrows_wrappedAsToolExecutionException() {
        when(interventionLifecycleService.updateStatus(any(Long.class), any(String.class), any()))
                .thenThrow(new IllegalStateException("Transition invalide : COMPLETED -> IN_PROGRESS"));

        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(validArgs(), ctx));
        assertTrue(ex.getMessage().contains("Transition invalide"));
        assertEquals("update_intervention_status", ex.getToolName());
    }
}
