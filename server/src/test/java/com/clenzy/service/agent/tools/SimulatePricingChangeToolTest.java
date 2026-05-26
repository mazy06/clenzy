package com.clenzy.service.agent.tools;

import com.clenzy.service.SimulationService;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class SimulatePricingChangeToolTest {

    private SimulationService simulationService;
    private SimulatePricingChangeTool tool;
    private ObjectMapper om;
    private AgentContext ctx;

    @BeforeEach
    void setUp() {
        simulationService = mock(SimulationService.class);
        om = new ObjectMapper();
        tool = new SimulatePricingChangeTool(simulationService, om);
        ctx = AgentContext.minimal(1L, "user-123");
    }

    private static SimulationService.PricingChangeResult sample(double pctFraction) {
        var baseline = new SimulationService.Scenario(100.0, 0.5, 15, new BigDecimal("1500.00"));
        var scenario = new SimulationService.Scenario(90.0, 0.525, 16, new BigDecimal("1440.00"));
        return new SimulationService.PricingChangeResult(
                1L, "Loft Paris", pctFraction,
                LocalDate.of(2026, 7, 1), LocalDate.of(2026, 7, 30), 30L,
                0.5, "default",
                baseline, scenario,
                new BigDecimal("-60.00"), 0.025, -0.04,
                "Impact modere — surveiller la concurrence");
    }

    @Test
    void descriptor_isReadOnly() {
        assertEquals("simulate_pricing_change", tool.name());
        assertEquals("simulate_pricing_change", tool.descriptor().name());
        assertFalse(tool.descriptor().requiresConfirmation());
    }

    @Test
    void execute_buildsCleanPayloadWithSimulationHint() throws Exception {
        when(simulationService.simulatePricingChange(any(), any(), any(Double.class), any(), any()))
                .thenReturn(sample(-0.10));

        ObjectNode args = om.createObjectNode();
        args.put("propertyId", 1);
        args.put("pctChange", -10);
        args.put("from", "2026-07-01");
        args.put("to", "2026-07-30");

        ToolResult result = tool.execute(args, ctx);
        assertFalse(result.isError());
        assertEquals("simulation", result.displayHint());

        JsonNode payload = om.readTree(result.content());
        assertEquals("pricing_change", payload.path("kind").asText());
        assertEquals(1L, payload.path("propertyId").asLong());
        assertEquals(-0.10, payload.path("pctChange").asDouble(), 0.001);
        assertEquals(0.5, payload.path("elasticity").asDouble(), 0.001);
        assertEquals("default", payload.path("elasticitySource").asText());
        assertEquals(1500.0, payload.path("baseline").path("revenue").asDouble(), 0.01);
        assertEquals(1440.0, payload.path("scenario").path("revenue").asDouble(), 0.01);
        assertEquals(-60.0, payload.path("deltaRevenue").asDouble(), 0.01);
        assertTrue(payload.path("recommendation").asText().length() > 5);

        // Pct converti correctement (-10 → -0.10)
        verify(simulationService).simulatePricingChange(
                eq("user-123"), eq(1L), eq(-0.10),
                eq(LocalDate.parse("2026-07-01")), eq(LocalDate.parse("2026-07-30")));
    }

    @Test
    void execute_missingPropertyId_throws() {
        ObjectNode args = om.createObjectNode();
        args.put("pctChange", -10);
        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(args, ctx));
        assertTrue(ex.getMessage().toLowerCase().contains("propertyid"));
    }

    @Test
    void execute_missingPctChange_throws() {
        ObjectNode args = om.createObjectNode();
        args.put("propertyId", 1);
        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(args, ctx));
        assertTrue(ex.getMessage().toLowerCase().contains("pctchange"));
    }

    @Test
    void execute_pctChangeOutOfRange_throws() {
        ObjectNode args = om.createObjectNode();
        args.put("propertyId", 1);
        args.put("pctChange", -60);
        assertThrows(ToolExecutionException.class, () -> tool.execute(args, ctx));

        args.put("pctChange", 70);
        assertThrows(ToolExecutionException.class, () -> tool.execute(args, ctx));
    }

    @Test
    void execute_defaultsWindowToNext30Days() {
        when(simulationService.simulatePricingChange(any(), any(), any(Double.class), any(), any()))
                .thenReturn(sample(0.0));

        ObjectNode args = om.createObjectNode();
        args.put("propertyId", 1);
        args.put("pctChange", 0);
        tool.execute(args, ctx);

        org.mockito.ArgumentCaptor<LocalDate> fromCap =
                org.mockito.ArgumentCaptor.forClass(LocalDate.class);
        org.mockito.ArgumentCaptor<LocalDate> toCap =
                org.mockito.ArgumentCaptor.forClass(LocalDate.class);
        verify(simulationService).simulatePricingChange(any(), any(), any(Double.class),
                fromCap.capture(), toCap.capture());
        assertEquals(LocalDate.now(), fromCap.getValue());
        assertEquals(LocalDate.now().plusDays(30), toCap.getValue());
    }

    @Test
    void execute_invalidDate_throws() {
        ObjectNode args = om.createObjectNode();
        args.put("propertyId", 1);
        args.put("pctChange", -10);
        args.put("from", "bad-date");
        assertThrows(ToolExecutionException.class, () -> tool.execute(args, ctx));
    }

    @Test
    void execute_serviceFailure_propagatedAsToolError() {
        when(simulationService.simulatePricingChange(any(), any(), any(Double.class), any(), any()))
                .thenThrow(new IllegalArgumentException("Propriete 42 introuvable"));

        ObjectNode args = om.createObjectNode();
        args.put("propertyId", 42);
        args.put("pctChange", -10);
        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(args, ctx));
        assertTrue(ex.getMessage().contains("42"));
    }
}
