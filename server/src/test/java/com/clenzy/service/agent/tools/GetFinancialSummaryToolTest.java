package com.clenzy.service.agent.tools;

import com.clenzy.dto.InterventionResponse;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.service.InterventionService;
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
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.security.oauth2.jwt.Jwt;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class GetFinancialSummaryToolTest {

    private ReservationService reservationService;
    private InterventionService interventionService;
    private GetFinancialSummaryTool tool;
    private ObjectMapper om;
    private AgentContext ctx;
    private Jwt jwt;

    @BeforeEach
    void setUp() {
        reservationService = mock(ReservationService.class);
        interventionService = mock(InterventionService.class);
        om = new ObjectMapper();
        tool = new GetFinancialSummaryTool(reservationService, interventionService, om);

        jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .subject("user-1")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
        ctx = new AgentContext(1L, "user-1", jwt, "fr", null, null);
    }

    private static Reservation reservation(Long propId, LocalDate checkIn, BigDecimal price) {
        Reservation r = new Reservation();
        Property p = new Property();
        p.setId(propId);
        p.setName("P" + propId);
        r.setProperty(p);
        r.setCheckIn(checkIn);
        r.setCheckOut(checkIn.plusDays(3));
        r.setTotalPrice(price);
        r.setStatus("CONFIRMED");
        return r;
    }

    private static InterventionResponse intervention(String scheduledDate, BigDecimal cost) {
        return InterventionResponse.builder()
                .id(1L)
                .title("Cleaning")
                .scheduledDate(scheduledDate)
                .actualCost(cost)
                .propertyId(10L)
                .build();
    }

    private static InterventionResponse interventionWithStartTime(LocalDateTime start, BigDecimal cost) {
        return InterventionResponse.builder()
                .id(2L)
                .title("Maint")
                .startTime(start)
                .actualCost(cost)
                .propertyId(10L)
                .build();
    }

    @Test
    void name_matchesDescriptor() {
        assertEquals("get_financial_summary", tool.name());
        assertEquals("get_financial_summary", tool.descriptor().name());
        assertFalse(tool.descriptor().requiresConfirmation(), "read-only tool");
    }

    @Test
    void descriptor_hasMonthsAndPropertyIdProperties() {
        JsonNode schema = tool.descriptor().jsonSchema();
        assertEquals("object", schema.path("type").asText());
        assertTrue(schema.path("properties").has("months"));
        assertTrue(schema.path("properties").has("propertyId"));
    }

    @Test
    void nullJwt_throws() {
        AgentContext noJwt = AgentContext.minimal(1L, "u");
        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(om.createObjectNode(), noJwt));
        assertTrue(ex.getMessage().contains("JWT requis"));
        assertEquals("get_financial_summary", ex.getToolName());
    }

    @Nested
    @DisplayName("Defaults and bounds")
    class Defaults {

        @Test
        void noArgs_defaults6Months() throws Exception {
            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenReturn(List.of());
            when(interventionService.listWithRoleBasedAccess(any(), any(), any(), any(),
                    any(), any(), any(), any()))
                    .thenReturn(new PageImpl<>(List.of(), Pageable.ofSize(500), 0));

            ToolResult result = tool.execute(om.createObjectNode(), ctx);
            assertFalse(result.isError());
            assertEquals("chart_bar", result.displayHint());

            JsonNode payload = om.readTree(result.content());
            assertEquals(6, payload.path("items").size());
            assertTrue(payload.path("title").asText().contains("6 mois"));
        }

        @Test
        void months_clampedToMax24() throws Exception {
            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenReturn(List.of());
            when(interventionService.listWithRoleBasedAccess(any(), any(), any(), any(),
                    any(), any(), any(), any()))
                    .thenReturn(new PageImpl<>(List.of(), Pageable.ofSize(500), 0));

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
            when(interventionService.listWithRoleBasedAccess(any(), any(), any(), any(),
                    any(), any(), any(), any()))
                    .thenReturn(new PageImpl<>(List.of(), Pageable.ofSize(500), 0));

            ObjectNode args = om.createObjectNode();
            args.put("months", 0);

            ToolResult result = tool.execute(args, ctx);
            JsonNode payload = om.readTree(result.content());
            assertEquals(1, payload.path("items").size());
        }

        @Test
        void propertyId_forwardedAsList() {
            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenReturn(List.of());
            when(interventionService.listWithRoleBasedAccess(any(), any(), any(), any(),
                    any(), any(), any(), any()))
                    .thenReturn(new PageImpl<>(List.of(), Pageable.ofSize(500), 0));

            ObjectNode args = om.createObjectNode();
            args.put("propertyId", 42);
            args.put("months", 3);

            tool.execute(args, ctx);

            verify(reservationService).getReservations(eq("user-1"), eq(List.of(42L)),
                    any(), any());
            verify(interventionService).listWithRoleBasedAccess(any(),
                    eq(42L), any(), any(), any(), any(), any(), eq(jwt));
        }

        @Test
        void noPropertyId_passesNullToServices() {
            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenReturn(List.of());
            when(interventionService.listWithRoleBasedAccess(any(), any(), any(), any(),
                    any(), any(), any(), any()))
                    .thenReturn(new PageImpl<>(List.of(), Pageable.ofSize(500), 0));

            tool.execute(om.createObjectNode(), ctx);

            verify(reservationService).getReservations(eq("user-1"), isNull(), any(), any());
            verify(interventionService).listWithRoleBasedAccess(any(),
                    isNull(), any(), any(), any(), any(), any(), eq(jwt));
        }
    }

    @Nested
    @DisplayName("Aggregation")
    class Aggregation {

        @Test
        void aggregatesRevenueByMonth() throws Exception {
            LocalDate currentMonth = LocalDate.now().withDayOfMonth(15);
            Reservation r1 = reservation(1L, currentMonth, new BigDecimal("500.00"));
            Reservation r2 = reservation(1L, currentMonth, new BigDecimal("300.00"));
            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenReturn(List.of(r1, r2));
            when(interventionService.listWithRoleBasedAccess(any(), any(), any(), any(),
                    any(), any(), any(), any()))
                    .thenReturn(new PageImpl<>(List.of(), Pageable.ofSize(500), 0));

            ToolResult result = tool.execute(om.createObjectNode(), ctx);
            JsonNode payload = om.readTree(result.content());

            assertEquals(800.0, payload.path("totalRevenue").asDouble(), 0.001);
            assertEquals(0.0, payload.path("totalExpenses").asDouble(), 0.001);
            assertEquals(800.0, payload.path("totalProfit").asDouble(), 0.001);
        }

        @Test
        void aggregatesExpensesViaScheduledDate() throws Exception {
            LocalDate currentMonth = LocalDate.now().withDayOfMonth(10);
            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenReturn(List.of());
            List<InterventionResponse> intvs = List.of(
                    intervention(currentMonth.toString(), new BigDecimal("100.00")),
                    intervention(currentMonth.toString(), new BigDecimal("50.00"))
            );
            when(interventionService.listWithRoleBasedAccess(any(), any(), any(), any(),
                    any(), any(), any(), any()))
                    .thenReturn(new PageImpl<>(intvs, Pageable.ofSize(500), 2));

            ToolResult result = tool.execute(om.createObjectNode(), ctx);
            JsonNode payload = om.readTree(result.content());

            assertEquals(150.0, payload.path("totalExpenses").asDouble(), 0.001);
            assertEquals(-150.0, payload.path("totalProfit").asDouble(), 0.001);
        }

        @Test
        void interventionWithStartTimeFallback_aggregates() throws Exception {
            LocalDate currentMonth = LocalDate.now().withDayOfMonth(10);
            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenReturn(List.of());
            InterventionResponse intv = interventionWithStartTime(
                    LocalDateTime.of(currentMonth, java.time.LocalTime.NOON),
                    new BigDecimal("80.00"));
            when(interventionService.listWithRoleBasedAccess(any(), any(), any(), any(),
                    any(), any(), any(), any()))
                    .thenReturn(new PageImpl<>(List.of(intv), Pageable.ofSize(500), 1));

            ToolResult result = tool.execute(om.createObjectNode(), ctx);
            JsonNode payload = om.readTree(result.content());

            assertEquals(80.0, payload.path("totalExpenses").asDouble(), 0.001);
        }

        @Test
        void interventionWithInvalidScheduledDate_fallsBackToStartTime() throws Exception {
            LocalDate currentMonth = LocalDate.now().withDayOfMonth(5);
            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenReturn(List.of());
            InterventionResponse intv = InterventionResponse.builder()
                    .id(1L)
                    .title("X")
                    .scheduledDate("not-a-date")
                    .startTime(LocalDateTime.of(currentMonth, java.time.LocalTime.NOON))
                    .actualCost(new BigDecimal("40.00"))
                    .build();
            when(interventionService.listWithRoleBasedAccess(any(), any(), any(), any(),
                    any(), any(), any(), any()))
                    .thenReturn(new PageImpl<>(List.of(intv), Pageable.ofSize(500), 1));

            ToolResult result = tool.execute(om.createObjectNode(), ctx);
            JsonNode payload = om.readTree(result.content());
            assertEquals(40.0, payload.path("totalExpenses").asDouble(), 0.001);
        }

        @Test
        void interventionWithNoDateAtAll_skipped() throws Exception {
            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenReturn(List.of());
            InterventionResponse intv = InterventionResponse.builder()
                    .id(1L)
                    .title("X")
                    .actualCost(new BigDecimal("40.00"))
                    .build();
            when(interventionService.listWithRoleBasedAccess(any(), any(), any(), any(),
                    any(), any(), any(), any()))
                    .thenReturn(new PageImpl<>(List.of(intv), Pageable.ofSize(500), 1));

            ToolResult result = tool.execute(om.createObjectNode(), ctx);
            JsonNode payload = om.readTree(result.content());
            assertEquals(0.0, payload.path("totalExpenses").asDouble(), 0.001);
        }

        @Test
        void interventionsOutsideWindow_ignored() throws Exception {
            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenReturn(List.of());
            // Way in the past, outside the 6-month window
            InterventionResponse intv = intervention(LocalDate.of(2000, 1, 1).toString(),
                    new BigDecimal("999.99"));
            when(interventionService.listWithRoleBasedAccess(any(), any(), any(), any(),
                    any(), any(), any(), any()))
                    .thenReturn(new PageImpl<>(List.of(intv), Pageable.ofSize(500), 1));

            ToolResult result = tool.execute(om.createObjectNode(), ctx);
            JsonNode payload = om.readTree(result.content());
            assertEquals(0.0, payload.path("totalExpenses").asDouble(), 0.001);
        }

        @Test
        void reservationsOutsideWindow_ignored() throws Exception {
            Reservation r = reservation(1L, LocalDate.of(2000, 1, 1), new BigDecimal("999"));
            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenReturn(List.of(r));
            when(interventionService.listWithRoleBasedAccess(any(), any(), any(), any(),
                    any(), any(), any(), any()))
                    .thenReturn(new PageImpl<>(List.of(), Pageable.ofSize(500), 0));

            ToolResult result = tool.execute(om.createObjectNode(), ctx);
            JsonNode payload = om.readTree(result.content());
            assertEquals(0.0, payload.path("totalRevenue").asDouble(), 0.001);
        }

        @Test
        void reservationWithoutCheckInOrPrice_skipped() throws Exception {
            Reservation r1 = new Reservation();
            Property p = new Property();
            p.setId(1L);
            r1.setProperty(p);
            r1.setTotalPrice(new BigDecimal("100"));
            // checkIn is null
            Reservation r2 = reservation(1L, LocalDate.now(), null);

            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenReturn(List.of(r1, r2));
            when(interventionService.listWithRoleBasedAccess(any(), any(), any(), any(),
                    any(), any(), any(), any()))
                    .thenReturn(new PageImpl<>(List.of(), Pageable.ofSize(500), 0));

            ToolResult result = tool.execute(om.createObjectNode(), ctx);
            JsonNode payload = om.readTree(result.content());
            assertEquals(0.0, payload.path("totalRevenue").asDouble(), 0.001);
        }
    }

    @Nested
    @DisplayName("Payload structure")
    class PayloadStructure {

        @Test
        void itemsHaveSeriesFields() throws Exception {
            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenReturn(List.of());
            when(interventionService.listWithRoleBasedAccess(any(), any(), any(), any(),
                    any(), any(), any(), any()))
                    .thenReturn(new PageImpl<>(List.of(), Pageable.ofSize(500), 0));

            ToolResult result = tool.execute(om.createObjectNode(), ctx);
            JsonNode payload = om.readTree(result.content());

            JsonNode firstItem = payload.path("items").get(0);
            assertNotNull(firstItem.path("name").asText());
            assertTrue(firstItem.has("revenue"));
            assertTrue(firstItem.has("expenses"));
            assertTrue(firstItem.has("profit"));
        }

        @Test
        void seriesHasThreeColoredSeries() throws Exception {
            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenReturn(List.of());
            when(interventionService.listWithRoleBasedAccess(any(), any(), any(), any(),
                    any(), any(), any(), any()))
                    .thenReturn(new PageImpl<>(List.of(), Pageable.ofSize(500), 0));

            ToolResult result = tool.execute(om.createObjectNode(), ctx);
            JsonNode payload = om.readTree(result.content());

            JsonNode series = payload.path("series");
            assertEquals(3, series.size());
            assertEquals("revenue", series.get(0).path("key").asText());
            assertEquals("expenses", series.get(1).path("key").asText());
            assertEquals("profit", series.get(2).path("key").asText());
        }

        @Test
        void monthNamesAreFrenchAbbreviations() throws Exception {
            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenReturn(List.of());
            when(interventionService.listWithRoleBasedAccess(any(), any(), any(), any(),
                    any(), any(), any(), any()))
                    .thenReturn(new PageImpl<>(List.of(), Pageable.ofSize(500), 0));

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
            assertEquals("get_financial_summary", ex.getToolName());
            assertTrue(ex.getMessage().contains("boom"));
        }

        @Test
        void interventionServiceThrows_wrapped() {
            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenReturn(List.of());
            when(interventionService.listWithRoleBasedAccess(any(), any(), any(), any(),
                    any(), any(), any(), any()))
                    .thenThrow(new RuntimeException("intervention failed"));

            ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                    () -> tool.execute(om.createObjectNode(), ctx));
            assertTrue(ex.getMessage().contains("intervention failed"));
        }
    }
}
