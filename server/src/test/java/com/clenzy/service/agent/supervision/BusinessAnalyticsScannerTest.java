package com.clenzy.service.agent.supervision;

import com.clenzy.dto.PropertyPerformanceDto;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.SupervisionModuleSettingsRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Heuristiques déterministes par logement → cartes HITL. Vérifie que l'occupation à venir
 * faible carde le logement (baisse tarifaire actionnable + impact €) et que la sous-performance
 * rétrospective est alignée sur /reports (seuil < 40 %).
 */
@ExtendWith(MockitoExtension.class)
class BusinessAnalyticsScannerTest {

    private static final Long ORG = 1L;
    private static final Long PROP = 3L;

    @Mock private com.clenzy.service.PropertyPerformanceService performanceService;
    @Mock private SupervisionSuggestionService suggestionService;
    @Mock private ReservationRepository reservationRepository;
    @Mock private SupervisionModuleSettingsRepository moduleSettingsRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Clock clock = Clock.fixed(Instant.parse("2026-07-08T10:00:00Z"), ZoneOffset.UTC);

    private BusinessAnalyticsScanner scanner() {
        return new BusinessAnalyticsScanner(performanceService, suggestionService,
                reservationRepository, moduleSettingsRepository, objectMapper, clock);
    }

    private PropertyPerformanceDto perf(double occ, String revenue, double margin) {
        return new PropertyPerformanceDto(PROP, "Duplex", 0, BigDecimal.ZERO, occ,
                new BigDecimal(revenue), margin, 90);
    }

    @Test
    void lowForwardOccupancy_withFreeGaps_emitsMultiSegmentPriceDropWithImpact() {
        when(moduleSettingsRepository.findByOrganizationIdAndModuleKey(ORG, "rev")).thenReturn(Optional.empty());
        when(performanceService.compute(PROP)).thenReturn(perf(20.0, "5000", 70.0));
        when(performanceService.forwardOccupancyRate(PROP, 90)).thenReturn(30.0); // < 55 → creux à venir
        when(reservationRepository.findByPropertyId(PROP, ORG)).thenReturn(List.of()); // aucun booking → 90 j libres

        scanner().scanProperty(ORG, PROP);

        // Carte actionnable multi-segment (PRICE_DROP), impact € strictement positif ; les
        // params portent un tableau "segments".
        ArgumentCaptor<String> params = ArgumentCaptor.forClass(String.class);
        verify(suggestionService).recordActionable(eq(ORG), eq(PROP), eq("rev"),
                eq("Optimiser les tarifs des créneaux creux à venir"), anyString(),
                eq(SupervisionActionType.PRICE_DROP), params.capture(),
                argThat(c -> c != null && c > 0), eq("warning"));
        assertThat(params.getValue()).contains("\"segments\"");
    }

    @Test
    void lowRetroOccupancy_whenForwardHealthy_emitsUnderperformanceAlignedTo40() {
        when(moduleSettingsRepository.findByOrganizationIdAndModuleKey(ORG, "rev")).thenReturn(Optional.empty());
        when(performanceService.compute(PROP)).thenReturn(perf(35.0, "5000", 70.0)); // rétro 35 % (< 40)
        when(performanceService.forwardOccupancyRate(PROP, 90)).thenReturn(70.0); // à venir OK → pas de carte forward

        scanner().scanProperty(ORG, PROP);

        verify(suggestionService).recordActionable(eq(ORG), eq(PROP), eq("rev"),
                eq("Logement en sous-performance"), anyString(), isNull(), isNull(),
                argThat(c -> c != null && c > 0), eq("info"));
        // Pas d'action de prix (pas de creux à venir).
        verify(reservationRepository, never()).findByPropertyId(any(), any());
    }
}
