package com.clenzy.service.agent.supervision;

import com.clenzy.dto.PropertyPerformanceDto;
import com.clenzy.model.Reservation;
import com.clenzy.model.YieldAdjustment;
import com.clenzy.model.YieldMode;
import com.clenzy.model.YieldOrgConfig;
import com.clenzy.repository.CalendarDayRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.SupervisionModuleSettingsRepository;
import com.clenzy.repository.YieldAdjustmentRepository;
import com.clenzy.repository.YieldOrgConfigRepository;
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
    @Mock private com.clenzy.service.PaceAnalyticsService paceAnalyticsService;
    @Mock private SupervisionSuggestionService suggestionService;
    @Mock private ReservationRepository reservationRepository;
    @Mock private CalendarDayRepository calendarDayRepository;
    @Mock private SupervisionModuleSettingsRepository moduleSettingsRepository;
    @Mock private AutoApplyGate autoApplyGate;
    @Mock private SupervisionAutoApplyService autoApplyService;
    @Mock private YieldOrgConfigRepository yieldOrgConfigRepository;
    @Mock private YieldAdjustmentRepository yieldAdjustmentRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Clock clock = Clock.fixed(Instant.parse("2026-07-08T10:00:00Z"), ZoneOffset.UTC);

    private BusinessAnalyticsScanner scanner() {
        return new BusinessAnalyticsScanner(performanceService, paceAnalyticsService, suggestionService,
                reservationRepository, calendarDayRepository, moduleSettingsRepository,
                autoApplyGate, autoApplyService, yieldOrgConfigRepository, yieldAdjustmentRepository,
                objectMapper, clock, new BigDecimal("12"));
    }

    private PropertyPerformanceDto perf(double occ, String revenue, double margin) {
        return new PropertyPerformanceDto(PROP, "Duplex", 0, BigDecimal.ZERO, occ,
                new BigDecimal(revenue), BigDecimal.ZERO, margin, 90);
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

    @Test
    void healthyForwardOccupancy_butPacingBehindLastYear_emitsPaceCard() {
        // Occupation forward + rétro pleines (résa qui couvre tout) → ni baisse ni
        // sous-performance → le chemin pace (R3) est atteint.
        when(moduleSettingsRepository.findByOrganizationIdAndModuleKey(ORG, "rev")).thenReturn(Optional.empty());
        when(performanceService.compute(PROP)).thenReturn(perf(90.0, "5000", 70.0));
        when(reservationRepository.findByPropertyId(PROP, ORG))
                .thenReturn(List.of(reservation("2026-04-08", "2026-11-01")));
        when(calendarDayRepository.findUnavailableDatesInRange(eq(PROP), any(), any(), eq(ORG)))
                .thenReturn(List.of());
        // Août en retard : 10 nuits OTB contre 20 l'an dernier au même recul (-50 %).
        var behind = new com.clenzy.dto.PaceMonthDto("2026-08", 10, new BigDecimal("1000"),
                20, -50.0, 0, 0, 33.0);
        when(paceAnalyticsService.getSummary(ORG, null, 3, PROP))
                .thenReturn(new com.clenzy.dto.PaceSummaryDto(LocalDate.parse("2026-07-08"), 1, List.of(behind)));

        scanner().scanProperty(ORG, PROP);

        verify(suggestionService).recordActionable(eq(ORG), eq(PROP), eq("rev"),
                eq("Réservations en retard vs l'an dernier — 2026-08"), anyString(),
                isNull(), isNull(), argThat(c -> c != null && c > 0), eq("info"));
    }

    @Test
    void pacingOnTrack_emitsNoPaceCard() {
        when(moduleSettingsRepository.findByOrganizationIdAndModuleKey(ORG, "rev")).thenReturn(Optional.empty());
        when(performanceService.compute(PROP)).thenReturn(perf(90.0, "5000", 70.0));
        when(reservationRepository.findByPropertyId(PROP, ORG))
                .thenReturn(List.of(reservation("2026-04-08", "2026-11-01")));
        when(calendarDayRepository.findUnavailableDatesInRange(eq(PROP), any(), any(), eq(ORG)))
                .thenReturn(List.of());
        // Août en avance (+10 %) → aucun retard, pas de carte pace.
        var ahead = new com.clenzy.dto.PaceMonthDto("2026-08", 22, new BigDecimal("2200"),
                20, 10.0, 0, 0, 73.0);
        when(paceAnalyticsService.getSummary(ORG, null, 3, PROP))
                .thenReturn(new com.clenzy.dto.PaceSummaryDto(LocalDate.parse("2026-07-08"), 1, List.of(ahead)));

        scanner().scanProperty(ORG, PROP);

        verifyNoInteractions(suggestionService);
    }

    // ── Vague 1 autonomie : PRICE_DROP branché sur le cadre yield ────────────

    private YieldOrgConfig yieldConfig(boolean enabled, YieldMode mode) {
        YieldOrgConfig config = new YieldOrgConfig(ORG);
        config.setEnabled(enabled);
        config.setMode(mode);
        return config;
    }

    /**
     * Occupation faible mais créneaux libres UNIQUEMENT à ≥ 14 jours (remises 12 %
     * et 7 % — jamais 15 %) : tous les segments restent ≤ autoHitlImpactPct (12).
     * Le trou libre commence le 2026-07-22 (aujourd'hui fixé au 2026-07-08).
     */
    private void stubFreeFromJuly22() {
        when(moduleSettingsRepository.findByOrganizationIdAndModuleKey(ORG, "rev")).thenReturn(Optional.empty());
        when(performanceService.compute(PROP)).thenReturn(perf(20.0, "5000", 70.0));
        when(reservationRepository.findByPropertyId(PROP, ORG)).thenReturn(List.of());
        when(calendarDayRepository.findUnavailableDatesInRange(eq(PROP), any(), any(), eq(ORG)))
                .thenAnswer(inv -> datesInRange(inv.getArgument(1), inv.getArgument(2),
                        LocalDate.parse("2026-07-22"), LocalDate.parse("2026-10-07")));
    }

    @Test
    void priceDrop_yieldModeSuggest_staysHitlCard() {
        stubFreeFromJuly22();
        when(yieldOrgConfigRepository.findByOrganizationId(ORG))
                .thenReturn(Optional.of(yieldConfig(true, YieldMode.SUGGEST)));

        scanner().scanProperty(ORG, PROP);

        // Mode SUGGEST : jamais d'auto — carte HITL normale, le gate n'est même pas consulté.
        verify(suggestionService).recordActionable(eq(ORG), eq(PROP), eq("rev"),
                eq("Optimiser les tarifs des créneaux creux à venir"), anyString(),
                eq(SupervisionActionType.PRICE_DROP), anyString(), any(), eq("warning"));
        verifyNoInteractions(autoApplyGate, autoApplyService);
    }

    @Test
    void priceDrop_yieldAutoButSegmentOverImpactPct_staysHitlCard() {
        // Tout libre dès demain → le 1er segment est en last-minute (base+3 = 15 %) > 12 %.
        when(moduleSettingsRepository.findByOrganizationIdAndModuleKey(ORG, "rev")).thenReturn(Optional.empty());
        when(performanceService.compute(PROP)).thenReturn(perf(20.0, "5000", 70.0));
        when(reservationRepository.findByPropertyId(PROP, ORG)).thenReturn(List.of());
        when(calendarDayRepository.findUnavailableDatesInRange(eq(PROP), any(), any(), eq(ORG))).thenReturn(List.of());
        when(yieldOrgConfigRepository.findByOrganizationId(ORG))
                .thenReturn(Optional.of(yieldConfig(true, YieldMode.AUTO)));

        scanner().scanProperty(ORG, PROP);

        verify(suggestionService).recordActionable(eq(ORG), eq(PROP), eq("rev"),
                eq("Optimiser les tarifs des créneaux creux à venir"), anyString(),
                eq(SupervisionActionType.PRICE_DROP), anyString(), any(), eq("warning"));
        verifyNoInteractions(autoApplyGate, autoApplyService);
    }

    @Test
    void priceDrop_yieldAutoWithinImpact_andToggleOn_autoAppliesViaPipeline() {
        stubFreeFromJuly22();
        when(yieldOrgConfigRepository.findByOrganizationId(ORG))
                .thenReturn(Optional.of(yieldConfig(true, YieldMode.AUTO)));
        when(yieldAdjustmentRepository.existsByPropertyIdAndAdjustmentDayAndModeAndSkipReasonIsNull(
                PROP, LocalDate.parse("2026-07-08"), YieldAdjustment.Mode.APPLIED)).thenReturn(false);
        when(autoApplyGate.decide(eq(ORG), eq("rev"), eq(SupervisionActionType.PRICE_DROP), any()))
                .thenReturn(AutoApplyGate.AutoDecision.AUTO_NOTIFY);
        when(suggestionService.recordActionableForAutoApply(eq(ORG), eq(PROP), eq("rev"), isNull(),
                anyString(), anyString(), eq(SupervisionActionType.PRICE_DROP), anyString(), any(), anyString()))
                .thenReturn(Optional.of(99L));
        when(autoApplyService.autoApply(eq(AutoApplyGate.AutoDecision.AUTO_NOTIFY), eq(ORG), eq(PROP),
                eq("rev"), eq(99L), anyString(), anyString(), any())).thenReturn(true);

        scanner().scanProperty(ORG, PROP);

        // Cadre yield vert + gate vert → carte créée SANS notif pending puis auto-appliquée
        // via le pipeline, et le cap journalier yield est armé (journal APPLIED).
        verify(autoApplyGate).decide(eq(ORG), eq("rev"), eq(SupervisionActionType.PRICE_DROP),
                argThat(inputs -> Integer.valueOf(12).equals(
                        inputs.get(AutoApplyGate.INPUT_MAX_SEGMENT_ABS_PERCENT))));
        verify(autoApplyService).autoApply(eq(AutoApplyGate.AutoDecision.AUTO_NOTIFY), eq(ORG), eq(PROP),
                eq("rev"), eq(99L), anyString(), anyString(), any());
        verify(yieldAdjustmentRepository).save(argThat(line ->
                line.getMode() == YieldAdjustment.Mode.APPLIED && Long.valueOf(99L).equals(line.getSuggestionId())));
        verify(suggestionService, org.mockito.Mockito.never()).recordActionable(
                any(), any(), anyString(), anyString(), anyString(), anyString(), anyString(), any(), anyString());
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
