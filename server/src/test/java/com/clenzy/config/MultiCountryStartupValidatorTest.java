package com.clenzy.config;

import com.clenzy.fiscal.TaxCalculatorRegistry;
import com.clenzy.model.Country;
import com.clenzy.service.CountryService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

/**
 * Fail-fast au boot du socle multi-pays (CLZ-P0-03).
 */
@ExtendWith(MockitoExtension.class)
class MultiCountryStartupValidatorTest {

    @Mock
    CountryService countryService;

    @Mock
    TaxCalculatorRegistry taxCalculatorRegistry;

    @InjectMocks
    MultiCountryStartupValidator validator;

    private Country country(String code, String currency, String locale, String tz, String weekend) {
        Country c = new Country();
        c.setCountryCode(code);
        c.setDefaultCurrency(currency);
        c.setDefaultLocale(locale);
        c.setTimezone(tz);
        c.setWeekendDays(weekend);
        return c;
    }

    @Test
    void whenValidActiveCountries_thenNoException() {
        Country fr = country("FR", "EUR", "fr-FR", "Europe/Paris", "SATURDAY,SUNDAY");
        when(countryService.getActiveCountries()).thenReturn(List.of(fr));
        when(taxCalculatorRegistry.isSupported("FR")).thenReturn(true);

        assertThatCode(validator::validateActiveCountries).doesNotThrowAnyException();
    }

    @Test
    void whenNoActiveCountry_thenNoException() {
        when(countryService.getActiveCountries()).thenReturn(List.of());

        assertThatCode(validator::validateActiveCountries).doesNotThrowAnyException();
    }

    @Test
    void whenInvalidTimezone_thenFailFast() {
        Country bad = country("FR", "EUR", "fr-FR", "Mars/Phobos", "SATURDAY,SUNDAY");
        when(countryService.getActiveCountries()).thenReturn(List.of(bad));
        when(taxCalculatorRegistry.isSupported("FR")).thenReturn(true);

        assertThatThrownBy(validator::validateActiveCountries)
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void whenInvalidWeekendDay_thenFailFast() {
        Country bad = country("SA", "SAR", "ar-SA", "Asia/Riyadh", "FUNDAY");
        when(countryService.getActiveCountries()).thenReturn(List.of(bad));
        when(taxCalculatorRegistry.isSupported("SA")).thenReturn(true);

        assertThatThrownBy(validator::validateActiveCountries)
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void whenNoTaxCalculator_thenFailFast() {
        Country ma = country("MA", "MAD", "fr-MA", "Africa/Casablanca", "SATURDAY,SUNDAY");
        when(countryService.getActiveCountries()).thenReturn(List.of(ma));
        when(taxCalculatorRegistry.isSupported("MA")).thenReturn(false);

        assertThatThrownBy(validator::validateActiveCountries)
                .isInstanceOf(IllegalStateException.class);
    }
}
