package com.clenzy.service;

import com.clenzy.dto.TouristTaxCalculationDto;
import com.clenzy.model.TouristTaxConfig;
import com.clenzy.model.TouristTaxConfig.TaxCalculationMode;
import com.clenzy.repository.TouristTaxConfigRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TouristTaxServiceTest {

    @Mock private TouristTaxConfigRepository configRepository;

    @InjectMocks
    private TouristTaxService service;

    private static final Long ORG_ID = 1L;
    private static final Long PROPERTY_ID = 100L;

    private TouristTaxConfig createConfig(TaxCalculationMode mode) {
        TouristTaxConfig config = new TouristTaxConfig();
        config.setId(1L);
        config.setOrganizationId(ORG_ID);
        config.setPropertyId(PROPERTY_ID);
        config.setCommuneName("Paris");
        config.setCommuneCode("75056");
        config.setCalculationMode(mode);
        config.setEnabled(true);
        return config;
    }

    @Test
    void calculate_perPersonPerNight() {
        TouristTaxConfig config = createConfig(TaxCalculationMode.PER_PERSON_PER_NIGHT);
        config.setRatePerPerson(new BigDecimal("2.50"));
        when(configRepository.findByPropertyId(PROPERTY_ID, ORG_ID)).thenReturn(Optional.of(config));

        TouristTaxCalculationDto result = service.calculate(PROPERTY_ID, ORG_ID,
            3, 2, new BigDecimal("100.00"));

        assertNotNull(result);
        // 2.50 * 2 guests = 5.00 per night, * 3 nights = 15.00
        assertEquals(0, new BigDecimal("5.00").compareTo(result.taxPerNight()));
        assertEquals(0, new BigDecimal("15.00").compareTo(result.totalTax()));
        assertEquals(3, result.nights());
        assertEquals(2, result.guests());
    }

    @Test
    void calculate_percentageOfRate() {
        TouristTaxConfig config = createConfig(TaxCalculationMode.PERCENTAGE_OF_RATE);
        config.setPercentageRate(new BigDecimal("0.0500")); // 5%
        when(configRepository.findByPropertyId(PROPERTY_ID, ORG_ID)).thenReturn(Optional.of(config));

        TouristTaxCalculationDto result = service.calculate(PROPERTY_ID, ORG_ID,
            4, 2, new BigDecimal("200.00"));

        assertNotNull(result);
        // 5% of 200 = 10.00 per night, * 4 nights = 40.00
        assertEquals(0, new BigDecimal("10.00").compareTo(result.taxPerNight()));
        assertEquals(0, new BigDecimal("40.00").compareTo(result.totalTax()));
    }

    @Test
    void calculate_flatPerNight() {
        TouristTaxConfig config = createConfig(TaxCalculationMode.FLAT_PER_NIGHT);
        config.setRatePerPerson(new BigDecimal("3.00"));
        when(configRepository.findByPropertyId(PROPERTY_ID, ORG_ID)).thenReturn(Optional.of(config));

        TouristTaxCalculationDto result = service.calculate(PROPERTY_ID, ORG_ID,
            5, 4, new BigDecimal("150.00"));

        assertNotNull(result);
        // 3.00 per night * 5 nights = 15.00
        assertEquals(0, new BigDecimal("3.00").compareTo(result.taxPerNight()));
        assertEquals(0, new BigDecimal("15.00").compareTo(result.totalTax()));
    }

    @Test
    void calculate_maxNightsCapped() {
        TouristTaxConfig config = createConfig(TaxCalculationMode.PER_PERSON_PER_NIGHT);
        config.setRatePerPerson(new BigDecimal("2.00"));
        config.setMaxNights(5);
        when(configRepository.findByPropertyId(PROPERTY_ID, ORG_ID)).thenReturn(Optional.of(config));

        TouristTaxCalculationDto result = service.calculate(PROPERTY_ID, ORG_ID,
            10, 1, new BigDecimal("100.00"));

        // Capped at 5 nights: 2.00 * 1 * 5 = 10.00
        assertEquals(5, result.nights());
        assertEquals(0, new BigDecimal("10.00").compareTo(result.totalTax()));
    }

    @Test
    void calculate_noConfig_returnsNull() {
        when(configRepository.findByPropertyId(PROPERTY_ID, ORG_ID)).thenReturn(Optional.empty());

        TouristTaxCalculationDto result = service.calculate(PROPERTY_ID, ORG_ID,
            3, 2, new BigDecimal("100.00"));

        assertNull(result);
    }

    @Test
    void calculate_disabledConfig_returnsNull() {
        TouristTaxConfig config = createConfig(TaxCalculationMode.PER_PERSON_PER_NIGHT);
        config.setEnabled(false);
        when(configRepository.findByPropertyId(PROPERTY_ID, ORG_ID)).thenReturn(Optional.of(config));

        TouristTaxCalculationDto result = service.calculate(PROPERTY_ID, ORG_ID,
            3, 2, new BigDecimal("100.00"));

        assertNull(result);
    }
}
