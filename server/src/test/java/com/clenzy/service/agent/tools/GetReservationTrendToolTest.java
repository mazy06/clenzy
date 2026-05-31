package com.clenzy.service.agent.tools;

import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.service.ReservationService;
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

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class GetReservationTrendToolTest {

    private ReservationService reservationService;
    private GetReservationTrendTool tool;
    private ObjectMapper om;
    private AgentContext ctx;

    @BeforeEach
    void setUp() {
        reservationService = mock(ReservationService.class);
        om = new ObjectMapper();
        tool = new GetReservationTrendTool(reservationService, om);
        ctx = AgentContext.minimal(1L, "user-1");
    }

    private static Reservation reservation(LocalDate checkIn, String status) {
        Reservation r = new Reservation();
        Property p = new Property();
        p.setId(1L);
        r.setProperty(p);
        r.setCheckIn(checkIn);
        r.setCheckOut(checkIn != null ? checkIn.plusDays(2) : null);
        r.setTotalPrice(new BigDecimal("100"));
        r.setStatus(status);
        return r;
    }

    @Test
    void name_andDescriptor_areReadOnly() {
        assertEquals("get_reservation_trend", tool.name());
        assertEquals("get_reservation_trend", tool.descriptor().name());
        assertFalse(tool.descriptor().requiresConfirmation());
        JsonNode schema = tool.descriptor().jsonSchema();
        assertEquals("object", schema.path("type").asText());
        assertTrue(schema.path("properties").has("months"));
        assertTrue(schema.path("properties").has("propertyId"));
    }

    @Nested
    @DisplayName("Defaults and bounds")
    class Defaults {

        @Test
        void noArgs_defaults6Months() throws Exception {
            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenReturn(List.of());

            ToolResult result = tool.execute(om.createObjectNode(), ctx);
            assertFalse(result.isError());
            assertEquals("chart_line", result.displayHint());

            JsonNode payload = om.readTree(result.content());
            assertEquals(6, payload.path("items").size());
            assertTrue(payload.path("title").asText().contains("6 mois"));
        }

        @Test
        void months_clampedToMax24() throws Exception {
            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenReturn(List.of());

            ObjectNode args = om.createObjectNode();
            args.put("months", 999);

            ToolResult result = tool.execute(args, ctx);
            JsonNode payload = om.readTree(result.content());
            assertEquals(24, payload.path("items").size());
        }

        @Test
        void months_clampedToMin1() throws Exception {
            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenReturn(List.of());

            ObjectNode args = om.createObjectNode();
            args.put("months", 0);

            ToolResult result = tool.execute(args, ctx);
            JsonNode payload = om.readTree(result.content());
            assertEquals(1, payload.path("items").size());
        }

        @Test
        void propertyId_isForwardedAsList() {
            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenReturn(List.of());

            ObjectNode args = om.createObjectNode();
            args.put("propertyId", 42);
            args.put("months", 3);

            tool.execute(args, ctx);

            verify(reservationService).getReservations(eq("user-1"), eq(List.of(42L)),
                    any(), any());
        }

        @Test
        void noPropertyId_passesNullToService() {
            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenReturn(List.of());
            tool.execute(om.createObjectNode(), ctx);
            verify(reservationService).getReservations(eq("user-1"), isNull(), any(), any());
        }
    }

    @Nested
    @DisplayName("Aggregation by month")
    class Aggregation {

        @Test
        void totalsAndConfirmed_byMonth() throws Exception {
            LocalDate today = LocalDate.now().withDayOfMonth(15);
            Reservation r1 = reservation(today, "CONFIRMED");
            Reservation r2 = reservation(today, "confirmed"); // case insensitive
            Reservation r3 = reservation(today, "PENDING");
            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenReturn(List.of(r1, r2, r3));

            ObjectNode args = om.createObjectNode();
            args.put("months", 1);

            ToolResult result = tool.execute(args, ctx);
            JsonNode payload = om.readTree(result.content());

            JsonNode item = payload.path("items").get(0);
            assertEquals(3, item.path("total").asInt());
            assertEquals(2, item.path("confirmed").asInt());
            // cancelled = 0 → key omitted
            assertFalse(item.has("cancelled"));
        }

        @Test
        void cancelledField_includedOnlyWhenAboveZero() throws Exception {
            LocalDate today = LocalDate.now().withDayOfMonth(15);
            Reservation r1 = reservation(today, "CANCELLED");
            Reservation r2 = reservation(today, "cancelled");
            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenReturn(List.of(r1, r2));

            ObjectNode args = om.createObjectNode();
            args.put("months", 1);

            ToolResult result = tool.execute(args, ctx);
            JsonNode payload = om.readTree(result.content());

            JsonNode item = payload.path("items").get(0);
            assertEquals(2, item.path("cancelled").asInt());
            assertEquals(0, item.path("confirmed").asInt());
        }

        @Test
        void reservationWithoutCheckIn_isSkipped() throws Exception {
            Reservation noCheck = reservation(null, "CONFIRMED");
            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenReturn(List.of(noCheck));

            ObjectNode args = om.createObjectNode();
            args.put("months", 1);

            ToolResult result = tool.execute(args, ctx);
            JsonNode payload = om.readTree(result.content());

            assertEquals(0, payload.path("items").get(0).path("total").asInt());
        }

        @Test
        void reservationOutsideWindow_defensivelyIgnored() throws Exception {
            // Way in the past → outside the 1-month window key
            Reservation old = reservation(LocalDate.of(2000, 1, 1), "CONFIRMED");
            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenReturn(List.of(old));

            ObjectNode args = om.createObjectNode();
            args.put("months", 1);

            ToolResult result = tool.execute(args, ctx);
            JsonNode payload = om.readTree(result.content());
            assertEquals(0, payload.path("items").get(0).path("total").asInt());
        }

        @Test
        void emptyMonths_initializedWithZeros() throws Exception {
            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenReturn(List.of());

            ObjectNode args = om.createObjectNode();
            args.put("months", 3);

            ToolResult result = tool.execute(args, ctx);
            JsonNode payload = om.readTree(result.content());
            assertEquals(3, payload.path("items").size());
            for (JsonNode item : payload.path("items")) {
                assertEquals(0, item.path("total").asInt());
                assertEquals(0, item.path("confirmed").asInt());
            }
        }
    }

    @Nested
    @DisplayName("Payload structure")
    class PayloadStructure {

        @Test
        void series_hasTotalAndConfirmed() throws Exception {
            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenReturn(List.of());

            ToolResult result = tool.execute(om.createObjectNode(), ctx);
            JsonNode payload = om.readTree(result.content());
            JsonNode series = payload.path("series");
            assertEquals(2, series.size());
            assertEquals("total", series.get(0).path("key").asText());
            assertEquals("confirmed", series.get(1).path("key").asText());
        }

        @Test
        void itemNames_areFrenchAbbreviations() throws Exception {
            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenReturn(List.of());

            ObjectNode args = om.createObjectNode();
            args.put("months", 1);

            ToolResult result = tool.execute(args, ctx);
            JsonNode payload = om.readTree(result.content());
            String name = payload.path("items").get(0).path("name").asText();
            assertTrue(name.length() <= 4, "French short month: " + name);
        }
    }

    @Nested
    @DisplayName("Error propagation")
    class Errors {

        @Test
        void reservationServiceThrows_wrappedAsToolExecutionException() {
            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenThrow(new RuntimeException("boom"));
            ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                    () -> tool.execute(om.createObjectNode(), ctx));
            assertTrue(ex.getMessage().contains("boom"));
            assertEquals("get_reservation_trend", ex.getToolName());
        }
    }
}
