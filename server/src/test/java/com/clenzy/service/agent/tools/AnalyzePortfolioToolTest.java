package com.clenzy.service.agent.tools;

import com.clenzy.dto.PropertyDto;
import com.clenzy.model.Property;
import com.clenzy.model.PropertyStatus;
import com.clenzy.model.Reservation;
import com.clenzy.repository.GuestReviewRepository;
import com.clenzy.service.PropertyService;
import com.clenzy.service.ReservationService;
import com.clenzy.service.agent.AgentContext;
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
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class AnalyzePortfolioToolTest {

    private PropertyService propertyService;
    private ReservationService reservationService;
    private GuestReviewRepository reviewRepo;
    private AnalyzePortfolioTool tool;
    private ObjectMapper om;
    private AgentContext ctx;

    @BeforeEach
    void setUp() {
        propertyService = mock(PropertyService.class);
        reservationService = mock(ReservationService.class);
        reviewRepo = mock(GuestReviewRepository.class);
        om = new ObjectMapper();
        tool = new AnalyzePortfolioTool(propertyService, reservationService, reviewRepo, om);
        ctx = AgentContext.minimal(1L, "user-123");
        when(reviewRepo.averageRatingByPropertyId(anyLong(), anyLong())).thenReturn(null);
    }

    private static PropertyDto property(Long id, String name, String city, PropertyStatus status) {
        PropertyDto p = new PropertyDto();
        p.id = id;
        p.name = name;
        p.city = city;
        p.status = status;
        return p;
    }

    private static Reservation reservation(Long propertyId, String propertyName,
                                            LocalDate checkIn, LocalDate checkOut,
                                            BigDecimal totalPrice, String status) {
        Property prop = new Property();
        prop.setId(propertyId);
        prop.setName(propertyName);
        Reservation r = new Reservation();
        r.setProperty(prop);
        r.setCheckIn(checkIn);
        r.setCheckOut(checkOut);
        r.setTotalPrice(totalPrice);
        r.setStatus(status);
        return r;
    }

    @Test
    void name_andDescriptor_consistent() {
        assertEquals("analyze_portfolio", tool.name());
        assertEquals("analyze_portfolio", tool.descriptor().name());
        assertFalse(tool.descriptor().requiresConfirmation());
    }

    @Test
    void emptyPortfolio_returnsZeroes() throws Exception {
        when(propertyService.list()).thenReturn(List.of());

        ToolResult result = tool.execute(om.createObjectNode(), ctx);

        assertFalse(result.isError());
        assertEquals("portfolio_overview", result.displayHint());

        JsonNode payload = om.readTree(result.content());
        assertEquals(0, payload.path("totalProperties").asInt());
        assertEquals(0.0, payload.path("totalRevenue").asDouble());
        assertEquals(0, payload.path("topPerformers").size());
        assertEquals(0, payload.path("patterns").size());
    }

    @Test
    void aggregatesRevenueAndSortsTopPerformersByRevenue() throws Exception {
        LocalDate today = LocalDate.now();
        LocalDate within = today.minusDays(10);
        LocalDate withinEnd = today.minusDays(5);

        when(propertyService.list()).thenReturn(List.of(
                property(1L, "Loft Paris", "Paris", PropertyStatus.ACTIVE),
                property(2L, "Studio Lyon", "Lyon", PropertyStatus.ACTIVE),
                property(3L, "Villa Nice", "Nice", PropertyStatus.ACTIVE)
        ));
        when(reservationService.getReservations(eq("user-123"), any(), any(), any())).thenReturn(List.of(
                reservation(1L, "Loft Paris", within, withinEnd, new BigDecimal("500"), "confirmed"),
                reservation(2L, "Studio Lyon", within, withinEnd, new BigDecimal("1200"), "confirmed"),
                reservation(3L, "Villa Nice", within, withinEnd, new BigDecimal("300"), "confirmed")
        ));

        ToolResult result = tool.execute(om.createObjectNode(), ctx);
        JsonNode payload = om.readTree(result.content());

        // totalRevenue = 500+1200+300
        assertEquals(2000.0, payload.path("totalRevenue").asDouble(), 0.001);

        JsonNode top = payload.path("topPerformers");
        assertEquals(3, top.size());
        // Sort DESC : Studio Lyon (1200) > Loft Paris (500) > Villa Nice (300)
        assertEquals("Studio Lyon", top.get(0).path("name").asText());
        assertEquals(1200.0, top.get(0).path("revenue").asDouble(), 0.001);
        assertEquals("Loft Paris", top.get(1).path("name").asText());
        assertEquals("Villa Nice", top.get(2).path("name").asText());
    }

    @Test
    void cancelledReservations_excludedFromRevenue_butCountTowardCancelRate() throws Exception {
        LocalDate today = LocalDate.now();
        LocalDate within = today.minusDays(10);
        LocalDate withinEnd = today.minusDays(5);

        when(propertyService.list()).thenReturn(List.of(
                property(1L, "Loft Paris", "Paris", PropertyStatus.ACTIVE)
        ));
        // 4 reservations dont 1 confirmed + 3 cancelled → cancelRate = 75% → pattern
        when(reservationService.getReservations(eq("user-123"), any(), any(), any())).thenReturn(List.of(
                reservation(1L, "Loft Paris", within, withinEnd, new BigDecimal("100"), "confirmed"),
                reservation(1L, "Loft Paris", within, withinEnd, new BigDecimal("100"), "cancelled"),
                reservation(1L, "Loft Paris", within, withinEnd, new BigDecimal("100"), "cancelled"),
                reservation(1L, "Loft Paris", within, withinEnd, new BigDecimal("100"), "cancelled")
        ));

        ToolResult result = tool.execute(om.createObjectNode(), ctx);
        JsonNode payload = om.readTree(result.content());

        // Revenue uniquement de la confirmed
        assertEquals(100.0, payload.path("totalRevenue").asDouble(), 0.001);

        // Pattern HIGH_CANCELLATION_RATE detecte (4 reservations, 3 cancelled = 75%)
        JsonNode patterns = payload.path("patterns");
        boolean foundCancelPattern = false;
        for (JsonNode p : patterns) {
            if ("HIGH_CANCELLATION_RATE".equals(p.path("type").asText())) {
                foundCancelPattern = true;
                break;
            }
        }
        assertTrue(foundCancelPattern, "Pattern volatilite doit etre detecte");
    }

    @Test
    void underPerformers_includesActivePropertiesWithLowOccupancy_andCarriesReasonAndRecommendation()
            throws Exception {
        when(propertyService.list()).thenReturn(List.of(
                property(1L, "Loft inactif", "Paris", PropertyStatus.ACTIVE), // 0 resa
                property(2L, "Villa OK", "Nice", PropertyStatus.ACTIVE) // 30 nuits/30j → 100%
        ));
        // Villa Nice : un seul long sejour qui couvre 30 jours → occupancy haut
        LocalDate today = LocalDate.now();
        when(reservationService.getReservations(any(), any(), any(), any())).thenReturn(List.of(
                reservation(2L, "Villa OK", today.minusDays(30), today,
                        new BigDecimal("4500"), "confirmed")
        ));

        ToolResult result = tool.execute(om.createObjectNode(), ctx);
        JsonNode payload = om.readTree(result.content());

        JsonNode under = payload.path("underPerformers");
        // Seule Loft inactif est sous-performante (0 reservations)
        assertEquals(1, under.size());
        assertEquals("Loft inactif", under.get(0).path("name").asText());
        assertEquals(0.0, under.get(0).path("occupancy").asDouble(), 0.001);
        assertTrue(under.get(0).has("reason"));
        assertTrue(under.get(0).has("recommendation"));
        assertTrue(under.get(0).path("reason").asText().toLowerCase().contains("aucune"));
    }

    @Test
    void inactiveProperties_excludedFromUnderPerformers() throws Exception {
        when(propertyService.list()).thenReturn(List.of(
                property(1L, "Archivee", "Paris", PropertyStatus.ARCHIVED),
                property(2L, "En maintenance", "Lyon", PropertyStatus.UNDER_MAINTENANCE)
        ));
        when(reservationService.getReservations(any(), any(), any(), any())).thenReturn(List.of());

        ToolResult result = tool.execute(om.createObjectNode(), ctx);
        JsonNode payload = om.readTree(result.content());

        // Aucune propriete ACTIVE → activeProperties = 0, pas de sous-performants
        assertEquals(0, payload.path("activeProperties").asInt());
        assertEquals(0, payload.path("underPerformers").size());
        // mais bien comptees dans le total
        assertEquals(2, payload.path("totalProperties").asInt());
    }

    @Test
    void citySatisfactionLow_patternDetected_whenAvgRatingBelow35() throws Exception {
        when(propertyService.list()).thenReturn(List.of(
                property(1L, "Loft Marseille", "Marseille", PropertyStatus.ACTIVE),
                property(2L, "Studio Marseille", "Marseille", PropertyStatus.ACTIVE),
                property(3L, "Villa Lyon", "Lyon", PropertyStatus.ACTIVE)
        ));
        when(reservationService.getReservations(any(), any(), any(), any())).thenReturn(List.of());
        // Marseille 2.5 et 3.0 → moyenne 2.75 < 3.5 → pattern
        // Lyon 4.5 → OK, pas de pattern
        when(reviewRepo.averageRatingByPropertyId(eq(1L), anyLong())).thenReturn(2.5);
        when(reviewRepo.averageRatingByPropertyId(eq(2L), anyLong())).thenReturn(3.0);
        when(reviewRepo.averageRatingByPropertyId(eq(3L), anyLong())).thenReturn(4.5);

        ToolResult result = tool.execute(om.createObjectNode(), ctx);
        JsonNode payload = om.readTree(result.content());

        JsonNode patterns = payload.path("patterns");
        boolean foundCity = false;
        for (JsonNode p : patterns) {
            if ("CITY_SATISFACTION_LOW".equals(p.path("type").asText())) {
                foundCity = true;
                // Marseille est dans les items
                JsonNode items = p.path("items");
                assertTrue(items.size() >= 1);
                String concat = items.toString();
                assertTrue(concat.contains("Marseille"));
                assertFalse(concat.contains("Lyon"), "Lyon est au dessus du seuil");
            }
        }
        assertTrue(foundCity, "Pattern CITY_SATISFACTION_LOW doit etre detecte");
    }

    @Test
    void daysBackArg_isHonored_andClamped() throws Exception {
        when(propertyService.list()).thenReturn(List.of());

        ObjectNode args = om.createObjectNode();
        args.put("daysBack", 90);
        ToolResult result = tool.execute(args, ctx);
        JsonNode payload = om.readTree(result.content());
        assertEquals(90, payload.path("daysBack").asInt());

        // Clamp haut a 365
        args.put("daysBack", 9999);
        result = tool.execute(args, ctx);
        payload = om.readTree(result.content());
        assertEquals(365, payload.path("daysBack").asInt());

        // Clamp bas a 1
        args.put("daysBack", -5);
        result = tool.execute(args, ctx);
        payload = om.readTree(result.content());
        assertEquals(1, payload.path("daysBack").asInt());
    }

    @Test
    void avgADR_isRevenuePerBookedNight() throws Exception {
        when(propertyService.list()).thenReturn(List.of(
                property(1L, "P1", "Paris", PropertyStatus.ACTIVE)
        ));
        LocalDate today = LocalDate.now();
        // 1 reservation de 5 nuits a 500 → ADR 100
        when(reservationService.getReservations(any(), any(), any(), any())).thenReturn(List.of(
                reservation(1L, "P1", today.minusDays(10), today.minusDays(5),
                        new BigDecimal("500"), "confirmed")
        ));

        ToolResult result = tool.execute(om.createObjectNode(), ctx);
        JsonNode payload = om.readTree(result.content());

        assertEquals(100.0, payload.path("avgADR").asDouble(), 0.001);
    }

    @Test
    void serviceFailure_propagatedAsToolError() {
        when(propertyService.list()).thenThrow(new RuntimeException("DB down"));

        com.clenzy.service.agent.ToolExecutionException ex = assertThrows(
                com.clenzy.service.agent.ToolExecutionException.class,
                () -> tool.execute(om.createObjectNode(), ctx));
        assertTrue(ex.getMessage().contains("DB down")
                || ex.getMessage().toLowerCase().contains("portefeuille"));
    }

    // helper pour ne pas importer eq() globalement
    private static <T> T eq(T value) { return org.mockito.ArgumentMatchers.eq(value); }
    @SuppressWarnings("unused")
    private static void ensureUsed() {
        // anti-warning : utiliser anyString pour montrer qu'il est dispo si besoin
        anyString();
    }
}
