package com.clenzy.service.agent.tools;

import com.clenzy.model.CalendarDay;
import com.clenzy.service.CalendarEngine;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class BlockCalendarDayToolTest {

    private CalendarEngine calendarEngine;
    private BlockCalendarDayTool tool;
    private ObjectMapper om;
    private AgentContext ctx;

    @BeforeEach
    void setUp() {
        calendarEngine = mock(CalendarEngine.class);
        om = new ObjectMapper();
        tool = new BlockCalendarDayTool(calendarEngine, om);
        ctx = AgentContext.minimal(1L, "user-1");
    }

    private ObjectNode validArgs() {
        ObjectNode args = om.createObjectNode();
        args.put("propertyId", 10);
        args.put("from", LocalDate.now().plusDays(1).toString());
        args.put("to", LocalDate.now().plusDays(3).toString());
        return args;
    }

    @Test
    void name_andDescriptor_requireConfirmation() {
        assertEquals("block_calendar_day", tool.name());
        assertEquals("block_calendar_day", tool.descriptor().name());
        assertTrue(tool.descriptor().requiresConfirmation(), "write tool requires confirmation");
        JsonNode schema = tool.descriptor().jsonSchema();
        assertEquals("object", schema.path("type").asText());
        String req = schema.path("required").toString();
        assertTrue(req.contains("propertyId"));
        assertTrue(req.contains("from"));
        assertTrue(req.contains("to"));
    }

    @Nested
    @DisplayName("Argument validation")
    class Validation {

        @Test
        void missingPropertyId_throws() {
            ObjectNode args = validArgs();
            args.remove("propertyId");
            ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                    () -> tool.execute(args, ctx));
            assertTrue(ex.getMessage().toLowerCase().contains("propertyid"));
        }

        @Test
        void missingFrom_throws() {
            ObjectNode args = validArgs();
            args.remove("from");
            assertThrows(ToolExecutionException.class, () -> tool.execute(args, ctx));
        }

        @Test
        void missingTo_throws() {
            ObjectNode args = validArgs();
            args.remove("to");
            assertThrows(ToolExecutionException.class, () -> tool.execute(args, ctx));
        }

        @Test
        void invalidFromFormat_throws() {
            ObjectNode args = validArgs();
            args.put("from", "not-a-date");
            ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                    () -> tool.execute(args, ctx));
            assertTrue(ex.getMessage().toLowerCase().contains("invalide")
                    || ex.getMessage().toLowerCase().contains("from"));
        }

        @Test
        void invalidToFormat_throws() {
            ObjectNode args = validArgs();
            args.put("to", "garbage");
            assertThrows(ToolExecutionException.class, () -> tool.execute(args, ctx));
        }

        @Test
        void fromAfterTo_throws() {
            ObjectNode args = om.createObjectNode();
            args.put("propertyId", 10);
            args.put("from", LocalDate.now().plusDays(5).toString());
            args.put("to", LocalDate.now().plusDays(2).toString());
            ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                    () -> tool.execute(args, ctx));
            assertTrue(ex.getMessage().toLowerCase().contains("<="));
        }

        @Test
        void blockingPastDate_throws() {
            ObjectNode args = om.createObjectNode();
            args.put("propertyId", 10);
            args.put("from", LocalDate.now().minusDays(5).toString());
            args.put("to", LocalDate.now().minusDays(2).toString());
            ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                    () -> tool.execute(args, ctx));
            assertTrue(ex.getMessage().toLowerCase().contains("pass"));
        }
    }

    @Test
    void happyPath_buildsPayloadWithDaysCountAndDates() throws Exception {
        when(calendarEngine.block(anyLong(), any(), any(), anyLong(), anyString(), any(), anyString()))
                .thenReturn(List.of(new CalendarDay(), new CalendarDay(), new CalendarDay()));

        ToolResult result = tool.execute(validArgs(), ctx);
        assertFalse(result.isError());
        assertEquals("summary", result.displayHint());

        JsonNode payload = om.readTree(result.content());
        assertEquals(10L, payload.path("propertyId").asLong());
        assertEquals(3, payload.path("daysBlocked").asInt());
        assertFalse(payload.has("notes"), "no notes provided");
    }

    @Test
    void notes_propagatedToEngineAndPayload() throws Exception {
        when(calendarEngine.block(anyLong(), any(), any(), anyLong(), anyString(), any(), anyString()))
                .thenReturn(List.of(new CalendarDay()));

        ObjectNode args = validArgs();
        args.put("notes", "Renovation salle de bain");

        ToolResult result = tool.execute(args, ctx);
        JsonNode payload = om.readTree(result.content());
        assertEquals("Renovation salle de bain", payload.path("notes").asText());

        verify(calendarEngine).block(eq(10L), any(), any(), eq(1L),
                eq("ASSISTANT"), eq("Renovation salle de bain"), eq("user-1"));
    }

    @Test
    void engineConflict_wrappedAsToolExecutionException() {
        when(calendarEngine.block(anyLong(), any(), any(), anyLong(), anyString(), any(), anyString()))
                .thenThrow(new RuntimeException("Conflict on 2026-07-15"));

        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(validArgs(), ctx));
        assertTrue(ex.getMessage().contains("Conflict"));
        assertEquals("block_calendar_day", ex.getToolName());
    }

    @Test
    void source_isAlwaysAssistant() {
        when(calendarEngine.block(anyLong(), any(), any(), anyLong(), anyString(), any(), anyString()))
                .thenReturn(List.of(new CalendarDay()));
        tool.execute(validArgs(), ctx);
        verify(calendarEngine).block(anyLong(), any(), any(), anyLong(), eq("ASSISTANT"), any(), anyString());
    }
}
