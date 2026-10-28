package com.clenzy.service.report;

import com.clenzy.dto.*;
import com.clenzy.dto.report.*;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.service.PaceAnalyticsService;
import com.clenzy.service.report.snapshot.*;
import org.junit.jupiter.api.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Baitly monetary agreement across the snapshot consumed by screen, PDF and narrative. */
class BaitlyReportNetConsistencyTest {
    private static final LocalDate FROM = LocalDate.of(2026, 10, 1), TO = FROM.plusDays(4);
    private final ReportExecutionService execution = mock(ReportExecutionService.class);
    private final OwnerPayoutRepository payouts = mock(OwnerPayoutRepository.class);
    private final ReservationRepository reservations = mock(ReservationRepository.class);
    private final List<Reservation> stays = new ArrayList<>();
    private ReportSnapshotBuilder builder;
    private Property property;

    @BeforeEach void setup() {
        builder = new ReportSnapshotBuilder(execution, mock(PropertyRepository.class), payouts,
                mock(InterventionRepository.class), mock(UserRepository.class), reservations,
                mock(CalendarDayRepository.class), mock(GuestReviewRepository.class), mock(PaceAnalyticsService.class),
                mock(UpsellOrderRepository.class), mock(NoiseAlertRepository.class));
        property = new Property(); property.setId(11L); property.setName("Baitly recipe property");
        property.setStatus(PropertyStatus.ACTIVE);
        when(execution.execute(anyList(), anyList(), anyString(), any(), any(), eq(7L), eq(Set.of(11L))))
                .thenAnswer(call -> {
                    LocalDate date = call.getArgument(3);
                    BigDecimal revenue = new BigDecimal(date.equals(FROM) ? "1000" : date.equals(FROM.minusDays(5)) ? "500" : "250");
                    return new ReportResultDto(List.of("PERIOD"), List.of(), "YEAR", date,
                            call.getArgument(4), "EUR", List.of(new ReportResultRowDto(List.of(), Map.of(
                            "REVENUE", revenue, "FEES", revenue.multiply(new BigDecimal("0.1")),
                            "MARGIN", revenue.multiply(new BigDecimal("0.7")), "OCCUPANCY", new BigDecimal("50")))));
                });
        when(reservations.findOverlappingWindowForPace(any(), any(), eq(7L), isNull(), isNull()))
                .thenAnswer(call -> {
                    LocalDate from = call.getArgument(0), until = call.getArgument(1);
                    return stays.stream().filter(s -> s.getCheckIn().isBefore(until) && s.getCheckOut().isAfter(from)).toList();
                });
        stays.add(stay(FROM, FROM.plusDays(10), "100"));
        stays.add(stay(FROM.minusDays(5), FROM, "25"));
        stays.add(stay(FROM.minusYears(1), FROM.minusYears(1).plusDays(5), "12.5"));
    }

    @Test void estimatedNetDeductsProratedTaxAndUsesTheSameBasisForComparisons() {
        var snapshot = build(List.of("pnl"));
        var net = net(snapshot);
        assertThat(net.rawValue()).isEqualByComparingTo("650.00");
        assertThat(net.deltaPreviousPct()).isEqualByComparingTo("100");
        assertThat(net.deltaLastYearPct()).isEqualByComparingTo("300");
        assertThat(net.hint()).contains("Estimation", "taxe de séjour");
        assertSameTotal(snapshot);
    }

    @Test void absentTaxDoesNotInventADeduction() {
        stays.forEach(s -> s.setTouristTaxAmount(null));
        var snapshot = build(List.of("pnl"));
        assertThat(net(snapshot).rawValue()).isEqualByComparingTo("700");
        assertSameTotal(snapshot);
    }

    @Test void cancelledAndOtherPropertyStaysCannotReduceTheNet() {
        var cancelled = stay(FROM, TO.plusDays(1), "900"); cancelled.setStatus("cancelled"); stays.add(cancelled);
        var foreign = stay(FROM, TO.plusDays(1), "800");
        var other = new Property(); other.setId(99L); foreign.setProperty(other); stays.add(foreign);
        var snapshot = build(List.of("pnl"));
        assertThat(net(snapshot).rawValue()).isEqualByComparingTo("650");
        assertSameTotal(snapshot);
    }

    @Test void existingPayoutNetIsUsedWithoutSubtractingTaxAgain() {
        var payout = new OwnerPayout(); payout.setPeriodStart(FROM); payout.setPeriodEnd(TO);
        payout.setGrossRevenue(new BigDecimal("1000")); payout.setOtaFees(new BigDecimal("100"));
        payout.setCommissionAmount(new BigDecimal("80")); payout.setExpenses(new BigDecimal("200"));
        payout.setNetAmount(new BigDecimal("570"));
        when(payouts.findByOwnerId(42L, 7L)).thenReturn(List.of(payout));
        var snapshot = build(List.of("pnl"));
        assertThat(net(snapshot).rawValue()).isEqualByComparingTo("570");
        assertThat(net(snapshot).hint()).contains("reversements réconciliés");
        assertThat(snapshot.sections().getFirst().table().rows()).noneMatch(row -> row.getFirst().contains("Taxe de séjour"));
        assertSameTotal(snapshot);
        verify(payouts, times(3)).findByOwnerId(42L, 7L);
        verifyNoMoreInteractions(payouts);
    }

    @Test void headlineRemainsCorrectWhenTheDetailedSectionIsNotRequested() {
        var snapshot = build(List.of("notice"));
        assertThat(snapshot.sections()).noneMatch(s -> "pnl".equals(s.id()));
        assertThat(net(snapshot).rawValue()).isEqualByComparingTo("650");
    }

    private ReportSnapshot build(List<String> sections) {
        return builder.build(new ReportRequest(ReportProfile.OWNER, ReportGroupBy.OWNER, FROM, TO,
                        Set.of(), Set.of(11L), sections, false),
                new ReportScope(42L, "synthetic-owner", "Recipe", null, List.of(property)), 7L, "Baitly", null);
    }

    private Reservation stay(LocalDate from, LocalDate until, String tax) {
        var stay = new Reservation(); stay.setProperty(property); stay.setOrganizationId(7L);
        stay.setCheckIn(from); stay.setCheckOut(until); stay.setStatus("confirmed");
        stay.setTouristTaxAmount(new BigDecimal(tax)); return stay;
    }

    private ReportKpi net(ReportSnapshot snapshot) {
        return snapshot.kpis().stream().filter(k -> "net".equals(k.key())).findFirst().orElseThrow();
    }

    private void assertSameTotal(ReportSnapshot snapshot) {
        assertThat(snapshot.sections().stream().filter(s -> "pnl".equals(s.id())).findFirst().orElseThrow()
                .table().totals().get(1)).isEqualTo(net(snapshot).value());
    }
}
