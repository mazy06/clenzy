package com.clenzy.service.agent.tools;

import com.clenzy.service.LocalEventsRegistry;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.*;

class GetLocalEventsToolTest {

    private LocalEventsRegistry registry;
    private GetLocalEventsTool tool;
    private ObjectMapper om;
    private AgentContext ctx;

    @BeforeEach
    void setUp() {
        registry = mock(LocalEventsRegistry.class);
        om = new ObjectMapper();
        tool = new GetLocalEventsTool(registry, om);
        ctx = AgentContext.minimal(1L, "user-123");
    }

    private static LocalEventsRegistry.LocalEvent event(String id, String title,
                                                          String type, String city,
                                                          String date, String description) {
        LocalEventsRegistry.LocalEvent e = new LocalEventsRegistry.LocalEvent();
        e.id = id;
        e.title = title;
        e.type = type;
        e.city = city;
        e.country = "FR";
        e.date = LocalDate.parse(date);
        e.description = description;
        return e;
    }

    @Test
    void descriptor_isReadOnly() {
        assertEquals("get_local_events", tool.name());
        assertEquals("get_local_events", tool.descriptor().name());
        assertFalse(tool.descriptor().requiresConfirmation());
    }

    @Test
    void city_filtersResults_andBuildsPayload() throws Exception {
        when(registry.findByCityAndDateRange(eq("Paris"), nullable(String.class),
                any(LocalDate.class), any(LocalDate.class))).thenReturn(List.of(
                event("rg", "Roland-Garros", "SPORT", "Paris", "2026-05-24", "Tournoi"),
                event("fete", "Fete musique", "FESTIVAL", "Paris", "2026-06-21", "Concerts")
        ));

        ObjectNode args = om.createObjectNode();
        args.put("city", "Paris");
        ToolResult result = tool.execute(args, ctx);

        assertFalse(result.isError());
        assertEquals("events", result.displayHint());

        JsonNode payload = om.readTree(result.content());
        assertEquals("Paris", payload.path("city").asText());
        assertEquals(2, payload.path("items").size());
        assertEquals(2, payload.path("count").asInt());
        assertFalse(payload.path("truncated").asBoolean());
        assertEquals("Roland-Garros", payload.path("items").get(0).path("title").asText());
        assertEquals("SPORT", payload.path("items").get(0).path("type").asText());
    }

    @Test
    void defaultDateRange_isTodayPlus90Days() {
        when(registry.findByCityAndDateRange(any(), nullable(String.class),
                any(LocalDate.class), any(LocalDate.class))).thenReturn(List.of());

        ObjectNode args = om.createObjectNode();
        args.put("city", "Paris");
        tool.execute(args, ctx);

        org.mockito.ArgumentCaptor<LocalDate> fromCap = org.mockito.ArgumentCaptor.forClass(LocalDate.class);
        org.mockito.ArgumentCaptor<LocalDate> toCap = org.mockito.ArgumentCaptor.forClass(LocalDate.class);
        verify(registry).findByCityAndDateRange(eq("Paris"), isNull(),
                fromCap.capture(), toCap.capture());

        assertEquals(LocalDate.now(), fromCap.getValue());
        assertEquals(LocalDate.now().plusDays(90), toCap.getValue());
    }

    @Test
    void customDateRange_isPassedThrough() {
        when(registry.findByCityAndDateRange(any(), nullable(String.class),
                any(LocalDate.class), any(LocalDate.class))).thenReturn(List.of());

        ObjectNode args = om.createObjectNode();
        args.put("city", "Lyon");
        args.put("from", "2026-12-01");
        args.put("to", "2026-12-31");
        tool.execute(args, ctx);

        verify(registry).findByCityAndDateRange("Lyon", null,
                LocalDate.parse("2026-12-01"), LocalDate.parse("2026-12-31"));
    }

    @Test
    void countryParam_propagatedToRegistry() {
        when(registry.findByCityAndDateRange(any(), any(String.class),
                any(LocalDate.class), any(LocalDate.class))).thenReturn(List.of());

        ObjectNode args = om.createObjectNode();
        args.put("city", "Paris");
        args.put("country", "FR");
        tool.execute(args, ctx);

        verify(registry).findByCityAndDateRange(eq("Paris"), eq("FR"),
                any(LocalDate.class), any(LocalDate.class));
    }

    @Test
    void missingCity_throws() {
        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(om.createObjectNode(), ctx));
        assertTrue(ex.getMessage().toLowerCase().contains("city"));
        verifyNoInteractions(registry);
    }

    @Test
    void invalidDate_throws() {
        ObjectNode args = om.createObjectNode();
        args.put("city", "Paris");
        args.put("from", "not-a-date");

        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(args, ctx));
        assertTrue(ex.getMessage().toLowerCase().contains("date"));
    }

    @Test
    void fromAfterTo_throws() {
        ObjectNode args = om.createObjectNode();
        args.put("city", "Paris");
        args.put("from", "2026-12-31");
        args.put("to", "2026-01-01");

        assertThrows(ToolExecutionException.class, () -> tool.execute(args, ctx));
        verifyNoInteractions(registry);
    }

    @Test
    void resultsExceedingMaxItems_areTruncated() throws Exception {
        // Genere 60 events fictifs — la limite est 50
        java.util.List<LocalEventsRegistry.LocalEvent> many = new java.util.ArrayList<>();
        for (int i = 0; i < 60; i++) {
            many.add(event("id-" + i, "Event " + i, "FESTIVAL", "Paris",
                    "2026-06-" + String.format("%02d", (i % 28) + 1), null));
        }
        when(registry.findByCityAndDateRange(any(), nullable(String.class),
                any(LocalDate.class), any(LocalDate.class))).thenReturn(many);

        ObjectNode args = om.createObjectNode();
        args.put("city", "Paris");
        ToolResult result = tool.execute(args, ctx);
        JsonNode payload = om.readTree(result.content());

        assertEquals(50, payload.path("count").asInt());
        assertEquals(60, payload.path("totalElements").asInt());
        assertTrue(payload.path("truncated").asBoolean());
    }
}
