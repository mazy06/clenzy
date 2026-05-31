package com.clenzy.booking.service;

import com.clenzy.booking.dto.AvailabilityDayDto;
import com.clenzy.booking.dto.CalendarAvailabilityResponseDto;
import com.clenzy.booking.dto.PropertyTypeInfoDto;
import com.clenzy.model.CalendarDay;
import com.clenzy.model.CalendarDayStatus;
import com.clenzy.model.Property;
import com.clenzy.model.PropertyType;
import com.clenzy.repository.CalendarDayRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.PriceEngine;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BookingEngineCalendarServiceTest {

    @Mock private PropertyRepository propertyRepository;
    @Mock private CalendarDayRepository calendarDayRepository;
    @Mock private PriceEngine priceEngine;

    private BookingEngineCalendarService service;

    private static final Long ORG_ID = 1L;
    private static final LocalDate FROM = LocalDate.of(2026, 6, 1);
    private static final LocalDate TO = LocalDate.of(2026, 6, 3); // 3 days

    @BeforeEach
    void setUp() {
        service = new BookingEngineCalendarService(propertyRepository, calendarDayRepository, priceEngine);
    }

    private Property buildProperty(Long id, PropertyType type, int maxGuests, BigDecimal nightly, BigDecimal cleaning) {
        Property p = new Property();
        p.setId(id);
        p.setOrganizationId(ORG_ID);
        p.setType(type);
        p.setMaxGuests(maxGuests);
        p.setNightlyPrice(nightly);
        p.setCleaningBasePrice(cleaning);
        return p;
    }

    private CalendarDay blockedDay(Property property, LocalDate date) {
        CalendarDay d = new CalendarDay();
        d.setProperty(property);
        d.setDate(date);
        d.setStatus(CalendarDayStatus.BLOCKED);
        d.setOrganizationId(ORG_ID);
        return d;
    }

    @Nested
    @DisplayName("getCalendarAvailability - empty / filter scenarios")
    class EmptyAndFilter {

        @Test
        void whenNoVisibleProperties_thenAllDaysUnavailable() {
            when(propertyRepository.findBookingEngineVisible(ORG_ID)).thenReturn(List.of());

            CalendarAvailabilityResponseDto result = service.getCalendarAvailability(
                    ORG_ID, FROM, TO, null, null);

            assertThat(result.days()).hasSize(3);
            result.days().forEach(d -> {
                assertThat(d.available()).isFalse();
                assertThat(d.availableCount()).isEqualTo(0);
                assertThat(d.minPrice()).isNull();
                assertThat(d.availableTypes()).isEmpty();
            });
            assertThat(result.propertyTypes()).isEmpty();
        }

        @Test
        void whenTypeFilterExcludesAll_thenEmptyDays() {
            Property apt = buildProperty(1L, PropertyType.APARTMENT, 2, new BigDecimal("100"), new BigDecimal("50"));
            when(propertyRepository.findBookingEngineVisible(ORG_ID)).thenReturn(List.of(apt));

            CalendarAvailabilityResponseDto result = service.getCalendarAvailability(
                    ORG_ID, FROM, TO, List.of("VILLA"), null);

            assertThat(result.days()).allSatisfy(d -> assertThat(d.available()).isFalse());
            // propertyTypes built from all visible (APT)
            assertThat(result.propertyTypes()).hasSize(1);
            assertThat(result.propertyTypes().get(0).type()).isEqualTo("APARTMENT");
        }

        @Test
        void whenGuestsFilterTooHigh_thenAllUnavailable() {
            Property apt = buildProperty(1L, PropertyType.APARTMENT, 2, new BigDecimal("100"), new BigDecimal("50"));
            when(propertyRepository.findBookingEngineVisible(ORG_ID)).thenReturn(List.of(apt));

            CalendarAvailabilityResponseDto result = service.getCalendarAvailability(
                    ORG_ID, FROM, TO, null, 10);

            assertThat(result.days()).allSatisfy(d -> assertThat(d.available()).isFalse());
        }

        @Test
        void whenPropertyMaxGuestsNull_thenGuestsFilterAllowsIt() {
            Property apt = buildProperty(1L, PropertyType.APARTMENT, 2, new BigDecimal("100"), new BigDecimal("50"));
            apt.setMaxGuests(null); // null means "no limit"
            when(propertyRepository.findBookingEngineVisible(ORG_ID)).thenReturn(List.of(apt));
            when(calendarDayRepository.findByPropertiesAndDateRange(anySet(), eq(FROM), eq(TO), eq(ORG_ID)))
                    .thenReturn(List.of());
            when(priceEngine.resolvePriceRange(eq(1L), eq(FROM), eq(TO.plusDays(1)), eq(ORG_ID)))
                    .thenReturn(Map.of(FROM, new BigDecimal("100")));

            CalendarAvailabilityResponseDto result = service.getCalendarAvailability(
                    ORG_ID, FROM, TO, null, 100);

            // Should not be filtered out when maxGuests is null
            assertThat(result.days().get(0).available()).isTrue();
        }
    }

    @Nested
    @DisplayName("getCalendarAvailability - availability aggregation")
    class Availability {

        @Test
        void whenAllAvailableWithPrices_thenMinPriceIsLowest() {
            Property apt = buildProperty(1L, PropertyType.APARTMENT, 4, new BigDecimal("100"), new BigDecimal("30"));
            Property villa = buildProperty(2L, PropertyType.VILLA, 6, new BigDecimal("200"), new BigDecimal("70"));
            when(propertyRepository.findBookingEngineVisible(ORG_ID)).thenReturn(List.of(apt, villa));
            when(calendarDayRepository.findByPropertiesAndDateRange(anySet(), eq(FROM), eq(TO), eq(ORG_ID)))
                    .thenReturn(List.of());
            when(priceEngine.resolvePriceRange(eq(1L), eq(FROM), eq(TO.plusDays(1)), eq(ORG_ID)))
                    .thenReturn(Map.of(FROM, new BigDecimal("90"),
                            FROM.plusDays(1), new BigDecimal("95")));
            when(priceEngine.resolvePriceRange(eq(2L), eq(FROM), eq(TO.plusDays(1)), eq(ORG_ID)))
                    .thenReturn(Map.of(FROM, new BigDecimal("150"),
                            FROM.plusDays(1), new BigDecimal("80")));

            CalendarAvailabilityResponseDto result = service.getCalendarAvailability(
                    ORG_ID, FROM, TO, null, null);

            assertThat(result.days()).hasSize(3);

            AvailabilityDayDto day0 = result.days().get(0);
            assertThat(day0.available()).isTrue();
            assertThat(day0.availableCount()).isEqualTo(2);
            assertThat(day0.minPrice()).isEqualTo(90.0);
            assertThat(day0.availableTypes()).contains("APARTMENT", "VILLA");

            AvailabilityDayDto day1 = result.days().get(1);
            assertThat(day1.minPrice()).isEqualTo(80.0); // Villa cheaper that day

            AvailabilityDayDto day2 = result.days().get(2);
            assertThat(day2.minPrice()).isNull(); // No price returned for day 2 in the test
            assertThat(day2.available()).isTrue();
        }

        @Test
        void whenAllPropertiesBlocked_thenDayUnavailable() {
            Property apt = buildProperty(1L, PropertyType.APARTMENT, 4, new BigDecimal("100"), new BigDecimal("30"));
            when(propertyRepository.findBookingEngineVisible(ORG_ID)).thenReturn(List.of(apt));
            // Block all 3 days for the only property
            when(calendarDayRepository.findByPropertiesAndDateRange(anySet(), eq(FROM), eq(TO), eq(ORG_ID)))
                    .thenReturn(List.of(
                            blockedDay(apt, FROM),
                            blockedDay(apt, FROM.plusDays(1)),
                            blockedDay(apt, TO)
                    ));
            when(priceEngine.resolvePriceRange(eq(1L), any(), any(), eq(ORG_ID)))
                    .thenReturn(Map.of());

            CalendarAvailabilityResponseDto result = service.getCalendarAvailability(
                    ORG_ID, FROM, TO, null, null);

            assertThat(result.days()).allSatisfy(d -> {
                assertThat(d.available()).isFalse();
                assertThat(d.availableCount()).isZero();
            });
        }

        @Test
        void whenSomePropertyBlockedSomeDays_thenOthersCountsCorrectly() {
            Property a = buildProperty(1L, PropertyType.APARTMENT, 2, new BigDecimal("100"), new BigDecimal("30"));
            Property b = buildProperty(2L, PropertyType.STUDIO, 2, new BigDecimal("80"), new BigDecimal("20"));
            when(propertyRepository.findBookingEngineVisible(ORG_ID)).thenReturn(List.of(a, b));
            // Block property A on day 0 only
            when(calendarDayRepository.findByPropertiesAndDateRange(anySet(), eq(FROM), eq(TO), eq(ORG_ID)))
                    .thenReturn(List.of(blockedDay(a, FROM)));
            when(priceEngine.resolvePriceRange(eq(1L), any(), any(), eq(ORG_ID)))
                    .thenReturn(Map.of(FROM, new BigDecimal("100"),
                            FROM.plusDays(1), new BigDecimal("100"),
                            TO, new BigDecimal("100")));
            when(priceEngine.resolvePriceRange(eq(2L), any(), any(), eq(ORG_ID)))
                    .thenReturn(Map.of(FROM, new BigDecimal("80"),
                            FROM.plusDays(1), new BigDecimal("80"),
                            TO, new BigDecimal("80")));

            CalendarAvailabilityResponseDto result = service.getCalendarAvailability(
                    ORG_ID, FROM, TO, null, null);

            AvailabilityDayDto day0 = result.days().get(0);
            assertThat(day0.availableCount()).isEqualTo(1); // only studio
            assertThat(day0.minPrice()).isEqualTo(80.0);
            assertThat(day0.availableTypes()).containsExactly("STUDIO");

            AvailabilityDayDto day1 = result.days().get(1);
            assertThat(day1.availableCount()).isEqualTo(2);
            assertThat(day1.minPrice()).isEqualTo(80.0);
        }

        @Test
        void whenCalendarDayStatusIsAvailable_thenNotConsideredBlocked() {
            Property a = buildProperty(1L, PropertyType.APARTMENT, 2, new BigDecimal("100"), new BigDecimal("30"));
            when(propertyRepository.findBookingEngineVisible(ORG_ID)).thenReturn(List.of(a));
            // Returned with status AVAILABLE: this should NOT mark the day as blocked
            CalendarDay cd = new CalendarDay();
            cd.setProperty(a);
            cd.setDate(FROM);
            cd.setStatus(CalendarDayStatus.AVAILABLE);
            cd.setOrganizationId(ORG_ID);
            when(calendarDayRepository.findByPropertiesAndDateRange(anySet(), eq(FROM), eq(TO), eq(ORG_ID)))
                    .thenReturn(List.of(cd));
            when(priceEngine.resolvePriceRange(eq(1L), any(), any(), eq(ORG_ID)))
                    .thenReturn(Map.of(FROM, new BigDecimal("100")));

            CalendarAvailabilityResponseDto result = service.getCalendarAvailability(
                    ORG_ID, FROM, TO, null, null);

            assertThat(result.days().get(0).available()).isTrue();
        }
    }

    @Nested
    @DisplayName("getCalendarAvailability - propertyTypes aggregation")
    class PropertyTypes {

        @Test
        void buildsPropertyTypesGroupedByTypeAlphabetically() {
            Property apt = buildProperty(1L, PropertyType.APARTMENT, 2, new BigDecimal("100"), new BigDecimal("30"));
            Property villa = buildProperty(2L, PropertyType.VILLA, 6, new BigDecimal("200"), new BigDecimal("70"));
            Property apt2 = buildProperty(3L, PropertyType.APARTMENT, 4, new BigDecimal("80"), new BigDecimal("20"));
            when(propertyRepository.findBookingEngineVisible(ORG_ID)).thenReturn(List.of(apt, villa, apt2));
            // Filter excludes all properties → builds empty response with all visible types
            CalendarAvailabilityResponseDto result = service.getCalendarAvailability(
                    ORG_ID, FROM, TO, List.of("NOT_A_TYPE"), null);

            List<PropertyTypeInfoDto> types = result.propertyTypes();
            assertThat(types).hasSize(2);
            // Alphabetical: APARTMENT before VILLA
            assertThat(types.get(0).type()).isEqualTo("APARTMENT");
            assertThat(types.get(0).count()).isEqualTo(2);
            assertThat(types.get(0).minPrice()).isEqualTo(80.0); // cheapest apt
            assertThat(types.get(0).minCleaningFee()).isEqualTo(20.0);
            assertThat(types.get(1).type()).isEqualTo("VILLA");
            assertThat(types.get(1).count()).isEqualTo(1);
            assertThat(types.get(1).label()).isEqualTo("Villa");
        }

        @Test
        void whenCleaningPriceIsZero_thenFilteredOut() {
            Property apt = buildProperty(1L, PropertyType.APARTMENT, 2, new BigDecimal("100"), BigDecimal.ZERO);
            when(propertyRepository.findBookingEngineVisible(ORG_ID)).thenReturn(List.of(apt));

            CalendarAvailabilityResponseDto result = service.getCalendarAvailability(
                    ORG_ID, FROM, TO, List.of("STUDIO"), null); // exclude apt

            assertThat(result.propertyTypes().get(0).minCleaningFee()).isNull();
        }

        @Test
        void whenNoNightlyPrice_thenPriceFieldNull() {
            Property apt = buildProperty(1L, PropertyType.APARTMENT, 2, null, new BigDecimal("30"));
            when(propertyRepository.findBookingEngineVisible(ORG_ID)).thenReturn(List.of(apt));

            CalendarAvailabilityResponseDto result = service.getCalendarAvailability(
                    ORG_ID, FROM, TO, List.of("STUDIO"), null);

            assertThat(result.propertyTypes().get(0).minPrice()).isNull();
        }
    }

    @Nested
    @DisplayName("getCalendarAvailability - single day range")
    class SingleDayRange {

        @Test
        void whenFromEqualsTo_thenOneDayReturned() {
            Property apt = buildProperty(1L, PropertyType.APARTMENT, 2, new BigDecimal("100"), new BigDecimal("30"));
            when(propertyRepository.findBookingEngineVisible(ORG_ID)).thenReturn(List.of(apt));
            when(calendarDayRepository.findByPropertiesAndDateRange(
                    anySet(), eq(FROM), eq(FROM), eq(ORG_ID)))
                    .thenReturn(List.of());
            when(priceEngine.resolvePriceRange(eq(1L), eq(FROM), eq(FROM.plusDays(1)), eq(ORG_ID)))
                    .thenReturn(Map.of(FROM, new BigDecimal("100")));

            CalendarAvailabilityResponseDto result = service.getCalendarAvailability(
                    ORG_ID, FROM, FROM, null, null);

            assertThat(result.days()).hasSize(1);
            assertThat(result.days().get(0).date()).isEqualTo(FROM.toString());
            assertThat(result.days().get(0).minPrice()).isEqualTo(100.0);
        }
    }
}
