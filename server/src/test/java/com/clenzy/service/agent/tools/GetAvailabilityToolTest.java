package com.clenzy.service.agent.tools;

import com.clenzy.model.CalendarDay;
import com.clenzy.model.CalendarDayStatus;
import com.clenzy.service.CalendarEngine;
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
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class GetAvailabilityToolTest {

    private CalendarEngine calendarEngine;
    private GetAvailabilityTool tool;
    private ObjectMapper om;
    private AgentContext ctx;

    @BeforeEach
    void setUp() {
        calendarEngine = mock(CalendarEngine.class);
        om = new ObjectMapper();
        tool = new GetAvailabilityTool(calendarEngine, om);
        ctx = AgentContext.minimal(1L, "user-123");
    }

    private CalendarDay day(LocalDate date, CalendarDayStatus status) {
        CalendarDay d = new CalendarDay();
        d.setDate(date);
        d.setStatus(status);
        return d;
    }

    @Test
    void name_matchesDescriptor() {
        assertEquals("get_availability", tool.name());
        assertEquals("get_availability", tool.descriptor().name());
        assertFalse(tool.descriptor().requiresConfirmation());
    }

    @Test
    void oneBookedDay_countsAvailableAndUnavailable() throws Exception {
        // Fenetre 2026-07-01..2026-07-03 (3 jours) ; le 1er est BOOKED.
        when(calendarEngine.getDays(eq(5L), any(), any(), eq(1L)))
                .thenReturn(List.of(day(LocalDate.parse("2026-07-01"), CalendarDayStatus.BOOKED)));

        ObjectNode args = om.createObjectNode();
        args.put("propertyId", 5);
        args.put("from", "2026-07-01");
        args.put("to", "2026-07-03");

        ToolResult result = tool.execute(args, ctx);
        assertFalse(result.isError());
        assertEquals("availability", result.displayHint());

        JsonNode payload = om.readTree(result.content());
        assertEquals(2, payload.path("availableNights").asInt());
        assertEquals(1, payload.path("unavailableNights").asInt());
        assertFalse(payload.path("fullyAvailable").asBoolean());
        assertEquals(3, payload.path("days").size());
    }

    @Test
    void noBlockedDays_fullyAvailable() throws Exception {
        when(calendarEngine.getDays(eq(5L), any(), any(), eq(1L))).thenReturn(List.of());

        ObjectNode args = om.createObjectNode();
        args.put("propertyId", 5);
        args.put("from", "2026-07-01");
        args.put("to", "2026-07-02");

        JsonNode payload = om.readTree(tool.execute(args, ctx).content());
        assertTrue(payload.path("fullyAvailable").asBoolean());
        assertEquals(0, payload.path("unavailableNights").asInt());
    }

    @Test
    void invalidDate_throws() {
        ObjectNode args = om.createObjectNode();
        args.put("propertyId", 5);
        args.put("from", "pas-une-date");
        args.put("to", "2026-07-03");
        assertThrows(ToolExecutionException.class, () -> tool.execute(args, ctx));
    }
}
