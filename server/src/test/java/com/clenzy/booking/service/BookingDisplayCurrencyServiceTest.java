package com.clenzy.booking.service;

import com.clenzy.booking.dto.AvailabilityResponseDto;
import com.clenzy.booking.dto.AvailabilityResponseDto.NightBreakdown;
import com.clenzy.booking.dto.PropertyCalendarDto;
import com.clenzy.booking.dto.PropertyCalendarDto.CalendarDayDto;
import com.clenzy.booking.dto.PublicPropertyDetailDto;
import com.clenzy.booking.dto.PublicPropertyDto;
import com.clenzy.service.CurrencyConverterService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Conversion d'affichage multi-devise du Booking Engine (CLZ Domaine 2) : conversion EUR->MAD,
 * court-circuit même devise, devise non supportée, repli tout-ou-rien si taux indisponible.
 */
@ExtendWith(MockitoExtension.class)
class BookingDisplayCurrencyServiceTest {

    @Mock private CurrencyConverterService converter;

    private static final LocalDate DATE = LocalDate.of(2026, 6, 20);

    private BookingDisplayCurrencyService service() {
        return new BookingDisplayCurrencyService(converter);
    }

    /** Taux fictif EUR->MAD = x11 pour tout montant. */
    private void stubEurToMad() {
        lenient().when(converter.convert(any(), eq("EUR"), eq("MAD"), any()))
            .thenAnswer(inv -> ((BigDecimal) inv.getArgument(0)).multiply(new BigDecimal("11")));
    }

    private PublicPropertyDto propertyEur() {
        return new PublicPropertyDto(1L, "Apt", "APARTMENT", "Paris", "FR", 1, 1, 2, 40,
            new BigDecimal("100.00"), new BigDecimal("30.00"), 2, "EUR", null, List.of(), List.of(), "15:00", "11:00", null, null);
    }

    private AvailabilityResponseDto availabilityEur() {
        return new AvailabilityResponseDto(true, 1L, "Apt", DATE, DATE.plusDays(3), 2, 3,
            List.of(new NightBreakdown(DATE, new BigDecimal("100.00"), "BASE")),
            new BigDecimal("300.00"), new BigDecimal("30.00"), new BigDecimal("10.00"), new BigDecimal("340.00"),
            BigDecimal.ZERO, "EUR", 2, 4, "15:00", "11:00", List.of());
    }

    @Test
    void supportedCurrencies_returnsEurMadSar() {
        assertThat(service().supportedCurrencies()).containsExactlyInAnyOrder("EUR", "MAD", "SAR");
    }

    @Test
    void convertProperty_convertsPriceFields_andSetsCurrency() {
        stubEurToMad();
        PublicPropertyDto out = service().convertProperty(propertyEur(), "MAD", DATE);

        assertThat(out.currency()).isEqualTo("MAD");
        assertThat(out.priceFrom()).isEqualByComparingTo("1100.00");
        assertThat(out.cleaningFee()).isEqualByComparingTo("330.00");
        assertThat(out.name()).isEqualTo("Apt"); // champs non monétaires inchangés
    }

    @Test
    void convertProperty_sameCurrency_returnsUnchanged_noConverterCall() {
        PublicPropertyDto in = propertyEur();
        PublicPropertyDto out = service().convertProperty(in, "EUR", DATE);

        assertThat(out).isSameAs(in);
        verifyNoInteractions(converter);
    }

    @Test
    void convertProperty_unsupportedTarget_returnsUnchanged() {
        PublicPropertyDto in = propertyEur();
        PublicPropertyDto out = service().convertProperty(in, "USD", DATE);

        assertThat(out).isSameAs(in);
        verifyNoInteractions(converter);
    }

    @Test
    void convertProperty_blankOrNullCurrencyParam_returnsUnchanged() {
        PublicPropertyDto in = propertyEur();
        assertThat(service().convertProperty(in, null, DATE)).isSameAs(in);
        assertThat(service().convertProperty(in, "  ", DATE)).isSameAs(in);
        verifyNoInteractions(converter);
    }

    @Test
    void convertProperty_rateUnavailable_fallsBackToOriginal() {
        when(converter.convert(any(), eq("EUR"), eq("MAD"), any()))
            .thenThrow(new IllegalStateException("no rate"));
        PublicPropertyDto in = propertyEur();

        PublicPropertyDto out = service().convertProperty(in, "MAD", DATE);

        assertThat(out).isSameAs(in); // tout-ou-rien : DTO d'origine, devise EUR conservée
        assertThat(out.currency()).isEqualTo("EUR");
    }

    @Test
    void convertAvailability_convertsAllFieldsAndBreakdown() {
        stubEurToMad();
        AvailabilityResponseDto out = service().convertAvailability(availabilityEur(), "MAD", DATE);

        assertThat(out.currency()).isEqualTo("MAD");
        assertThat(out.subtotal()).isEqualByComparingTo("3300.00");
        assertThat(out.cleaningFee()).isEqualByComparingTo("330.00");
        assertThat(out.touristTax()).isEqualByComparingTo("110.00");
        assertThat(out.total()).isEqualByComparingTo("3740.00");
        assertThat(out.breakdown()).hasSize(1);
        assertThat(out.breakdown().get(0).price()).isEqualByComparingTo("1100.00");
        assertThat(out.breakdown().get(0).rateType()).isEqualTo("BASE");
    }

    @Test
    void convertCalendar_convertsPerDayPrices() {
        stubEurToMad();
        PropertyCalendarDto cal = new PropertyCalendarDto(1L, "EUR", List.of(
            new CalendarDayDto(DATE, true, new BigDecimal("100.00"), 2, false, false),
            new CalendarDayDto(DATE.plusDays(1), false, null, 2, false, false)));

        PropertyCalendarDto out = service().convertCalendar(cal, "MAD", DATE);

        assertThat(out.currency()).isEqualTo("MAD");
        assertThat(out.days().get(0).price()).isEqualByComparingTo("1100.00");
        assertThat(out.days().get(0).available()).isTrue();
        assertThat(out.days().get(1).price()).isNull(); // jour non tarifé : reste null
    }

    @Test
    void convertDetail_sameCurrency_noConversion() {
        PublicPropertyDetailDto in = new PublicPropertyDetailDto(1L, "Apt", "desc", "APARTMENT", "Paris", "FR",
            null, null, 1, 1, 2, 40, new BigDecimal("100.00"), 2, "EUR", List.of(), List.of(), "15:00", "11:00", null);
        PublicPropertyDetailDto out = service().convertDetail(in, "EUR", DATE);
        assertThat(out).isSameAs(in);
        verify(converter, never()).convert(any(), any(), any(), any());
    }
}
