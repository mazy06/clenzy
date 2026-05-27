package com.clenzy.service.agent.tools;

import com.clenzy.service.AssistantMemoryService;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ForgetFactToolTest {

    private AssistantMemoryService memoryService;
    private ForgetFactTool tool;
    private ObjectMapper om;
    private AgentContext ctx;

    @BeforeEach
    void setUp() {
        memoryService = mock(AssistantMemoryService.class);
        om = new ObjectMapper();
        tool = new ForgetFactTool(memoryService, om);
        ctx = AgentContext.minimal(1L, "user-123");
    }

    @Test
    void name_andDescriptor_requireConfirmation() {
        assertEquals("forget_fact", tool.name());
        assertEquals("forget_fact", tool.descriptor().name());
        // Suppression : confirmation requise
        assertTrue(tool.descriptor().requiresConfirmation());
    }

    @Test
    void existingKey_isForgotten() throws Exception {
        when(memoryService.forget(eq(1L), eq("user-123"), eq("briefing_time"))).thenReturn(true);

        ObjectNode args = om.createObjectNode();
        args.put("key", "briefing_time");

        ToolResult result = tool.execute(args, ctx);

        assertFalse(result.isError());
        assertEquals("summary", result.displayHint());

        JsonNode payload = om.readTree(result.content());
        assertEquals("briefing_time", payload.path("key").asText());
        assertTrue(payload.path("forgotten").asBoolean());
        assertTrue(payload.path("message").asText().toLowerCase().contains("effacee"));
    }

    @Test
    void unknownKey_returnsForgottenFalse_butNotError() throws Exception {
        when(memoryService.forget(any(), any(), any())).thenReturn(false);

        ObjectNode args = om.createObjectNode();
        args.put("key", "ghost_key");

        ToolResult result = tool.execute(args, ctx);

        assertFalse(result.isError(),
                "Une cle inconnue ne doit pas casser le tool — le LLM doit pouvoir l'expliquer");
        JsonNode payload = om.readTree(result.content());
        assertFalse(payload.path("forgotten").asBoolean());
        assertTrue(payload.path("message").asText().toLowerCase().contains("aucune"));
    }

    @Test
    void missingKey_throws() {
        ObjectNode args = om.createObjectNode();

        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(args, ctx));
        assertTrue(ex.getMessage().toLowerCase().contains("key"));
        verifyNoInteractions(memoryService);
    }

    @Test
    void blankKey_throws() {
        ObjectNode args = om.createObjectNode();
        args.put("key", "   ");

        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(args, ctx));
        assertTrue(ex.getMessage().toLowerCase().contains("key"));
    }
}
