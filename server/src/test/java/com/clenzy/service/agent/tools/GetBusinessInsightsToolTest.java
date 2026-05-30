package com.clenzy.service.agent.tools;

import com.clenzy.dto.AiInsightDto;
import com.clenzy.service.AiAnalyticsService;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class GetBusinessInsightsToolTest {

    private AiAnalyticsService aiAnalyticsService;
    private GetBusinessInsightsTool tool;
    private ObjectMapper om;
    private AgentContext ctx;

    @BeforeEach
    void setUp() {
        aiAnalyticsService = mock(AiAnalyticsService.class);
        om = new ObjectMapper();
        tool = new GetBusinessInsightsTool(aiAnalyticsService, om);
        ctx = AgentContext.minimal(1L, "user-1");
    }

    private static AiInsightDto insight(String type, String severity, String reco) {
        return new AiInsightDto(type, severity, "Titre", "Description", reco);
    }

    @Test
    void name_andDescriptor_areReadOnly_andRequirePropertyId() {
        assertEquals("get_business_insights", tool.name());
        assertEquals("get_business_insights", tool.descriptor().name());
        assertFalse(tool.descriptor().requiresConfirmation());
        JsonNode schema = tool.descriptor().jsonSchema();
        assertTrue(schema.path("required").toString().contains("propertyId"));
    }

    @Test
    void missingPropertyId_throws() {
        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(om.createObjectNode(), ctx));
        assertTrue(ex.getMessage().toLowerCase().contains("propertyid"));
        assertEquals("get_business_insights", ex.getToolName());
    }

    @Test
    void happyPath_mapsInsightsAndIncludesAllFields() throws Exception {
        when(aiAnalyticsService.getAiInsights(eq(10L), eq(1L), any(), any()))
                .thenReturn(List.of(
                        insight("ANOMALY", "HIGH", "Reduire taxe"),
                        insight("TREND", "LOW", null)
                ));

        ObjectNode args = om.createObjectNode();
        args.put("propertyId", 10);
        args.put("daysBack", 60);

        ToolResult result = tool.execute(args, ctx);
        assertFalse(result.isError());
        assertEquals("insights", result.displayHint());

        JsonNode payload = om.readTree(result.content());
        assertEquals(10L, payload.path("propertyId").asLong());
        assertEquals(2, payload.path("count").asInt());
        assertTrue(payload.path("title").asText().contains("60"));

        JsonNode first = payload.path("items").get(0);
        assertEquals("ANOMALY", first.path("type").asText());
        assertEquals("HIGH", first.path("severity").asText());
        assertEquals("Reduire taxe", first.path("recommendation").asText());

        // recommendation null → key omitted
        JsonNode second = payload.path("items").get(1);
        assertFalse(second.has("recommendation"));
    }

    @Test
    void blankRecommendation_isOmitted() throws Exception {
        when(aiAnalyticsService.getAiInsights(anyLong(), anyLong(), any(), any()))
                .thenReturn(List.of(insight("TREND", "LOW", "   ")));

        ObjectNode args = om.createObjectNode();
        args.put("propertyId", 10);

        ToolResult result = tool.execute(args, ctx);
        JsonNode item = om.readTree(result.content()).path("items").get(0);
        assertFalse(item.has("recommendation"));
    }

    @Test
    void daysBack_clampedToMin7() throws Exception {
        when(aiAnalyticsService.getAiInsights(anyLong(), anyLong(), any(), any()))
                .thenReturn(List.of());

        ObjectNode args = om.createObjectNode();
        args.put("propertyId", 10);
        args.put("daysBack", 1);

        ToolResult result = tool.execute(args, ctx);
        JsonNode payload = om.readTree(result.content());
        LocalDate from = LocalDate.parse(payload.path("from").asText());
        LocalDate to = LocalDate.parse(payload.path("to").asText());
        assertEquals(7, java.time.temporal.ChronoUnit.DAYS.between(from, to));
    }

    @Test
    void daysBack_clampedToMax365() throws Exception {
        when(aiAnalyticsService.getAiInsights(anyLong(), anyLong(), any(), any()))
                .thenReturn(List.of());

        ObjectNode args = om.createObjectNode();
        args.put("propertyId", 10);
        args.put("daysBack", 9999);

        ToolResult result = tool.execute(args, ctx);
        JsonNode payload = om.readTree(result.content());
        LocalDate from = LocalDate.parse(payload.path("from").asText());
        LocalDate to = LocalDate.parse(payload.path("to").asText());
        assertEquals(365, java.time.temporal.ChronoUnit.DAYS.between(from, to));
    }

    @Test
    void daysBack_default90() throws Exception {
        when(aiAnalyticsService.getAiInsights(anyLong(), anyLong(), any(), any()))
                .thenReturn(List.of());

        ObjectNode args = om.createObjectNode();
        args.put("propertyId", 10);

        ToolResult result = tool.execute(args, ctx);
        JsonNode payload = om.readTree(result.content());
        LocalDate from = LocalDate.parse(payload.path("from").asText());
        LocalDate to = LocalDate.parse(payload.path("to").asText());
        assertEquals(90, java.time.temporal.ChronoUnit.DAYS.between(from, to));
        assertTrue(payload.path("title").asText().contains("90"));
    }

    @Test
    void emptyInsights_count0_andEmptyItems() throws Exception {
        when(aiAnalyticsService.getAiInsights(anyLong(), anyLong(), any(), any()))
                .thenReturn(List.of());

        ObjectNode args = om.createObjectNode();
        args.put("propertyId", 10);

        ToolResult result = tool.execute(args, ctx);
        JsonNode payload = om.readTree(result.content());
        assertEquals(0, payload.path("count").asInt());
        assertEquals(0, payload.path("items").size());
    }

    @Test
    void serviceThrows_wrappedWithHelpfulHint() {
        when(aiAnalyticsService.getAiInsights(anyLong(), anyLong(), any(), any()))
                .thenThrow(new RuntimeException("AI_FEATURE_DISABLED"));

        ObjectNode args = om.createObjectNode();
        args.put("propertyId", 10);

        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(args, ctx));
        assertTrue(ex.getMessage().contains("AI_FEATURE_DISABLED"));
        assertTrue(ex.getMessage().contains("Parametres"));
        assertEquals("get_business_insights", ex.getToolName());
    }
}
