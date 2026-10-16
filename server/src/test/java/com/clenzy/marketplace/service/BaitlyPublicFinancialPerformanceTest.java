package com.clenzy.marketplace.service;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import java.time.*;
import java.math.BigDecimal;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

class BaitlyPublicFinancialPerformanceTest {
    final JdbcTemplate db=mock(JdbcTemplate.class);
    final BaitlyPublicFinancialPerformance service=new BaitlyPublicFinancialPerformance(db,Clock.fixed(Instant.parse("2026-10-12T00:00:00Z"),ZoneOffset.UTC));
    @Test void conciergeSmallSampleIsNeverPublished() {
        assertThat(service.compute(1L,List.of(1L,2L),true)).isEmpty(); verifyNoInteractions(db);
    }
    @Test void mixedCurrenciesAreNotCombined() {
        when(db.queryForMap(anyString(),any(Object[].class))).thenReturn(Map.of("homes",2,"currencies",2));
        assertThat(service.compute(1L,List.of(1L,2L),false)).isEmpty();
        verify(db,times(1)).queryForMap(anyString(),any(Object[].class));
    }
    @Test void incompleteRevenueDoesNotProduceFinancialClaims() {
        when(db.queryForMap(anyString(),any(Object[].class)))
            .thenReturn(Map.of("homes",1,"currencies",1,"currency","EUR","newest",java.sql.Date.valueOf("2023-01-01")))
            .thenReturn(Map.of("booked",10,"covered",5,"unique_nights",10,"calendar",365,"revenue",BigDecimal.valueOf(500)))
            .thenReturn(Map.of("booked",10,"covered",5,"unique_nights",10,"calendar",365,"revenue",BigDecimal.valueOf(500)));
        assertThat(service.compute(1L,List.of(1L),false)).allSatisfy(p -> {
            assertThat(p.get("financialCoveragePct")).isEqualTo(new BigDecimal("50.00"));
            assertThat(p).doesNotContainKeys("averageNightlyRate","revenuePerCalendarNight","recordedCostMarginPct","revenueGrowthPct");
        });
    }
    @Test void fullDataShowsRecordedCostMarginAndComparableGrowth() {
        when(db.queryForMap(anyString(),any(Object[].class)))
            .thenReturn(Map.of("homes",1,"currencies",1,"currency","EUR","newest",java.sql.Date.valueOf("2023-01-01")))
            .thenReturn(Map.of("booked",10,"covered",10,"unique_nights",10,"calendar",365,"revenue",BigDecimal.valueOf(1000)))
            .thenReturn(Map.of("entries",2,"covered",2,"costs",BigDecimal.valueOf(200)))
            .thenReturn(Map.of("booked",10,"covered",10,"unique_nights",10,"calendar",365,"revenue",BigDecimal.valueOf(1100)))
            .thenReturn(Map.of("entries",2,"covered",2,"costs",BigDecimal.valueOf(200)));
        var now=service.compute(1L,List.of(1L),false).getLast();
        assertThat(now.get("averageNightlyRate")).isEqualTo(new BigDecimal("110.00"));
        assertThat(now.get("occupancyPct")).isEqualTo(new BigDecimal("2.74"));
        assertThat(now.get("calendarNights")).isEqualTo(365L);
        assertThat(now.get("recordedCostMarginPct")).isEqualTo(new BigDecimal("81.8"));
        assertThat(now).containsKey("revenueGrowthPct").doesNotContainKeys("totalRevenue","netProfit");
    }
}
