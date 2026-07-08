package com.clenzy.service.agent.supervision;

import com.clenzy.dto.PropertyPerformanceDto;
import com.clenzy.model.Reservation;
import com.clenzy.repository.CalendarDayRepository;
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
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Heuristiques déterministes par logement → cartes HITL. L'occupation (avant ET rétro) inclut
 * réservations ET jours calendrier indisponibles (BOOKED/BLOCKED) : un blocage (résa hors
 * OTA/Baitly, blocage manuel) n'est ni proposé à l'ajustement, ni compté en sous-performance.
 */
@ExtendWith(MockitoExtension.class)
class BusinessAnalyticsScannerTest {

    private static final Long ORG = 1L;
    private static final Long PROP = 3L;

    @Mock private com.clenzy.service.PropertyPerformanceService performanceService;
    @Mock private SupervisionSuggestionService suggestionService;
    @Mock private ReservationRepository reservationRepository;
    @Mock private CalendarDayRepository calendarDayRepository;
    @Mock private SupervisionModuleSettingsRepository moduleSettingsRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Clock clock = Clock.fixed(Instant.parse("2026-07-08T10:00:00Z"), ZoneOffset.UTC);

    private BusinessAnalyticsScanner scanner() {
        return new BusinessAnalyticsScanner(performanceService, suggestionService,
                reservationRepository, calendarDayRepository, moduleSettingsRepository, objectMapper, clock);
    }

    private PropertyPerformanceDto perf(double occ, String revenue, double margin) {
        return new PropertyPerformanceDto(PROP, "Duplex", 0, BigDecimal.ZERO, occ,
                new BigDecimal(revenue), margin, 90);
    }

    private Reservation reservation(String checkIn, String checkOut) {
        Reservation r = new Reservation();
        r.setCheckIn(LocalDate.parse(checkIn));
        r.setCheckOut(LocalDate.parse(checkOut));
        r.setStatus("confirmed");
        return r;
    }

    @Test
    void lowForwardOccupancy_withFreeGaps_emitsMultiSegmentPriceDropWithImpact() {
        when(moduleSettingsRepository.findByOrganizationIdAndModuleKey(ORG, "rev")).thenReturn(Optional.empty());
        when(performanceService.compute(PROP)).thenReturn(perf(20.0, "5000", 70.0));
        when(reservationRepository.findByPropertyId(PROP, ORG)).thenReturn(List.of());
        when(calendarDayRepository.findUnavailableDatesInRange(eq(PROP), any(), any(), eq(ORG))).thenReturn(List.of());

        scanner().scanProperty(ORG, PROP);

        ArgumentCaptor<String> params = ArgumentCaptor.forClass(String.class);
        verify(suggestionService).recordActionable(eq(ORG), eq(PROP), eq("rev"),
                eq("Optimiser les tarifs des créneaux creux à venir"), anyString(),
                eq(SupervisionActionType.PRICE_DROP), params.capture(),
                argThat(c -> c != null && c > 0), eq("warning"));
        assertThat(params.getValue()).contains("\"segments\"");
        assertThat(params.getValue()).contains("\"direction\":\"down\"");
    }

    @Test
    void lowRetroOccupancy_whenForwardHealthy_emitsUnderperformanceAlignedTo40() {
        when(moduleSettingsRepository.findByOrganizationIdAndModuleKey(ORG, "rev")).thenReturn(Optional.empty());
        when(performanceService.compute(PROP)).thenReturn(perf(35.0, "5000", 70.0));
        // Résa qui remplit la fenêtre À VENIR (occ forward ~99 %) mais ne couvre qu'1 nuit du rétro.
        when(reservationRepository.findByPropertyId(PROP, ORG))
                .thenReturn(List.of(reservation("2026-07-08", "2026-10-06")));
        when(calendarDayRepository.findUnavailableDatesInRange(eq(PROP), any(), any(), eq(ORG))).thenReturn(List.of());

        scanner().scanProperty(ORG, PROP);

        verify(suggestionService).recordActionable(eq(ORG), eq(PROP), eq("rev"),
                eq("Logement en sous-performance"), anyString(), isNull(), isNull(),
                argThat(c -> c != null && c > 0), eq("info"));
    }

    @Test
    void fullyUnavailableForwardAndRetro_emitsNoCard() {
        // Toutes les nuits (avant + rétro) sont indisponibles (BOOKED/BLOCKED) → occupation 100 %
        // partout → aucune remise proposée et aucune sous-performance.
        when(moduleSettingsRepository.findByOrganizationIdAndModuleKey(ORG, "rev")).thenReturn(Optional.empty());
        when(performanceService.compute(PROP)).thenReturn(perf(20.0, "5000", 70.0));
        when(reservationRepository.findByPropertyId(PROP, ORG)).thenReturn(List.of());
        when(calendarDayRepository.findUnavailableDatesInRange(eq(PROP), any(), any(), eq(ORG)))
                .thenAnswer(inv -> datesInRange(inv.getArgument(1), inv.getArgument(2), null, null));

        scanner().scanProperty(ORG, PROP);

        verifyNoInteractions(suggestionService);
    }

    @Test
    void highForwardOccupancy_withFreeGap_emitsRaise() {
        // Occupation à venir élevée (~97 %) + un créneau encore libre → prix sous-évalués : HAUSSE.
        when(moduleSettingsRepository.findByOrganizationIdAndModuleKey(ORG, "rev")).thenReturn(Optional.empty());
        when(performanceService.compute(PROP)).thenReturn(perf(90.0, "5000", 70.0));
        when(reservationRepository.findByPropertyId(PROP, ORG)).thenReturn(List.of());
        when(calendarDayRepository.findUnavailableDatesInRange(eq(PROP), any(), any(), eq(ORG))).thenAnswer(inv ->
                datesInRange(inv.getArgument(1), inv.getArgument(2),
                        LocalDate.parse("2026-08-01"), LocalDate.parse("2026-08-04"))); // 3 nuits libres

        scanner().scanProperty(ORG, PROP);

        ArgumentCaptor<String> params = ArgumentCaptor.forClass(String.class);
        verify(suggestionService).recordActionable(eq(ORG), eq(PROP), eq("rev"),
                eq("Relever les tarifs (demande forte)"), anyString(),
                eq(SupervisionActionType.PRICE_DROP), params.capture(),
                argThat(c -> c != null && c > 0), eq("info"));
        assertThat(params.getValue()).contains("\"direction\":\"up\"");
    }

    /** Toutes les dates de [from, to), en excluant le trou [gapFrom, gapTo) s'il est fourni. */
    private List<LocalDate> datesInRange(LocalDate from, LocalDate to, LocalDate gapFrom, LocalDate gapTo) {
        List<LocalDate> dates = new ArrayList<>();
        for (LocalDate d = from; d.isBefore(to); d = d.plusDays(1)) {
            if (gapFrom != null && !d.isBefore(gapFrom) && d.isBefore(gapTo)) continue;
            dates.add(d);
        }
        return dates;
    }
}
