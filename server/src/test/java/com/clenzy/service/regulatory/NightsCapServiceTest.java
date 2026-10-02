package com.clenzy.service.regulatory;

import com.clenzy.model.CalendarDay;
import com.clenzy.model.CalendarDayStatus;
import com.clenzy.model.RegulatoryConfig;
import com.clenzy.model.RegulatoryConfig.RegulatoryType;
import com.clenzy.repository.CalendarDayRepository;
import com.clenzy.repository.RegulatoryConfigRepository;
import com.clenzy.service.CalendarEngine;
import com.clenzy.service.NotificationService;
import com.clenzy.service.RegulatoryComplianceService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class NightsCapServiceTest {

    private static final Long ORG = 1L;
    private static final Long PROP = 10L;

    @Mock private RegulatoryConfigRepository configRepository;
    @Mock private RegulatoryComplianceService complianceService;
    @Mock private CalendarDayRepository calendarDayRepository;
    @Mock private CalendarEngine calendarEngine;
    @Mock private NotificationService notificationService;

    private NightsCapService service;

    @BeforeEach
    void setUp() {
        service = new NightsCapService(configRepository, complianceService, calendarDayRepository,
                calendarEngine, notificationService);
    }

    private void capOf(int max, boolean enabled) {
        RegulatoryConfig c = new RegulatoryConfig();
        c.setRegulatoryType(RegulatoryType.ALUR_120_DAYS);
        c.setMaxDaysPerYear(max);
        c.setIsEnabled(enabled);
        when(configRepository.findByPropertyAndType(PROP, RegulatoryType.ALUR_120_DAYS, ORG))
                .thenReturn(Optional.of(c));
    }

    private CalendarDay day(LocalDate date, CalendarDayStatus status) {
        CalendarDay d = new CalendarDay();
        d.setDate(date);
        d.setStatus(status);
        return d;
    }

    @Test
    void noActiveCap_neverReportsAnOverrun() {
        capOf(120, false);
        assertThat(service.overruns(PROP, ORG, LocalDate.of(2026, 6, 1), LocalDate.of(2026, 9, 1))).isEmpty();
        when(configRepository.findByPropertyAndType(PROP, RegulatoryType.ALUR_120_DAYS, ORG))
                .thenReturn(Optional.empty());
        assertThat(service.overruns(PROP, ORG, LocalDate.of(2026, 6, 1), LocalDate.of(2026, 9, 1))).isEmpty();
    }

    @Test
    void stayPushingPastTheCap_isReportedForItsYearOnly() {
        capOf(90, true); // commune ayant abaissé le plafond
        when(complianceService.rentedNightsInYear(PROP, ORG, 2026)).thenReturn(85);
        when(complianceService.rentedNightsInYear(PROP, ORG, 2027)).thenReturn(0);

        var overruns = service.overruns(PROP, ORG, LocalDate.of(2026, 12, 25), LocalDate.of(2027, 1, 3));

        assertThat(overruns).hasSize(1);
        assertThat(overruns.get(0).year()).isEqualTo(2026);
        assertThat(overruns.get(0).newNights()).isEqualTo(7);
        assertThat(overruns.get(0).excess()).isEqualTo(2);
        assertThat(NightsCapService.describe(overruns)).contains("85").contains("90");
    }

    @Test
    void closeRestOfYear_blocksOnlyFreeSpans() {
        LocalDate from = LocalDate.of(2026, 12, 26);
        when(calendarDayRepository.findByPropertyAndDateRange(PROP, from, LocalDate.of(2026, 12, 31), ORG))
                .thenReturn(List.of(day(LocalDate.of(2026, 12, 28), CalendarDayStatus.BOOKED),
                        day(LocalDate.of(2026, 12, 29), CalendarDayStatus.BOOKED)));

        int closed = service.closeRestOfYear(PROP, ORG, from, "system");

        assertThat(closed).isEqualTo(4); // 26-27 puis 30-31
        verify(calendarEngine).block(eq(PROP), eq(from), eq(LocalDate.of(2026, 12, 28)), eq(ORG),
                eq(NightsCapService.CALENDAR_SOURCE), anyString(), eq("system"));
        verify(calendarEngine).block(eq(PROP), eq(LocalDate.of(2026, 12, 30)), eq(LocalDate.of(2027, 1, 1)),
                eq(ORG), eq(NightsCapService.CALENDAR_SOURCE), anyString(), eq("system"));
    }

    @Test
    void freeDays_countsDaysWithoutRowAsFree() {
        LocalDate from = LocalDate.of(2026, 12, 29);
        when(calendarDayRepository.findByPropertyAndDateRange(PROP, from, LocalDate.of(2026, 12, 31), ORG))
                .thenReturn(List.of(day(LocalDate.of(2026, 12, 30), CalendarDayStatus.BLOCKED)));
        assertThat(service.freeDaysRestOfYear(PROP, ORG, from)).isEqualTo(2);
    }

    @Test
    void existingOverruns_comparesRecordedNightsToTheCap() {
        capOf(120, true);
        when(complianceService.rentedNightsInYear(PROP, ORG, 2026)).thenReturn(124);
        assertThat(service.existingOverruns(PROP, ORG, LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 5)))
                .extracting(NightsCapService.YearOverrun::rentedNights).containsExactly(124);
        verify(calendarEngine, never()).block(any(), any(), any(), any(), any(), any(), any());
    }
}
