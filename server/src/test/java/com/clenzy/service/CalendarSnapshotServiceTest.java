package com.clenzy.service;

import com.clenzy.model.CalendarDay;
import com.clenzy.model.CalendarDayStatus;
import com.clenzy.repository.CalendarDaySnapshotJdbcRepository.SnapshotRow;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class CalendarSnapshotServiceTest {

    private static final Long ORG = 10L;
    private static final Long PROPERTY = 42L;
    private static final LocalDate SNAPSHOT = LocalDate.of(2026, 7, 20);

    private static CalendarDay day(LocalDate date, CalendarDayStatus status, Integer minStay) {
        CalendarDay d = new CalendarDay();
        d.setDate(date);
        d.setStatus(status);
        d.setMinStay(minStay);
        return d;
    }

    @Test
    void whenNoCalendarRow_thenMaterializedAsAvailable() {
        // Convention projet : absence de ligne calendar_days = disponible.
        Map<LocalDate, PriceEngine.ResolvedPrice> prices = Map.of(
                SNAPSHOT, new PriceEngine.ResolvedPrice(new BigDecimal("120.00"), "SEASONAL"));

        List<SnapshotRow> rows = CalendarSnapshotService.buildRows(
                ORG, PROPERTY, "MAD", SNAPSHOT, prices, List.of());

        assertThat(rows).hasSize(365);
        SnapshotRow first = rows.get(0);
        assertThat(first.stayDate()).isEqualTo(SNAPSHOT);
        assertThat(first.status()).isEqualTo("AVAILABLE");
        assertThat(first.minStay()).isNull();
        assertThat(first.publishedPrice()).isEqualByComparingTo("120.00");
        assertThat(first.priceSource()).isEqualTo("SEASONAL");
        assertThat(first.currency()).isEqualTo("MAD");
    }

    @Test
    void whenCalendarRowExists_thenStatusAndMinStayCopied() {
        LocalDate booked = SNAPSHOT.plusDays(3);
        Map<LocalDate, PriceEngine.ResolvedPrice> prices = Map.of(
                booked, new PriceEngine.ResolvedPrice(new BigDecimal("200.00"), "OVERRIDE"));

        List<SnapshotRow> rows = CalendarSnapshotService.buildRows(
                ORG, PROPERTY, "EUR", SNAPSHOT, prices,
                List.of(day(booked, CalendarDayStatus.BOOKED, 2)));

        SnapshotRow row = rows.get(3);
        assertThat(row.stayDate()).isEqualTo(booked);
        assertThat(row.status()).isEqualTo("BOOKED");
        assertThat(row.minStay()).isEqualTo(2);
        assertThat(row.publishedPrice()).isEqualByComparingTo("200.00");
        assertThat(row.priceSource()).isEqualTo("OVERRIDE");
    }

    @Test
    void whenNoResolvedPrice_thenPropertyDefaultSourceWithNullPrice() {
        // La cascade peut renvoyer un prix null (aucun tarif applicable) : la photo
        // conserve le fait, source PROPERTY_DEFAULT.
        List<SnapshotRow> rows = CalendarSnapshotService.buildRows(
                ORG, PROPERTY, "EUR", SNAPSHOT, Map.of(), List.of());

        assertThat(rows.get(10).publishedPrice()).isNull();
        assertThat(rows.get(10).priceSource()).isEqualTo(PriceEngine.SOURCE_PROPERTY_DEFAULT);
    }
}
