package com.clenzy.service.agent.tools;

import com.clenzy.service.RateOverrideService;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class SetRateOverrideToolTest {

    private RateOverrideService rateOverrideService;
    private SetRateOverrideTool tool;
    private ObjectMapper om;
    private AgentContext ctx;

    @BeforeEach
    void setUp() {
        rateOverrideService = mock(RateOverrideService.class);
        om = new ObjectMapper();
        tool = new SetRateOverrideTool(rateOverrideService, om);
        ctx = AgentContext.minimal(7L, "user-1");
    }

    private ObjectNode validRangeArgs() {
        ObjectNode args = om.createObjectNode();
        args.put("propertyId", 42);
        args.put("from", "2026-07-01");
        args.put("to", "2026-07-04");
        args.put("price", 199.0);
        return args;
    }

    @Test
    void name_andDescriptor_requireConfirmation() {
        assertEquals("set_rate_override", tool.name());
        assertEquals("set_rate_override", tool.descriptor().name());
        assertTrue(tool.descriptor().requiresConfirmation());
        JsonNode schema = tool.descriptor().jsonSchema();
        String req = schema.path("required").toString();
        assertTrue(req.contains("propertyId"));
        assertTrue(req.contains("from"));
        assertTrue(req.contains("price"));
    }

    @Test
    void missingRequiredArgs_throws() {
        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(om.createObjectNode(), ctx));
        assertTrue(ex.getMessage().toLowerCase().contains("requis"));
    }

    @Test
    void nonPositivePrice_throws() {
        ObjectNode args = validRangeArgs();
        args.put("price", 0);
        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(args, ctx));
        assertTrue(ex.getMessage().toLowerCase().contains("price"));
    }

    @Test
    void toNotAfterFrom_throws() {
        ObjectNode args = validRangeArgs();
        args.put("to", "2026-07-01"); // == from → range vide
        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(args, ctx));
        assertTrue(ex.getMessage().toLowerCase().contains("to"));
    }

    @Test
    void happyPath_range_delegatesToServiceWithKeycloakId() throws Exception {
        when(rateOverrideService.createBulk(anyMap(), eq("user-1")))
                .thenReturn(Map.of("count", 3));

        ToolResult result = tool.execute(validRangeArgs(), ctx);

        assertFalse(result.isError());
        assertEquals("summary", result.displayHint());

        ArgumentCaptor<Map<String, Object>> bodyCaptor = ArgumentCaptor.forClass(Map.class);
        verify(rateOverrideService).createBulk(bodyCaptor.capture(), eq("user-1"));
        Map<String, Object> body = bodyCaptor.getValue();
        assertEquals(42L, ((Number) body.get("propertyId")).longValue());
        assertEquals("2026-07-01", body.get("from"));
        assertEquals("2026-07-04", body.get("to"));
        assertEquals(199.0, ((Number) body.get("nightlyPrice")).doubleValue());

        JsonNode payload = om.readTree(result.content());
        assertEquals(42L, payload.path("propertyId").asLong());
        assertEquals(3, payload.path("nightsAffected").asInt());
        assertTrue(payload.path("message").asText().contains("3"));
    }

    @Test
    void singleDate_defaultsToExclusiveNextDay() {
        when(rateOverrideService.createBulk(anyMap(), eq("user-1")))
                .thenReturn(Map.of("count", 1));

        ObjectNode args = om.createObjectNode();
        args.put("propertyId", 42);
        args.put("from", "2026-08-15");
        args.put("price", 250.0);

        tool.execute(args, ctx);

        ArgumentCaptor<Map<String, Object>> bodyCaptor = ArgumentCaptor.forClass(Map.class);
        verify(rateOverrideService).createBulk(bodyCaptor.capture(), eq("user-1"));
        Map<String, Object> body = bodyCaptor.getValue();
        assertEquals("2026-08-15", body.get("from"));
        assertEquals("2026-08-16", body.get("to")); // borne exclusive = from + 1 jour
    }

    @Test
    void serviceThrows_wrappedAsToolExecutionException() {
        when(rateOverrideService.createBulk(anyMap(), eq("user-1")))
                .thenThrow(new RuntimeException("Propriete introuvable"));

        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(validRangeArgs(), ctx));
        assertTrue(ex.getMessage().contains("Propriete introuvable"));
        assertEquals("set_rate_override", ex.getToolName());
    }
}
