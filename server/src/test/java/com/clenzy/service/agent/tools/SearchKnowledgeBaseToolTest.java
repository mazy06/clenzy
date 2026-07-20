package com.clenzy.service.agent.tools;

import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolResult;
import com.clenzy.service.agent.kb.KbSearchService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class SearchKnowledgeBaseToolTest {

    private KbSearchService searchService;
    private SearchKnowledgeBaseTool tool;
    private ObjectMapper om;
    private AgentContext ctx;

    @BeforeEach
    void setUp() {
        searchService = mock(KbSearchService.class);
        om = new ObjectMapper();
        tool = new SearchKnowledgeBaseTool(searchService, om, 0.50);
        ctx = AgentContext.minimal(1L, "user-123");
    }

    @Test
    void descriptor_isReadOnly() {
        assertEquals("search_knowledge_base", tool.name());
        assertEquals("search_knowledge_base", tool.descriptor().name());
        assertFalse(tool.descriptor().requiresConfirmation());
    }

    @Test
    void execute_buildsKnowledgePayload() throws Exception {
        when(searchService.search(eq("comment configurer"), eq(1L), eq(5), any()))
                .thenReturn(List.of(
                        new KbSearchService.KbSearchHit(
                                1L, 10L, "Configuration", "docs/conf.md",
                                "Pour configurer X, suivre ces etapes...", 0.91)
                ));

        ObjectNode args = om.createObjectNode();
        args.put("query", "comment configurer");
        ToolResult result = tool.execute(args, ctx);

        assertFalse(result.isError());
        assertEquals("knowledge", result.displayHint());

        JsonNode payload = om.readTree(result.content());
        assertEquals("comment configurer", payload.path("query").asText());
        assertEquals(1, payload.path("count").asInt());
        JsonNode items = payload.path("items");
        assertEquals("Configuration", items.get(0).path("title").asText());
        assertEquals("docs/conf.md", items.get(0).path("sourcePath").asText());
        assertEquals(0.91, items.get(0).path("relevance").asDouble(), 0.001);
    }

    @Test
    void execute_missingQuery_throws() {
        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(om.createObjectNode(), ctx));
        assertTrue(ex.getMessage().toLowerCase().contains("query"));
    }

    @Test
    void execute_topKClamped() {
        when(searchService.search(anyString(), eq(1L), anyInt(), any())).thenReturn(List.of());

        ObjectNode args = om.createObjectNode();
        args.put("query", "test");
        args.put("topK", 99);
        tool.execute(args, ctx);
        verify(searchService).search(eq("test"), eq(1L), eq(10), any());

        args.put("topK", 0);
        tool.execute(args, ctx);
        verify(searchService).search(eq("test"), eq(1L), eq(1), any());
    }

    @Test
    void execute_emptyResults_stillReturnsValidPayload() throws Exception {
        when(searchService.search(anyString(), eq(1L), anyInt(), any())).thenReturn(List.of());

        ObjectNode args = om.createObjectNode();
        args.put("query", "rien");
        ToolResult result = tool.execute(args, ctx);
        JsonNode payload = om.readTree(result.content());
        assertEquals(0, payload.path("count").asInt());
        assertTrue(payload.path("items").isArray());
        assertEquals(0, payload.path("items").size());
    }

    private static String anyString() { return org.mockito.ArgumentMatchers.anyString(); }
}
