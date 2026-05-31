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
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.security.oauth2.jwt.Jwt;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class GetPropertiesPerformanceToolTest {

    private ReservationService reservationService;
    private InterventionService interventionService;
    private GetPropertiesPerformanceTool tool;
    private ObjectMapper om;
    private AgentContext ctx;
    private Jwt jwt;

    @BeforeEach
    void setUp() {
        reservationService = mock(ReservationService.class);
        interventionService = mock(InterventionService.class);
        om = new ObjectMapper();
        tool = new GetPropertiesPerformanceTool(reservationService, interventionService, om);

        jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .subject("user-1")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
        ctx = new AgentContext(1L, "user-1", jwt, "fr", null, null);
    }

    private static Reservation reservation(Long propId, String name, BigDecimal total) {
        Reservation r = new Reservation();
        Property p = new Property();
        p.setId(propId);
        p.setName(name);
        r.setProperty(p);
        r.setCheckIn(LocalDate.now());
        r.setCheckOut(LocalDate.now().plusDays(3));
        r.setTotalPrice(total);
        return r;
    }

    private static InterventionResponse intervention(Long propId, String propName) {
        return InterventionResponse.builder()
                .id(1L)
                .title("Cleaning")
                .propertyId(propId)
                .propertyName(propName)
                .actualCost(new BigDecimal("50.00"))
                .scheduledDate(LocalDate.now().toString())
                .build();
    }

    @Test
    void name_matchesDescriptor() {
        assertEquals("get_properties_performance", tool.name());
        assertEquals("get_properties_performance", tool.descriptor().name());
        assertFalse(tool.descriptor().requiresConfirmation(), "read-only tool");
    }

    @Test
    void descriptor_hasMonthsAndLimit() {
        JsonNode schema = tool.descriptor().jsonSchema();
        assertEquals("object", schema.path("type").asText());
        assertTrue(schema.path("properties").has("months"));
        assertTrue(schema.path("properties").has("limit"));
    }

    @Test
    void nullJwt_throws() {
        AgentContext noJwt = AgentContext.minimal(1L, "u");
        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(om.createObjectNode(), noJwt));
        assertTrue(ex.getMessage().contains("JWT requis"));
    }

    @Nested
    @DisplayName("Defaults and bounds")
    class Defaults {

        @Test
        void noArgs_defaults10TopAnd6Months() throws Exception {
            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenReturn(List.of());
            when(interventionService.listWithRoleBasedAccess(any(), any(), any(), any(),
                    any(), any(), any(), any()))
                    .thenReturn(new PageImpl<>(List.of(), Pageable.ofSize(500), 0));

            ToolResult result = tool.execute(om.createObjectNode(), ctx);
            assertFalse(result.isError());
            assertEquals("chart_bar", result.displayHint());

            JsonNode payload = om.readTree(result.content());
            assertTrue(payload.path("title").asText().contains("6 mois"));
        }

        @Test
        void limit_clampedToMax20() throws Exception {
            // 25 props, expect at most 20
            List<Reservation> many = new java.util.ArrayList<>();
            for (long i = 1; i <= 25; i++) {
                many.add(reservation(i, "P" + i, new BigDecimal("100")));
            }
            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenReturn(many);
            when(interventionService.listWithRoleBasedAccess(any(), any(), any(), any(),
                    any(), any(), any(), any()))
                    .thenReturn(new PageImpl<>(List.of(), Pageable.ofSize(500), 0));

            ObjectNode args = om.createObjectNode();
            args.put("limit", 999);

            ToolResult result = tool.execute(args, ctx);
            JsonNode payload = om.readTree(result.content());
            assertEquals(20, payload.path("items").size());
            assertEquals(25, payload.path("propertyCount").asInt());
        }

        @Test
        void limit_clampedToMin1() throws Exception {
            List<Reservation> many = List.of(
                    reservation(1L, "A", new BigDecimal("100")),
                    reservation(2L, "B", new BigDecimal("200"))
            );
            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenReturn(many);
            when(interventionService.listWithRoleBasedAccess(any(), any(), any(), any(),
                    any(), any(), any(), any()))
                    .thenReturn(new PageImpl<>(List.of(), Pageable.ofSize(500), 0));

            ObjectNode args = om.createObjectNode();
            args.put("limit", 0);

            ToolResult result = tool.execute(args, ctx);
            JsonNode payload = om.readTree(result.content());
            assertEquals(1, payload.path("items").size());
        }

        @Test
        void months_clampedToMin1() {
            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenReturn(List.of());
            when(interventionService.listWithRoleBasedAccess(any(), any(), any(), any(),
                    any(), any(), any(), any()))
                    .thenReturn(new PageImpl<>(List.of(), Pageable.ofSize(500), 0));

            ObjectNode args = om.createObjectNode();
            args.put("months", 0);

            tool.execute(args, ctx);

            // Verify reservation service called with from = today (1 month, current month only)
            verify(reservationService).getReservations(eq("user-1"), isNull(), any(), any());
        }
    }

    @Nested
    @DisplayName("Aggregation")
    class Aggregation {

        @Test
        void sortsTopRevenueDesc() throws Exception {
            List<Reservation> reservations = List.of(
                    reservation(1L, "Low", new BigDecimal("100")),
                    reservation(2L, "High", new BigDecimal("1000")),
                    reservation(3L, "Mid", new BigDecimal("500"))
            );
            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenReturn(reservations);
            when(interventionService.listWithRoleBasedAccess(any(), any(), any(), any(),
                    any(), any(), any(), any()))
                    .thenReturn(new PageImpl<>(List.of(), Pageable.ofSize(500), 0));

            ToolResult result = tool.execute(om.createObjectNode(), ctx);
            JsonNode payload = om.readTree(result.content());

            JsonNode items = payload.path("items");
            assertEquals(3, items.size());
            assertEquals("High", items.get(0).path("name").asText());
            assertEquals("Mid", items.get(1).path("name").asText());
            assertEquals("Low", items.get(2).path("name").asText());
        }

        @Test
        void mergesMultipleReservationsForSameProperty() throws Exception {
            List<Reservation> reservations = List.of(
                    reservation(1L, "Villa", new BigDecimal("200")),
                    reservation(1L, "Villa", new BigDecimal("300")),
                    reservation(1L, "Villa", new BigDecimal("500"))
            );
            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenReturn(reservations);
            when(interventionService.listWithRoleBasedAccess(any(), any(), any(), any(),
                    any(), any(), any(), any()))
                    .thenReturn(new PageImpl<>(List.of(), Pageable.ofSize(500), 0));

            ToolResult result = tool.execute(om.createObjectNode(), ctx);
            JsonNode payload = om.readTree(result.content());

            JsonNode items = payload.path("items");
            assertEquals(1, items.size());
            assertEquals(1000.0, items.get(0).path("revenue").asDouble(), 0.001);
            assertEquals(3, items.get(0).path("reservations").asInt());
        }

        @Test
        void interventionWithoutReservation_stillCreatesPropertyEntry() throws Exception {
            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenReturn(List.of());
            when(interventionService.listWithRoleBasedAccess(any(), any(), any(), any(),
                    any(), any(), any(), any()))
                    .thenReturn(new PageImpl<>(List.of(intervention(42L, "Solo")),
                            Pageable.ofSize(500), 1));

            ToolResult result = tool.execute(om.createObjectNode(), ctx);
            JsonNode payload = om.readTree(result.content());

            JsonNode items = payload.path("items");
            assertEquals(1, items.size());
            assertEquals("Solo", items.get(0).path("name").asText());
            assertEquals(1, items.get(0).path("interventions").asInt());
        }

        @Test
        void interventionWithoutPropertyName_usesFallback() throws Exception {
            InterventionResponse i = InterventionResponse.builder()
                    .id(1L)
                    .propertyId(7L)
                    .actualCost(new BigDecimal("10"))
                    .build();
            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenReturn(List.of());
            when(interventionService.listWithRoleBasedAccess(any(), any(), any(), any(),
                    any(), any(), any(), any()))
                    .thenReturn(new PageImpl<>(List.of(i), Pageable.ofSize(500), 1));

            ToolResult result = tool.execute(om.createObjectNode(), ctx);
            JsonNode payload = om.readTree(result.content());
            assertEquals("Prop #7", payload.path("items").get(0).path("name").asText());
        }

        @Test
        void interventionWithoutPropertyId_skipped() throws Exception {
            InterventionResponse i = InterventionResponse.builder().id(1L).build();
            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenReturn(List.of());
            when(interventionService.listWithRoleBasedAccess(any(), any(), any(), any(),
                    any(), any(), any(), any()))
                    .thenReturn(new PageImpl<>(List.of(i), Pageable.ofSize(500), 1));

            ToolResult result = tool.execute(om.createObjectNode(), ctx);
            JsonNode payload = om.readTree(result.content());
            assertEquals(0, payload.path("items").size());
        }

        @Test
        void reservationWithoutProperty_skipped() throws Exception {
            Reservation r = new Reservation();
            r.setTotalPrice(new BigDecimal("100"));
            r.setCheckIn(LocalDate.now());
            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenReturn(List.of(r));
            when(interventionService.listWithRoleBasedAccess(any(), any(), any(), any(),
                    any(), any(), any(), any()))
                    .thenReturn(new PageImpl<>(List.of(), Pageable.ofSize(500), 0));

            ToolResult result = tool.execute(om.createObjectNode(), ctx);
            JsonNode payload = om.readTree(result.content());
            assertEquals(0, payload.path("items").size());
        }

        @Test
        void longPropertyName_truncatedTo16Chars() throws Exception {
            Reservation r = reservation(1L, "A super very long property name with lot of text",
                    new BigDecimal("100"));
            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenReturn(List.of(r));
            when(interventionService.listWithRoleBasedAccess(any(), any(), any(), any(),
                    any(), any(), any(), any()))
                    .thenReturn(new PageImpl<>(List.of(), Pageable.ofSize(500), 0));

            ToolResult result = tool.execute(om.createObjectNode(), ctx);
            JsonNode payload = om.readTree(result.content());
            String name = payload.path("items").get(0).path("name").asText();
            assertTrue(name.endsWith("…"), "Truncated name should end with …: " + name);
            assertTrue(name.length() <= 16, "Length: " + name.length());
        }

        @Test
        void reservationWithNullPropertyName_usesPropFallback() throws Exception {
            Property p = new Property();
            p.setId(42L);
            // name = null
            Reservation r = new Reservation();
            r.setProperty(p);
            r.setCheckIn(LocalDate.now());
            r.setTotalPrice(new BigDecimal("100"));

            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenReturn(List.of(r));
            when(interventionService.listWithRoleBasedAccess(any(), any(), any(), any(),
                    any(), any(), any(), any()))
                    .thenReturn(new PageImpl<>(List.of(), Pageable.ofSize(500), 0));

            ToolResult result = tool.execute(om.createObjectNode(), ctx);
            JsonNode payload = om.readTree(result.content());
            assertEquals("Prop #42", payload.path("items").get(0).path("name").asText());
        }

        @Test
        void tieBreakOnInterventionCount() throws Exception {
            Reservation r1 = reservation(1L, "A", new BigDecimal("100"));
            Reservation r2 = reservation(2L, "B", new BigDecimal("100"));
            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenReturn(List.of(r1, r2));
            // B has 3 interventions, A has 1
            when(interventionService.listWithRoleBasedAccess(any(), any(), any(), any(),
                    any(), any(), any(), any()))
                    .thenReturn(new PageImpl<>(List.of(
                            intervention(1L, "A"),
                            intervention(2L, "B"),
                            intervention(2L, "B"),
                            intervention(2L, "B")
                    ), Pageable.ofSize(500), 4));

            ToolResult result = tool.execute(om.createObjectNode(), ctx);
            JsonNode items = om.readTree(result.content()).path("items");

            // Same revenue but B has more interventions
            assertEquals("B", items.get(0).path("name").asText());
            assertEquals("A", items.get(1).path("name").asText());
        }
    }

    @Nested
    @DisplayName("Payload structure")
    class PayloadStructure {

        @Test
        void seriesAreRevenueAndInterventions() throws Exception {
            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenReturn(List.of());
            when(interventionService.listWithRoleBasedAccess(any(), any(), any(), any(),
                    any(), any(), any(), any()))
                    .thenReturn(new PageImpl<>(List.of(), Pageable.ofSize(500), 0));

            ToolResult result = tool.execute(om.createObjectNode(), ctx);
            JsonNode payload = om.readTree(result.content());
            JsonNode series = payload.path("series");
            assertEquals(2, series.size());
            assertEquals("revenue", series.get(0).path("key").asText());
            assertEquals("interventions", series.get(1).path("key").asText());
        }
    }

    @Nested
    @DisplayName("Errors")
    class Errors {

        @Test
        void reservationFailure_wrappedAsToolExecutionException() {
            when(reservationService.getReservations(anyString(), any(), any(), any()))
                    .thenThrow(new RuntimeException("downstream"));

            ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                    () -> tool.execute(om.createObjectNode(), ctx));
            assertEquals("get_properties_performance", ex.getToolName());
            assertTrue(ex.getMessage().contains("downstream"));
        }
    }
}
