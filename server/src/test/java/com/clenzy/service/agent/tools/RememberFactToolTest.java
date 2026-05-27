package com.clenzy.service.agent.tools;

import com.clenzy.model.AssistantMemory;
import com.clenzy.service.AssistantMemoryService;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class RememberFactToolTest {

    private AssistantMemoryService memoryService;
    private RememberFactTool tool;
    private ObjectMapper om;
    private AgentContext ctx;

    @BeforeEach
    void setUp() {
        memoryService = mock(AssistantMemoryService.class);
        om = new ObjectMapper();
        tool = new RememberFactTool(memoryService, om);
        ctx = AgentContext.minimal(1L, "user-123");
    }

    @Test
    void name_andDescriptor_areConsistent() {
        assertEquals("remember_fact", tool.name());
        assertEquals("remember_fact", tool.descriptor().name());
        // Low-risk write : pas de confirmation utilisateur
        assertFalse(tool.descriptor().requiresConfirmation());
    }

    @Test
    void upsert_persistsViaService_andReturnsSummary() throws Exception {
        AssistantMemory persisted = new AssistantMemory(1L, "user-123",
                "briefing_time", "08:00", AssistantMemory.Scope.PREFERENCE);
        when(memoryService.upsert(any(), any(), any(), any(), any())).thenReturn(persisted);

        ObjectNode args = om.createObjectNode();
        args.put("key", "briefing_time");
        args.put("value", "08:00");
        args.put("scope", "preference");

        ToolResult result = tool.execute(args, ctx);

        assertFalse(result.isError());
        assertEquals("summary", result.displayHint());

        ArgumentCaptor<String> keyCap = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> valueCap = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<AssistantMemory.Scope> scopeCap =
                ArgumentCaptor.forClass(AssistantMemory.Scope.class);
        verify(memoryService).upsert(eq(1L), eq("user-123"),
                keyCap.capture(), valueCap.capture(), scopeCap.capture());
        assertEquals("briefing_time", keyCap.getValue());
        assertEquals("08:00", valueCap.getValue());
        assertEquals(AssistantMemory.Scope.PREFERENCE, scopeCap.getValue());

        JsonNode payload = om.readTree(result.content());
        assertEquals("remembered", payload.path("status").asText());
        assertEquals("briefing_time", payload.path("key").asText());
        assertEquals("preference", payload.path("scope").asText());
        assertTrue(payload.path("message").asText().contains("briefing_time"));
    }

    @Test
    void allFourScopes_areAccepted() {
        when(memoryService.upsert(any(), any(), any(), any(), any())).thenAnswer(inv ->
                new AssistantMemory(1L, "user-123",
                        inv.getArgument(2, String.class),
                        inv.getArgument(3, String.class),
                        inv.getArgument(4, AssistantMemory.Scope.class)));

        for (String raw : new String[]{"preference", "fact", "goal", "project"}) {
            ObjectNode args = om.createObjectNode();
            args.put("key", "k_" + raw);
            args.put("value", "v");
            args.put("scope", raw);

            ToolResult result = tool.execute(args, ctx);
            assertFalse(result.isError(), "Scope '" + raw + "' devrait etre accepte");
        }

        verify(memoryService, times(4)).upsert(any(), any(), any(), any(), any());
    }

    @Test
    void invalidScope_throwsToolExecutionException() {
        ObjectNode args = om.createObjectNode();
        args.put("key", "x");
        args.put("value", "y");
        args.put("scope", "not-a-scope");

        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(args, ctx));
        assertTrue(ex.getMessage().toLowerCase().contains("scope"));
        verifyNoInteractions(memoryService);
    }

    @Test
    void missingKey_throws() {
        ObjectNode args = om.createObjectNode();
        args.put("value", "v");
        args.put("scope", "fact");

        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(args, ctx));
        assertTrue(ex.getMessage().contains("key"));
    }

    @Test
    void missingValue_throws() {
        ObjectNode args = om.createObjectNode();
        args.put("key", "k");
        args.put("scope", "fact");

        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(args, ctx));
        assertTrue(ex.getMessage().contains("value"));
    }

    @Test
    void serviceIllegalArgument_propagatedAsToolException() {
        when(memoryService.upsert(any(), any(), any(), any(), any()))
                .thenThrow(new IllegalArgumentException("La valeur ne peut pas depasser 2000 caracteres"));

        ObjectNode args = om.createObjectNode();
        args.put("key", "big");
        args.put("value", "v");
        args.put("scope", "fact");

        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(args, ctx));
        assertTrue(ex.getMessage().contains("2000"));
    }
}
