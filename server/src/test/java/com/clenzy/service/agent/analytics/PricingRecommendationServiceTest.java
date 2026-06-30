package com.clenzy.service.agent.analytics;

import com.clenzy.model.CalendarDay;
import com.clenzy.model.CalendarDayStatus;
import com.clenzy.model.Property;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.CalendarEngine;
import com.clenzy.service.LocalEventsRegistry;
import com.clenzy.service.PriceEngine;
import com.clenzy.service.SimulationService;
import com.clenzy.service.SimulationService.PricingChangeResult;
import com.clenzy.service.SimulationService.Scenario;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("PricingRecommendationService — reco de prix par créneau validée par simulation")
class PricingRecommendationServiceTest {

    private static final Long ORG = 1L;
    private static final Long PROP = 5L;
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-07-01T10:00:00Z"), ZoneOffset.UTC);
    private static final LocalDate TODAY = LocalDate.of(2026, 7, 1);

    @Mock private CalendarEngine calendarEngine;
    @Mock private PriceEngine priceEngine;
    @Mock private SimulationService simulationService;
    @Mock private PropertyRepository propertyRepository;
    @Mock private LocalEventsRegistry localEventsRegistry;
    @Mock private TenantContext tenantContext;

    private PricingRecommendationService service;

    @BeforeEach
    void setUp() {
        service = new PricingRecommendationService(calendarEngine, priceEngine, simulationService,
                propertyRepository, localEventsRegistry, tenantContext, CLOCK);
        when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG);
        lenient().when(priceEngine.resolvePriceRange(eq(PROP), any(), any(), eq(ORG)))
                .thenReturn(Map.of());
        // Par défaut : pas de localisation → pas d'événement (cas des tests existants).
        lenient().when(propertyRepository.findById(eq(PROP))).thenReturn(java.util.Optional.empty());
    }

    @Test
    @DisplayName("Créneau à occupation très faible + simulation positive → baisse recommandée")
    void lowOccupancy_positiveSim_recommendsDecrease() {
        // 7 jours tous libres → occupation 0 (calendrier vide).
        when(calendarEngine.getDays(eq(PROP), any(), any(), eq(ORG))).thenReturn(List.of());
        when(simulationService.simulatePricingChange(anyString(), eq(PROP), anyDouble(), any(), any()))
                .thenReturn(sim(0.10)); // +10% de revenu projeté

        List<PricingRecommendationService.PriceRecommendation> recs = service.recommend(PROP, 7, "kc");

        assertThat(recs).hasSize(1);
        assertThat(recs.get(0).direction()).isEqualTo("DECREASE");
        assertThat(recs.get(0).suggestedDeltaPct()).isEqualTo(-15);
        assertThat(recs.get(0).simulatedRevenueImpactPct()).isEqualTo(0.10);
    }

    @Test
    @DisplayName("Créneau à occupation élevée + simulation positive → hausse recommandée")
    void highOccupancy_positiveSim_recommendsIncrease() {
        when(calendarEngine.getDays(eq(PROP), any(), any(), eq(ORG))).thenReturn(bookedWeek());
        when(simulationService.simulatePricingChange(anyString(), eq(PROP), anyDouble(), any(), any()))
                .thenReturn(sim(0.05));

        List<PricingRecommendationService.PriceRecommendation> recs = service.recommend(PROP, 7, "kc");

        assertThat(recs).hasSize(1);
        assertThat(recs.get(0).direction()).isEqualTo("INCREASE");
        assertThat(recs.get(0).suggestedDeltaPct()).isEqualTo(8);
    }

    @Test
    @DisplayName("Occupation faible mais simulation revenue-négative → recommandation supprimée")
    void lowOccupancy_negativeSim_suppressed() {
        when(calendarEngine.getDays(eq(PROP), any(), any(), eq(ORG))).thenReturn(List.of());
        when(simulationService.simulatePricingChange(anyString(), eq(PROP), anyDouble(), any(), any()))
                .thenReturn(sim(-0.10)); // baisser nuirait au revenu

        assertThat(service.recommend(PROP, 7, "kc")).isEmpty();
    }

    @Test
    @DisplayName("Occupation moyenne → aucune recommandation (et pas d'appel simulation)")
    void midOccupancy_noRecommendation() {
        // 4 réservés / 7 → occupation ~0.57, entre les seuils.
        List<CalendarDay> days = new ArrayList<>();
        for (int i = 0; i < 4; i++) {
            days.add(day(TODAY.plusDays(i), CalendarDayStatus.BOOKED));
        }
        when(calendarEngine.getDays(eq(PROP), any(), any(), eq(ORG))).thenReturn(days);

        assertThat(service.recommend(PROP, 7, "kc")).isEmpty();
    }

    @Test
    @DisplayName("Événement local sur le créneau → baisse atténuée (demande attendue)")
    void localEvent_attenuatesDiscount() {
        Property p = new Property();
        p.setId(PROP);
        p.setCity("Paris");
        p.setOrganizationId(ORG);
        when(propertyRepository.findById(eq(PROP))).thenReturn(java.util.Optional.of(p));

        LocalEventsRegistry.LocalEvent ev = new LocalEventsRegistry.LocalEvent();
        ev.title = "Festival Jazz";
        ev.date = TODAY.plusDays(2);
        when(localEventsRegistry.findByCityAndDateRange(any(), any(), any(), any()))
                .thenReturn(List.of(ev));

        when(calendarEngine.getDays(eq(PROP), any(), any(), eq(ORG))).thenReturn(List.of()); // occupation 0
        when(simulationService.simulatePricingChange(anyString(), eq(PROP), anyDouble(), any(), any()))
                .thenReturn(sim(0.10));

        List<PricingRecommendationService.PriceRecommendation> recs = service.recommend(PROP, 7, "kc");

        assertThat(recs).hasSize(1);
        assertThat(recs.get(0).direction()).isEqualTo("DECREASE");
        assertThat(recs.get(0).suggestedDeltaPct()).isEqualTo(-7); // -15 atténué de moitié
        assertThat(recs.get(0).events()).contains("Festival Jazz");
        assertThat(recs.get(0).reason()).contains("événement");
    }

    // ─── helpers ──────────────────────────────────────────────────────────────

    private static List<CalendarDay> bookedWeek() {
        List<CalendarDay> days = new ArrayList<>();
        for (int i = 0; i < 7; i++) {
            days.add(day(TODAY.plusDays(i), CalendarDayStatus.BOOKED));
        }
        return days;
    }

    private static CalendarDay day(LocalDate date, CalendarDayStatus status) {
        CalendarDay d = new CalendarDay();
        d.setDate(date);
        d.setStatus(status);
        return d;
    }

    private static PricingChangeResult sim(double pctRevenueChange) {
        Scenario sc = new Scenario(100.0, 0.5, 3L, BigDecimal.valueOf(300));
        return new PricingChangeResult(PROP, "Villa A", 0.0,
                TODAY, TODAY.plusDays(6), 7L, 0.5, "DEFAULT",
                sc, sc, BigDecimal.ZERO, 0.0, pctRevenueChange, "ok");
    }
}
