package com.clenzy.service.agent.supervision;

import com.clenzy.dto.SupervisionReportDto;
import com.clenzy.model.SupervisionActivity;
import com.clenzy.model.SupervisionSuggestion;
import com.clenzy.repository.SupervisionActivityRepository;
import com.clenzy.repository.SupervisionSuggestionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SupervisionReportServiceTest {

    private static final Long ORG = 1L;

    @Mock private SupervisionActivityRepository activityRepository;
    @Mock private SupervisionSuggestionRepository suggestionRepository;

    private final Clock clock = Clock.fixed(Instant.parse("2026-07-07T10:00:00Z"), ZoneOffset.UTC);
    private SupervisionReportService service;

    @BeforeEach
    void setUp() {
        service = new SupervisionReportService(activityRepository, suggestionRepository, clock);
    }

    @Test
    void computesRoiAndAcceptance() {
        when(activityRepository.countByOrganizationIdAndKindAndCreatedAtAfter(
                eq(ORG), eq(SupervisionActivity.KIND_ACT), any())).thenReturn(10L);
        when(suggestionRepository.countByOrganizationIdAndStatusAndAppliedAtAfter(
                eq(ORG), eq(SupervisionSuggestion.STATUS_APPLIED), any())).thenReturn(3L);
        when(suggestionRepository.countByOrganizationIdAndStatusAndCreatedAtAfter(
                eq(ORG), eq(SupervisionSuggestion.STATUS_DISMISSED), any())).thenReturn(1L);
        when(suggestionRepository.countByOrganizationIdAndStatusAndExpiresAtAfter(
                eq(ORG), eq(SupervisionSuggestion.STATUS_PENDING), any())).thenReturn(5L);

        SupervisionReportDto r = service.getReport(ORG);

        assertThat(r.windowDays()).isEqualTo(30);
        assertThat(r.autoActions()).isEqualTo(10);
        assertThat(r.suggestionsApplied()).isEqualTo(3);
        assertThat(r.suggestionsDismissed()).isEqualTo(1);
        assertThat(r.suggestionsPending()).isEqualTo(5);
        // 3 appliquées / (3 + 1 décidées) = 0.75
        assertThat(r.acceptanceRate()).isEqualTo(0.75);
        // 10 × 8 + 3 × 12 = 116 min → "≈ 1 h 56"
        assertThat(r.estimatedTimeSavedMinutes()).isEqualTo(116);
        assertThat(r.estimatedTimeSaved()).isEqualTo("≈ 1 h 56");
    }

    @Test
    void noDecisions_acceptanceAndRoiZero() {
        when(activityRepository.countByOrganizationIdAndKindAndCreatedAtAfter(
                eq(ORG), eq(SupervisionActivity.KIND_ACT), any())).thenReturn(0L);
        when(suggestionRepository.countByOrganizationIdAndStatusAndAppliedAtAfter(
                eq(ORG), eq(SupervisionSuggestion.STATUS_APPLIED), any())).thenReturn(0L);
        when(suggestionRepository.countByOrganizationIdAndStatusAndCreatedAtAfter(
                eq(ORG), eq(SupervisionSuggestion.STATUS_DISMISSED), any())).thenReturn(0L);
        when(suggestionRepository.countByOrganizationIdAndStatusAndExpiresAtAfter(
                eq(ORG), eq(SupervisionSuggestion.STATUS_PENDING), any())).thenReturn(0L);

        SupervisionReportDto r = service.getReport(ORG);

        assertThat(r.acceptanceRate()).isZero();
        assertThat(r.estimatedTimeSavedMinutes()).isZero();
        assertThat(r.estimatedTimeSaved()).isEqualTo("≈ 0 min");
    }

    /**
     * La fenêtre paramétrable (Jour/Semaine/Quinzaine/Mois) borne bien le comptage :
     * {@code since = now − windowDays}. Une fenêtre plus courte compte STRICTEMENT
     * moins d'actions → moins de temps gagné. Preuve du câblage bout en bout.
     */
    @Test
    void windowChangesCounts_dayCountsStrictlyLessThanMonth() {
        // now = 2026-07-07T10:00:00Z (clock fixe) → since(1j) = 06-07, since(30j) = 06-07 mois précédent.
        final Instant sinceDay = Instant.parse("2026-07-06T10:00:00Z");
        final Instant sinceMonth = Instant.parse("2026-06-07T10:00:00Z");
        when(activityRepository.countByOrganizationIdAndKindAndCreatedAtAfter(
                eq(ORG), eq(SupervisionActivity.KIND_ACT), eq(sinceDay))).thenReturn(2L);
        when(activityRepository.countByOrganizationIdAndKindAndCreatedAtAfter(
                eq(ORG), eq(SupervisionActivity.KIND_ACT), eq(sinceMonth))).thenReturn(20L);
        when(suggestionRepository.countByOrganizationIdAndStatusAndAppliedAtAfter(
                eq(ORG), eq(SupervisionSuggestion.STATUS_APPLIED), any())).thenReturn(0L);
        when(suggestionRepository.countByOrganizationIdAndStatusAndCreatedAtAfter(
                eq(ORG), eq(SupervisionSuggestion.STATUS_DISMISSED), any())).thenReturn(0L);
        when(suggestionRepository.countByOrganizationIdAndStatusAndExpiresAtAfter(
                eq(ORG), eq(SupervisionSuggestion.STATUS_PENDING), any())).thenReturn(0L);

        SupervisionReportDto day = service.getReport(ORG, 1);
        SupervisionReportDto month = service.getReport(ORG, 30);

        assertThat(day.windowDays()).isEqualTo(1);
        assertThat(day.autoActions()).isEqualTo(2);
        assertThat(day.estimatedTimeSavedMinutes()).isEqualTo(16); // 2 × 8
        assertThat(month.windowDays()).isEqualTo(30);
        assertThat(month.autoActions()).isEqualTo(20);
        assertThat(month.estimatedTimeSavedMinutes()).isEqualTo(160); // 20 × 8
        // Cœur de l'exigence : la durée choisie change bien les chiffres.
        assertThat(day.autoActions()).isLessThan(month.autoActions());
        assertThat(day.estimatedTimeSavedMinutes()).isLessThan(month.estimatedTimeSavedMinutes());
    }
}
