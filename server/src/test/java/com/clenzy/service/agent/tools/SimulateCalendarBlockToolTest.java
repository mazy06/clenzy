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
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class SimulateCalendarBlockToolTest {

    private SimulationService simulationService;
    private SimulateCalendarBlockTool tool;
    private ObjectMapper om;
    private AgentContext ctx;

    @BeforeEach
    void setUp() {
        simulationService = mock(SimulationService.class);
        om = new ObjectMapper();
        tool = new SimulateCalendarBlockTool(simulationService, om);
        ctx = AgentContext.minimal(1L, "user-123");
    }

    @Test
    void descriptor_isReadOnly() {
        assertEquals("simulate_calendar_block", tool.name());
        assertEquals("simulate_calendar_block", tool.descriptor().name());
        assertFalse(tool.descriptor().requiresConfirmation());
    }

    @Test
    void execute_buildsCleanPayloadWithSimulationHint() throws Exception {
        var result = new SimulationService.CalendarBlockResult(
                1L, "Loft", LocalDate.of(2026, 7, 1), LocalDate.of(2026, 7, 10), 10,
                0.8, 120.0, 8, new BigDecimal("960.00"),
                "meme periode annee precedente",
                List.of("Decaler la maintenance", "Bloquer uniquement les jours necessaires"));
        when(simulationService.simulateCalendarBlock(any(), any(), any(), any()))
                .thenReturn(result);

        ObjectNode args = om.createObjectNode();
        args.put("propertyId", 1);
        args.put("from", "2026-07-01");
        args.put("to", "2026-07-10");

        ToolResult tr = tool.execute(args, ctx);
        assertFalse(tr.isError());
        assertEquals("simulation", tr.displayHint());

        JsonNode payload = om.readTree(tr.content());
        assertEquals("calendar_block", payload.path("kind").asText());
        assertEquals(1L, payload.path("propertyId").asLong());
        assertEquals(10, payload.path("daysBlocked").asInt());
        assertEquals(0.8, payload.path("estimatedOccupancy").asDouble(), 0.001);
        assertEquals(960.0, payload.path("estimatedLostRevenue").asDouble(), 0.001);
        assertEquals(2, payload.path("alternativeSuggestions").size());
        assertEquals("meme periode annee precedente", payload.path("reference").asText());

        verify(simulationService).simulateCalendarBlock(
                eq("user-123"), eq(1L),
                eq(LocalDate.parse("2026-07-01")), eq(LocalDate.parse("2026-07-10")));
    }

    @Test
    void execute_missingPropertyId_throws() {
        ObjectNode args = om.createObjectNode();
        args.put("from", "2026-07-01");
        args.put("to", "2026-07-10");
        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(args, ctx));
        assertTrue(ex.getMessage().toLowerCase().contains("propertyid"));
    }

    @Test
    void execute_missingDates_throws() {
        ObjectNode args = om.createObjectNode();
        args.put("propertyId", 1);
        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(args, ctx));
        assertTrue(ex.getMessage().toLowerCase().contains("from")
                || ex.getMessage().toLowerCase().contains("to"));
    }

    @Test
    void execute_fromAfterTo_throws() {
        ObjectNode args = om.createObjectNode();
        args.put("propertyId", 1);
        args.put("from", "2026-07-10");
        args.put("to", "2026-07-01");
        assertThrows(ToolExecutionException.class, () -> tool.execute(args, ctx));
    }

    @Test
    void execute_invalidDate_throws() {
        ObjectNode args = om.createObjectNode();
        args.put("propertyId", 1);
        args.put("from", "not-a-date");
        args.put("to", "2026-07-10");
        assertThrows(ToolExecutionException.class, () -> tool.execute(args, ctx));
    }

    @Test
    void execute_serviceFailure_propagatedAsToolError() {
        when(simulationService.simulateCalendarBlock(any(), any(), any(), any()))
                .thenThrow(new IllegalArgumentException("Propriete 99 introuvable"));

        ObjectNode args = om.createObjectNode();
        args.put("propertyId", 99);
        args.put("from", "2026-07-01");
        args.put("to", "2026-07-05");
        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(args, ctx));
        assertTrue(ex.getMessage().contains("99"));
    }
}
