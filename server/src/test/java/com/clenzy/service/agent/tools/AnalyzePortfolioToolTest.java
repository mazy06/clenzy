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
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class AnalyzePortfolioToolTest {

    private PropertyService propertyService;
    private ReservationService reservationService;
    private GuestReviewRepository reviewRepo;
    private com.clenzy.service.agent.portfolio.PortfolioConfig portfolioConfig;
    private com.clenzy.service.agent.portfolio.PortfolioPatternEvaluator patternEvaluator;
    private AnalyzePortfolioTool tool;
    private ObjectMapper om;
    private AgentContext ctx;

    @BeforeEach
    void setUp() {
        propertyService = mock(PropertyService.class);
        reservationService = mock(ReservationService.class);
        reviewRepo = mock(GuestReviewRepository.class);
        om = new ObjectMapper();
        portfolioConfig = new com.clenzy.service.agent.portfolio.PortfolioConfig();
        // Defaut : pas de patterns (les tests qui veulent les tester surchargent)
        patternEvaluator = mock(com.clenzy.service.agent.portfolio.PortfolioPatternEvaluator.class);
        when(patternEvaluator.evaluateAll(any())).thenReturn(java.util.List.of());

        tool = new AnalyzePortfolioTool(propertyService, reservationService, reviewRepo,
                portfolioConfig, patternEvaluator, om);
        ctx = AgentContext.minimal(1L, "user-123");
        when(reviewRepo.averageRatingByPropertyId(anyLong(), anyLong())).thenReturn(null);
        // Batch query (nouveau path) : retourne liste vide par defaut, surchargee
        // dans les tests qui veulent valider la propagation des ratings
        when(reviewRepo.averageRatingByPropertyIds(anyList(), anyLong()))
                .thenReturn(java.util.List.of());
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
    void cancelledReservations_excludedFromRevenue_andPassedToPatternEvaluator() throws Exception {
        LocalDate today = LocalDate.now();
        LocalDate within = today.minusDays(10);
        LocalDate withinEnd = today.minusDays(5);

        when(propertyService.list()).thenReturn(List.of(
                property(1L, "Loft Paris", "Paris", PropertyStatus.ACTIVE)
        ));
        when(reservationService.getReservations(eq("user-123"), any(), any(), any())).thenReturn(List.of(
                reservation(1L, "Loft Paris", within, withinEnd, new BigDecimal("100"), "confirmed"),
                reservation(1L, "Loft Paris", within, withinEnd, new BigDecimal("100"), "cancelled"),
                reservation(1L, "Loft Paris", within, withinEnd, new BigDecimal("100"), "cancelled"),
                reservation(1L, "Loft Paris", within, withinEnd, new BigDecimal("100"), "cancelled")
        ));
        // Le pattern evaluator mocke retourne le HIGH_CANCELLATION_RATE pour ce cas
        when(patternEvaluator.evaluateAll(any())).thenReturn(java.util.List.of(
                java.util.Map.of("type", "HIGH_CANCELLATION_RATE", "severity", "HIGH",
                        "title", "Taux d'annulation eleve",
                        "description", "1 propriete(s) avec >20%",
                        "items", java.util.List.of("Loft Paris (75%)"))));

        ToolResult result = tool.execute(om.createObjectNode(), ctx);
        JsonNode payload = om.readTree(result.content());

        // Revenue uniquement de la confirmed (cancelled excluse)
        assertEquals(100.0, payload.path("totalRevenue").asDouble(), 0.001);

        // Le pattern remonte par l'evaluator est present dans le payload
        JsonNode patterns = payload.path("patterns");
        assertEquals(1, patterns.size());
        assertEquals("HIGH_CANCELLATION_RATE", patterns.get(0).path("type").asText());

        // Verify : le tool a transmis les cancelled au evaluator (via PortfolioInput)
        org.mockito.ArgumentCaptor<com.clenzy.service.agent.portfolio.PortfolioPatternDetector.PortfolioInput> cap =
                org.mockito.ArgumentCaptor.forClass(
                        com.clenzy.service.agent.portfolio.PortfolioPatternDetector.PortfolioInput.class);
        verify(patternEvaluator).evaluateAll(cap.capture());
        var props = cap.getValue().properties();
        assertEquals(1, props.size());
        assertEquals(4, props.get(0).totalReservations());
        assertEquals(3, props.get(0).cancelledReservations());
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
    void ratings_flowIntoPatternEvaluatorInput() throws Exception {
        when(propertyService.list()).thenReturn(List.of(
                property(1L, "Loft Marseille", "Marseille", PropertyStatus.ACTIVE),
                property(2L, "Villa Lyon", "Lyon", PropertyStatus.ACTIVE)
        ));
        when(reservationService.getReservations(any(), any(), any(), any())).thenReturn(List.of());
        // Batch query : retourne les 2 ratings en une fois
        when(reviewRepo.averageRatingByPropertyIds(anyList(), anyLong()))
                .thenReturn(java.util.List.of(
                        new Object[]{1L, 2.5},
                        new Object[]{2L, 4.5}
                ));

        tool.execute(om.createObjectNode(), ctx);

        // Verify : les ratings sont transmis au evaluator (detection delegated)
        org.mockito.ArgumentCaptor<com.clenzy.service.agent.portfolio.PortfolioPatternDetector.PortfolioInput> cap =
                org.mockito.ArgumentCaptor.forClass(
                        com.clenzy.service.agent.portfolio.PortfolioPatternDetector.PortfolioInput.class);
        verify(patternEvaluator).evaluateAll(cap.capture());
        java.util.Map<Long, Double> ratingsById = new java.util.HashMap<>();
        for (var m : cap.getValue().properties()) {
            ratingsById.put(m.id(), m.avgRating());
        }
        assertEquals(2.5, ratingsById.get(1L), 0.001);
        assertEquals(4.5, ratingsById.get(2L), 0.001);
    }

    @Test
    void comparePrevious_includesDeltasFromPreviousPeriod() throws Exception {
        LocalDate today = LocalDate.now();
        when(propertyService.list()).thenReturn(List.of(
                property(1L, "P", "Paris", PropertyStatus.ACTIVE)
        ));
        // Premiere fetch : periode courante (last 30 days)
        // Seconde fetch : periode N-1 (30j avant)
        // On stub par range pour les distinguer
        when(reservationService.getReservations(any(),
                any(),
                org.mockito.ArgumentMatchers.argThat(d -> d != null && d.isAfter(today.minusDays(31))),
                org.mockito.ArgumentMatchers.argThat(d -> d != null && (d.isEqual(today) || d.isAfter(today.minusDays(1))))))
                .thenReturn(List.of(
                        reservation(1L, "P", today.minusDays(15), today.minusDays(10),
                                new BigDecimal("500"), "confirmed")));
        when(reservationService.getReservations(any(),
                any(),
                org.mockito.ArgumentMatchers.argThat(d -> d != null && d.isBefore(today.minusDays(30))),
                org.mockito.ArgumentMatchers.argThat(d -> d != null && d.isBefore(today.minusDays(1)))))
                .thenReturn(List.of(
                        reservation(1L, "P", today.minusDays(45), today.minusDays(40),
                                new BigDecimal("300"), "confirmed")));

        ToolResult result = tool.execute(om.createObjectNode(), ctx);
        JsonNode payload = om.readTree(result.content());

        // Section deltas presente avec une variation calculee
        JsonNode deltas = payload.path("deltas");
        assertFalse(deltas.isMissingNode(), "deltas should be present when comparePrevious=true");
        // revenue current = 500, previous = 300 → delta = 200
        assertEquals(200.0, deltas.path("revenue").asDouble(), 0.5);
        assertTrue(deltas.path("revenuePct").asDouble() > 0.5, "pct > 50%");
    }

    @Test
    void comparePreviousFalse_skipsSecondFetch() throws Exception {
        when(propertyService.list()).thenReturn(List.of(
                property(1L, "P", "Paris", PropertyStatus.ACTIVE)
        ));
        when(reservationService.getReservations(any(), any(), any(), any())).thenReturn(List.of());

        com.fasterxml.jackson.databind.node.ObjectNode args = om.createObjectNode();
        args.put("comparePrevious", false);
        ToolResult result = tool.execute(args, ctx);
        JsonNode payload = om.readTree(result.content());

        // Pas de section deltas
        assertTrue(payload.path("deltas").isMissingNode());
        // Une seule lookup reservation (pas de phase 2)
        verify(reservationService, times(1)).getReservations(any(), any(), any(), any());
    }

    @Test
    void portfolioConfig_topN_appliedToTopPerformers() throws Exception {
        portfolioConfig.setTopN(2); // Override defaut 3 → ne garde que 2
        LocalDate today = LocalDate.now();
        when(propertyService.list()).thenReturn(List.of(
                property(1L, "A", "Paris", PropertyStatus.ACTIVE),
                property(2L, "B", "Lyon", PropertyStatus.ACTIVE),
                property(3L, "C", "Nice", PropertyStatus.ACTIVE),
                property(4L, "D", "Marseille", PropertyStatus.ACTIVE)
        ));
        when(reservationService.getReservations(any(), any(), any(), any())).thenReturn(List.of(
                reservation(1L, "A", today.minusDays(10), today.minusDays(5),
                        new BigDecimal("100"), "confirmed"),
                reservation(2L, "B", today.minusDays(10), today.minusDays(5),
                        new BigDecimal("400"), "confirmed"),
                reservation(3L, "C", today.minusDays(10), today.minusDays(5),
                        new BigDecimal("300"), "confirmed"),
                reservation(4L, "D", today.minusDays(10), today.minusDays(5),
                        new BigDecimal("200"), "confirmed")
        ));

        ToolResult result = tool.execute(om.createObjectNode(), ctx);
        JsonNode payload = om.readTree(result.content());

        // topN=2 → seulement les 2 meilleurs (B puis C)
        JsonNode top = payload.path("topPerformers");
        assertEquals(2, top.size());
        assertEquals("B", top.get(0).path("name").asText());
        assertEquals("C", top.get(1).path("name").asText());
    }

    @Test
    void portfolioConfig_underPerformerThreshold_appliesCustomLimit() throws Exception {
        portfolioConfig.setUnderPerformerOccupancy(0.80); // tres haut → presque tout flag

        when(propertyService.list()).thenReturn(List.of(
                property(1L, "A", "Paris", PropertyStatus.ACTIVE)
        ));
        LocalDate today = LocalDate.now();
        when(reservationService.getReservations(any(), any(), any(), any())).thenReturn(List.of(
                reservation(1L, "A", today.minusDays(20), today.minusDays(5),
                        new BigDecimal("1500"), "confirmed") // 15 nuits / 30 = 50%
        ));

        ToolResult result = tool.execute(om.createObjectNode(), ctx);
        JsonNode payload = om.readTree(result.content());

        // 50% < 80% → flag underperformer (alors qu'avec defaut 0.5 ce serait pas le cas)
        assertEquals(1, payload.path("underPerformers").size());
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
