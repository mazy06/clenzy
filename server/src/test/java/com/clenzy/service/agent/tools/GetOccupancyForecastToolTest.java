package com.clenzy.service.agent.tools;

import com.clenzy.dto.OccupancyForecastDto;
import com.clenzy.model.Reservation;
import com.clenzy.service.AiAnalyticsService;
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

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class GetOccupancyForecastToolTest {

    private AiAnalyticsService aiAnalyticsService;
    private ReservationService reservationService;
    private GetOccupancyForecastTool tool;
    private ObjectMapper om;
    private AgentContext ctx;

    @BeforeEach
    void setUp() {
        aiAnalyticsService = mock(AiAnalyticsService.class);
        reservationService = mock(ReservationService.class);
        om = new ObjectMapper();
        tool = new GetOccupancyForecastTool(aiAnalyticsService, reservationService, om);
        ctx = AgentContext.minimal(1L, "user-1");
    }

    private static OccupancyForecastDto fc(LocalDate date, double pred, double conf, boolean booked) {
        return new OccupancyForecastDto(10L, date, pred, conf, booked, "WEEKDAY", "MID", "x");
    }

    @Test
    void name_andDescriptor_areReadOnly_andRequirePropertyId() {
        assertEquals("get_occupancy_forecast", tool.name());
        assertFalse(tool.descriptor().requiresConfirmation());
        JsonNode schema = tool.descriptor().jsonSchema();
        assertEquals("object", schema.path("type").asText());
        assertTrue(schema.path("required").toString().contains("propertyId"));
    }

    @Test
    void execute_missingPropertyId_throws() {
        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(om.createObjectNode(), ctx));
        assertTrue(ex.getMessage().toLowerCase().contains("propertyid"));
        assertEquals("get_occupancy_forecast", ex.getToolName());
    }

    @Nested
    @DisplayName("Bounds and defaults")
    class Bounds {

        @Test
        void days_clampedToMax90() throws Exception {
            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenReturn(List.of());
            List<OccupancyForecastDto> forecast = generateForecast(90);
            when(aiAnalyticsService.getForecast(anyLong(), any(), any(), anyList()))
                    .thenReturn(forecast);

            ObjectNode args = om.createObjectNode();
            args.put("propertyId", 10);
            args.put("days", 999);

            ToolResult result = tool.execute(args, ctx);
            JsonNode payload = om.readTree(result.content());
            assertEquals(90, payload.path("daysCount").asInt());
            assertTrue(payload.path("title").asText().contains("90"));
        }

        @Test
        void days_clampedToMin7() throws Exception {
            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenReturn(List.of());
            when(aiAnalyticsService.getForecast(anyLong(), any(), any(), anyList()))
                    .thenReturn(generateForecast(7));

            ObjectNode args = om.createObjectNode();
            args.put("propertyId", 10);
            args.put("days", 1);

            ToolResult result = tool.execute(args, ctx);
            JsonNode payload = om.readTree(result.content());
            assertEquals(7, payload.path("daysCount").asInt());
        }

        @Test
        void days_default30() throws Exception {
            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenReturn(List.of());
            when(aiAnalyticsService.getForecast(anyLong(), any(), any(), anyList()))
                    .thenReturn(generateForecast(30));

            ObjectNode args = om.createObjectNode();
            args.put("propertyId", 10);

            ToolResult result = tool.execute(args, ctx);
            JsonNode payload = om.readTree(result.content());
            assertEquals(30, payload.path("daysCount").asInt());
        }
    }

    @Nested
    @DisplayName("Stats and aggregation")
    class Stats {

        @Test
        void countsHighOccupancy_lowConfidence_andBooked() throws Exception {
            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenReturn(List.of());

            LocalDate today = LocalDate.now();
            List<OccupancyForecastDto> forecast = List.of(
                    fc(today, 0.9, 0.6, true),       // high occ, booked
                    fc(today.plusDays(1), 0.95, 0.4, false), // high occ, low conf
                    fc(today.plusDays(2), 0.2, 0.8, false),   // nothing
                    fc(today.plusDays(3), 0.85, 0.3, true)    // high occ, low conf, booked
            );
            when(aiAnalyticsService.getForecast(anyLong(), any(), any(), anyList()))
                    .thenReturn(forecast);

            ObjectNode args = om.createObjectNode();
            args.put("propertyId", 10);
            args.put("days", 7);

            ToolResult result = tool.execute(args, ctx);
            JsonNode payload = om.readTree(result.content());
            assertEquals(3L, payload.path("highOccupancyDays").asLong());
            assertEquals(2L, payload.path("lowConfidenceDays").asLong());
            assertEquals(2L, payload.path("alreadyBookedDays").asLong());
        }

        @Test
        void itemsHaveDateAndPercentages() throws Exception {
            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenReturn(List.of());

            LocalDate today = LocalDate.now();
            List<OccupancyForecastDto> forecast = List.of(
                    fc(today, 0.5, 0.8, false));
            when(aiAnalyticsService.getForecast(anyLong(), any(), any(), anyList()))
                    .thenReturn(forecast);

            ObjectNode args = om.createObjectNode();
            args.put("propertyId", 10);
            args.put("days", 7);

            ToolResult result = tool.execute(args, ctx);
            JsonNode payload = om.readTree(result.content());

            JsonNode item = payload.path("items").get(0);
            assertEquals(50L, item.path("occupancy").asLong());
            assertEquals(80L, item.path("confidence").asLong());
            String name = item.path("name").asText();
            assertTrue(name.matches("\\d{2}/\\d{2}"), "DD/MM expected, got " + name);
        }
    }

    @Test
    void series_hasOccupancyAndConfidenceWithBrandColors() throws Exception {
        when(reservationService.getReservations(anyString(), any(), any(), any()))
                .thenReturn(List.of());
        when(aiAnalyticsService.getForecast(anyLong(), any(), any(), anyList()))
                .thenReturn(generateForecast(30));

        ObjectNode args = om.createObjectNode();
        args.put("propertyId", 10);

        ToolResult result = tool.execute(args, ctx);
        JsonNode payload = om.readTree(result.content());
        JsonNode series = payload.path("series");
        assertEquals(2, series.size());
        assertEquals("occupancy", series.get(0).path("key").asText());
        assertEquals("confidence", series.get(1).path("key").asText());
        assertEquals("#6B8A9A", series.get(0).path("color").asText());
        assertEquals("#7BA3C2", series.get(1).path("color").asText());
    }

    @Test
    void reservationsServiceThrows_wrappedAsToolExecutionException() {
        when(reservationService.getReservations(anyString(), any(), any(), any()))
                .thenThrow(new RuntimeException("history failed"));

        ObjectNode args = om.createObjectNode();
        args.put("propertyId", 10);

        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(args, ctx));
        assertTrue(ex.getMessage().contains("history failed"));
    }

    @Test
    void forecastServiceThrows_wrappedAsToolExecutionException() {
        when(reservationService.getReservations(anyString(), any(), any(), any()))
                .thenReturn(List.of());
        when(aiAnalyticsService.getForecast(anyLong(), any(), any(), anyList()))
                .thenThrow(new RuntimeException("ai down"));

        ObjectNode args = om.createObjectNode();
        args.put("propertyId", 10);

        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(args, ctx));
        assertTrue(ex.getMessage().toLowerCase().contains("indisponible"));
        assertEquals("get_occupancy_forecast", ex.getToolName());
    }

    @Test
    void historicalReservations_loadedAndPassedToForecast() {
        Reservation r = new Reservation();
        r.setCheckIn(LocalDate.now().minusDays(10));
        when(reservationService.getReservations(anyString(), any(), any(), any()))
                .thenReturn(List.of(r));
        when(aiAnalyticsService.getForecast(anyLong(), any(), any(), anyList()))
                .thenReturn(generateForecast(30));

        ObjectNode args = om.createObjectNode();
        args.put("propertyId", 10);

        tool.execute(args, ctx);

        verify(reservationService).getReservations(eq("user-1"), eq(List.of(10L)), any(), any());
        verify(aiAnalyticsService).getForecast(eq(10L), any(), any(), eq(List.of(r)));
    }

    private static List<OccupancyForecastDto> generateForecast(int days) {
        List<OccupancyForecastDto> out = new ArrayList<>(days);
        LocalDate today = LocalDate.now();
        for (int i = 0; i < days; i++) {
            out.add(fc(today.plusDays(i), 0.5, 0.7, false));
        }
        return out;
    }
}
