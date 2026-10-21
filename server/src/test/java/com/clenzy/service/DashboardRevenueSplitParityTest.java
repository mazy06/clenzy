package com.clenzy.service;

import com.clenzy.model.Property;
import com.clenzy.model.PropertyStatus;
import com.clenzy.model.Reservation;
import com.clenzy.model.UserRole;
import com.clenzy.repository.*;
import com.clenzy.service.agent.analytics.ChannelCommissionResolver;
import com.clenzy.service.report.ReportExecutionService;
import com.clenzy.service.report.ReportFieldCatalog;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class DashboardRevenueSplitParityTest {
    @Test void missingOwnerIdentityNeverFallsBackToTheWholeOrganization() {
        var repository = mock(DashboardRevenueSplitRepository.class);
        var service = new DashboardRevenueSplitService(repository, new ChannelCommissionResolver());
        assertThatThrownBy(() -> service.getYear(7L, 2026, UserRole.HOST, null))
            .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verifyNoInteractions(repository);
    }
    @Test void monthlyAllocationMatchesTheNightlyReportIncludingLeapYearAndRounding() {
        var projections = mock(DashboardRevenueSplitRepository.class);
        var reservations = mock(ReservationRepository.class);
        var properties = mock(PropertyRepository.class);
        var interventions = mock(InterventionRepository.class);
        var commission = new ChannelCommissionResolver();
        var property = new Property(); property.setId(1L); property.setStatus(PropertyStatus.ACTIVE);
        var stays = new ArrayList<Reservation>();
        for (int i = 0; i < 100; i++) {
            var r = new Reservation(); r.setProperty(property); r.setStatus("confirmed");
            r.setCurrency("EUR"); r.setSource(i % 2 == 0 ? "Airbnb" : "direct");
            r.setCheckIn(LocalDate.of(2023, 12, 20).plusDays(i * 4L));
            r.setCheckOut(r.getCheckIn().plusDays(3 + i % 70));
            r.setTotalPrice(new BigDecimal("100.01").add(BigDecimal.valueOf(i)));
            if (i % 4 == 0) r.setOtaFeeAmount(new BigDecimal("7.13"));
            stays.add(r);
        }
        when(properties.findByOrganizationId(7L)).thenReturn(List.of(property));
        when(reservations.findOverlappingWindowForPace(any(), any(), eq(7L), isNull(), isNull())).thenReturn(stays);
        var projected = stays.stream().map(r -> new DashboardRevenueSplitRepository.Stay() {
            public LocalDate getCheckIn() { return r.getCheckIn(); }
            public LocalDate getCheckOut() { return r.getCheckOut(); }
            public BigDecimal getTotalPrice() { return r.getTotalPrice(); }
            public BigDecimal getOtaFeeAmount() { return r.getOtaFeeAmount(); }
            public String getCurrency() { return r.getCurrency(); }
            public String getSource() { return r.getSource(); }
        }).map(r -> (DashboardRevenueSplitRepository.Stay) r).toList();
        when(projections.stays(any(), any(), any(), any())).thenReturn(projected);
        var legacy = new ReportExecutionService(reservations, interventions, properties, commission, new ReportFieldCatalog())
            .execute(List.of("PERIOD"), List.of("REVENUE", "FEES", "MARGIN"), "MONTH",
                LocalDate.of(2024, 1, 1), LocalDate.of(2024, 12, 31), 7L);
        var fast = new DashboardRevenueSplitService(projections, commission).getYear(7L, 2024, UserRole.SUPER_ADMIN, "staff");
        for (var month : fast) {
            var row = legacy.rows().stream().filter(r -> r.dimensionValues().getFirst().equals(month.month())).findFirst();
            if (row.isEmpty()) { assertThat(month.revenue()).isZero(); continue; }
            assertThat(month.revenue()).isEqualByComparingTo((BigDecimal) row.get().metrics().get("REVENUE"));
            assertThat(month.fees()).isEqualByComparingTo((BigDecimal) row.get().metrics().get("FEES"));
            assertThat(month.retained()).isEqualByComparingTo((BigDecimal) row.get().metrics().get("MARGIN"));
        }
    }
}
