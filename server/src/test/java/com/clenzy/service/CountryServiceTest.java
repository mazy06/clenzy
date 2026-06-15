package com.clenzy.service;

import com.clenzy.config.FiscalProperties;
import com.clenzy.model.Country;
import com.clenzy.repository.CountryRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * Resolution flag-aware du socle multi-pays (CLZ-P0-01/03).
 * Non-regression France : la France reste operationnelle meme flag OFF.
 */
@ExtendWith(MockitoExtension.class)
class CountryServiceTest {

    @Mock
    CountryRepository countryRepository;

    @Mock
    FiscalProperties fiscalProperties;

    @InjectMocks
    CountryService service;

    private Country country(String code, boolean enabled) {
        Country c = new Country();
        c.setCountryCode(code);
        c.setEnabled(enabled);
        return c;
    }

    @Test
    void getActiveCountries_whenFlagOff_thenOnlyFrance() {
        when(fiscalProperties.isEnabled()).thenReturn(false);
        Country fr = country("FR", true);
        when(countryRepository.findByCountryCode("FR")).thenReturn(Optional.of(fr));

        assertThat(service.getActiveCountries()).containsExactly(fr);
    }

    @Test
    void getActiveCountries_whenFlagOn_thenEnabledCountries() {
        when(fiscalProperties.isEnabled()).thenReturn(true);
        Country fr = country("FR", true);
        Country ma = country("MA", true);
        when(countryRepository.findByEnabledTrue()).thenReturn(List.of(fr, ma));

        assertThat(service.getActiveCountries()).containsExactly(fr, ma);
    }

    @Test
    void isOperational_franceAlwaysTrue_evenFlagOff() {
        // Court-circuit : aucun acces flag/repo pour la France.
        assertThat(service.isOperational("FR")).isTrue();
    }

    @Test
    void isOperational_nonFranceFlagOff_thenFalse() {
        when(fiscalProperties.isEnabled()).thenReturn(false);

        assertThat(service.isOperational("MA")).isFalse();
    }

    @Test
    void isOperational_enabledCountryFlagOn_thenTrue() {
        when(fiscalProperties.isEnabled()).thenReturn(true);
        when(countryRepository.findByCountryCode("MA")).thenReturn(Optional.of(country("MA", true)));

        assertThat(service.isOperational("MA")).isTrue();
    }

    @Test
    void isOperational_disabledCountryFlagOn_thenFalse() {
        when(fiscalProperties.isEnabled()).thenReturn(true);
        when(countryRepository.findByCountryCode("SA")).thenReturn(Optional.of(country("SA", false)));

        assertThat(service.isOperational("SA")).isFalse();
    }

    @Test
    void isOperational_null_thenFalse() {
        assertThat(service.isOperational(null)).isFalse();
    }

    @Test
    void findByCode_normalizesCaseAndTrim() {
        Country ma = country("MA", true);
        when(countryRepository.findByCountryCode("MA")).thenReturn(Optional.of(ma));

        assertThat(service.findByCode("  ma  ")).contains(ma);
    }

    @Test
    void findByCode_blank_thenEmpty() {
        assertThat(service.findByCode("  ")).isEmpty();
    }
}
