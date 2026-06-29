package com.clenzy.booking.service;

import com.clenzy.booking.dto.PropertyCalendarDto;
import com.clenzy.booking.dto.PropertyCalendarDto.CalendarDayDto;
import com.clenzy.booking.service.PublicBookingService.OrgContext;
import com.clenzy.model.CalendarDay;
import com.clenzy.model.CalendarDayStatus;
import com.clenzy.model.Organization;
import com.clenzy.model.Property;
import com.clenzy.repository.CalendarDayRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.PriceEngine;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * Grille de calendrier publique par propriété (CLZ Domaine 2) : disponibilité (convention
 * CalendarDay), prix nuitée (PriceEngine), min-nights, jours passés/non tarifés non réservables.
 */
@ExtendWith(MockitoExtension.class)
class PublicBookingCalendarServiceTest {

    @Mock private PropertyRepository propertyRepository;
    @Mock private CalendarDayRepository calendarDayRepository;
    @Mock private PriceEngine priceEngine;
    @Mock private com.clenzy.service.CurrencyConverterService currencyConverter;

    private PublicBookingCalendarService service;

    private static final Long ORG = 1L;
    private static final Long PID = 7L;
    private static final YearMonth FUTURE = YearMonth.of(2090, 1);

    @BeforeEach
    void setUp() {
        service = new PublicBookingCalendarService(propertyRepository, calendarDayRepository, priceEngine, currencyConverter, new BookingMockDataProvider());
    }

    private OrgContext ctx() {
        Organization o = new Organization();
        o.setId(ORG);
        return new OrgContext(o, null);
    }

    private Property property() {
        Property p = new Property();
        p.setId(PID);
        p.setOrganizationId(ORG);
        p.setMinimumNights(2);
        p.setDefaultCurrency("EUR");
        p.setTimezone("Europe/Paris");
        return p;
    }

    private Map<LocalDate, BigDecimal> pricesExcept(YearMonth ym, LocalDate skip) {
        Map<LocalDate, BigDecimal> prices = new HashMap<>();
        for (LocalDate d = ym.atDay(1); !d.isAfter(ym.atEndOfMonth()); d = d.plusDays(1)) {
            if (!d.equals(skip)) {
                prices.put(d, new BigDecimal("100.00"));
            }
        }
        return prices;
    }

    @Test
    void calendar_marksAvailability_price_andMinNights() {
        when(propertyRepository.findBookingEngineProperty(PID, ORG)).thenReturn(Optional.of(property()));
        CalendarDay blocked = new CalendarDay(property(), LocalDate.of(2090, 1, 5), CalendarDayStatus.BOOKED, ORG);
        when(calendarDayRepository.findByPropertyAndDateRange(eq(PID), any(), any(), eq(ORG)))
            .thenReturn(List.of(blocked));
        when(priceEngine.resolvePriceRange(eq(PID), any(), any(), eq(ORG)))
            .thenReturn(pricesExcept(FUTURE, LocalDate.of(2090, 1, 10)));

        PropertyCalendarDto cal = service.getCalendar(ctx(), PID, FUTURE, 1);

        assertThat(cal.propertyId()).isEqualTo(PID);
        assertThat(cal.currency()).isEqualTo("EUR");
        assertThat(cal.days()).hasSize(31);
        Map<LocalDate, CalendarDayDto> byDate = cal.days().stream()
            .collect(Collectors.toMap(CalendarDayDto::date, d -> d));

        CalendarDayDto normal = byDate.get(LocalDate.of(2090, 1, 1));
        assertThat(normal.available()).isTrue();
        assertThat(normal.price()).isEqualByComparingTo("100.00");
        assertThat(normal.minNights()).isEqualTo(2);

        assertThat(byDate.get(LocalDate.of(2090, 1, 5)).available()).isFalse(); // BOOKED

        CalendarDayDto unpriced = byDate.get(LocalDate.of(2090, 1, 10));
        assertThat(unpriced.available()).isFalse();
        assertThat(unpriced.price()).isNull();
    }

    @Test
    void unknownProperty_throws() {
        when(propertyRepository.findBookingEngineProperty(PID, ORG)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.getCalendar(ctx(), PID, FUTURE, 1))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void pastMonth_allDaysUnavailable() {
        when(propertyRepository.findBookingEngineProperty(PID, ORG)).thenReturn(Optional.of(property()));
        when(calendarDayRepository.findByPropertyAndDateRange(any(), any(), any(), any())).thenReturn(List.of());
        YearMonth past = YearMonth.of(2000, 1);
        when(priceEngine.resolvePriceRange(any(), any(), any(), any())).thenReturn(pricesExcept(past, null));

        PropertyCalendarDto cal = service.getCalendar(ctx(), PID, past, 1);

        assertThat(cal.days()).isNotEmpty();
        assertThat(cal.days()).allMatch(d -> !d.available()); // tous dans le passé
    }

    @Test
    void multiMonth_spansRequestedMonths() {
        when(propertyRepository.findBookingEngineProperty(PID, ORG)).thenReturn(Optional.of(property()));
        when(calendarDayRepository.findByPropertyAndDateRange(any(), any(), any(), any())).thenReturn(List.of());
        when(priceEngine.resolvePriceRange(any(), any(), any(), any())).thenReturn(Map.of());

        PropertyCalendarDto cal = service.getCalendar(ctx(), PID, FUTURE, 2);

        // janvier (31) + février (28, 2090 non bissextile) = 59 jours
        assertThat(cal.days()).hasSize(59);
    }
}
