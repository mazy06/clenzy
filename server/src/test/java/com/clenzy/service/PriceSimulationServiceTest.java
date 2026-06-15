package com.clenzy.service;

import com.clenzy.dto.PriceBreakdownDto;
import com.clenzy.dto.PriceSimulationRequest;
import com.clenzy.exception.NotFoundException;
import com.clenzy.fiscal.FiscalEngine;
import com.clenzy.fiscal.TaxResult;
import com.clenzy.fiscal.TaxableItem;
import com.clenzy.fiscal.TouristTaxInput;
import com.clenzy.fiscal.TouristTaxResult;
import com.clenzy.model.Country;
import com.clenzy.model.Property;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.access.OrganizationAccessGuard;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Simulation de prix TTC multi-pays (CLZ-P0-18) : orchestration HT (PriceEngine) + TVA + taxe de
 * séjour (FiscalEngine) avec ownership et recalcul serveur.
 */
class PriceSimulationServiceTest {

    private final PriceEngine priceEngine = mock(PriceEngine.class);
    private final FiscalEngine fiscalEngine = mock(FiscalEngine.class);
    private final PropertyRepository propertyRepository = mock(PropertyRepository.class);
    private final CountryService countryService = mock(CountryService.class);
    private final OrganizationAccessGuard accessGuard = mock(OrganizationAccessGuard.class);

    private final PriceSimulationService service = new PriceSimulationService(
        priceEngine, fiscalEngine, propertyRepository, countryService, accessGuard);

    private Property property(String countryCode) {
        Property p = new Property();
        p.setOrganizationId(1L);
        p.setCountryCode(countryCode);
        return p;
    }

    @Test
    void simulatesFranceWithVatAndPerPersonTouristTax() {
        LocalDate in = LocalDate.of(2026, 7, 1);
        LocalDate out = LocalDate.of(2026, 7, 4); // 3 nuits
        when(propertyRepository.findById(10L)).thenReturn(Optional.of(property("FR")));
        Map<LocalDate, BigDecimal> nightly = new LinkedHashMap<>();
        nightly.put(in, new BigDecimal("100.00"));
        nightly.put(in.plusDays(1), new BigDecimal("100.00"));
        nightly.put(in.plusDays(2), new BigDecimal("100.00"));
        when(priceEngine.resolvePriceRange(eq(10L), eq(in), eq(out), eq(1L))).thenReturn(nightly);
        when(fiscalEngine.calculateTax(eq("FR"), any(TaxableItem.class), eq(in)))
            .thenReturn(new TaxResult(new BigDecimal("300.00"), new BigDecimal("30.00"),
                new BigDecimal("330.00"), new BigDecimal("0.1000"), "TVA hébergement", "ACCOMMODATION"));
        when(fiscalEngine.calculateTouristTax(eq("FR"), any(TouristTaxInput.class)))
            .thenReturn(new TouristTaxResult(new BigDecimal("9.00"),
                "Taxe de sejour: 2 pers x 3 nuits x 1.50 EUR", new BigDecimal("1.50")));
        when(countryService.findByCode("FR")).thenReturn(Optional.empty()); // repli EUR

        PriceBreakdownDto out1 = service.simulate(new PriceSimulationRequest(
            10L, in, out, 2, 12, new BigDecimal("1.50"), null));

        assertThat(out1.countryCode()).isEqualTo("FR");
        assertThat(out1.currency()).isEqualTo("EUR");
        assertThat(out1.nights()).isEqualTo(3);
        assertThat(out1.accommodationHt()).isEqualByComparingTo("300.00");
        assertThat(out1.vatAmount()).isEqualByComparingTo("30.00");
        assertThat(out1.accommodationTtc()).isEqualByComparingTo("330.00");
        assertThat(out1.touristTax()).isEqualByComparingTo("9.00");
        assertThat(out1.grandTotalTtc()).isEqualByComparingTo("339.00");
    }

    @Test
    void simulatesSaudiWithVat15AndCurrencySar() {
        LocalDate in = LocalDate.of(2026, 3, 10);
        LocalDate out = LocalDate.of(2026, 3, 12); // 2 nuits
        when(propertyRepository.findById(20L)).thenReturn(Optional.of(property("SA")));
        Map<LocalDate, BigDecimal> nightly = new LinkedHashMap<>();
        nightly.put(in, new BigDecimal("200.00"));
        nightly.put(in.plusDays(1), new BigDecimal("200.00"));
        when(priceEngine.resolvePriceRange(eq(20L), eq(in), eq(out), eq(1L))).thenReturn(nightly);
        when(fiscalEngine.calculateTax(eq("SA"), any(TaxableItem.class), eq(in)))
            .thenReturn(new TaxResult(new BigDecimal("400.00"), new BigDecimal("60.00"),
                new BigDecimal("460.00"), new BigDecimal("0.1500"), "VAT", "ACCOMMODATION"));
        when(fiscalEngine.calculateTouristTax(eq("SA"), any(TouristTaxInput.class)))
            .thenReturn(new TouristTaxResult(new BigDecimal("20.00"), "Municipality fee", BigDecimal.ZERO));
        Country sa = mock(Country.class);
        when(sa.getDefaultCurrency()).thenReturn("SAR");
        when(countryService.findByCode("SA")).thenReturn(Optional.of(sa));

        PriceBreakdownDto result = service.simulate(new PriceSimulationRequest(
            20L, in, out, 2, 0, null, null));

        assertThat(result.countryCode()).isEqualTo("SA");
        assertThat(result.currency()).isEqualTo("SAR");
        assertThat(result.vatRate()).isEqualByComparingTo("0.1500");
        assertThat(result.accommodationTtc()).isEqualByComparingTo("460.00");
        assertThat(result.grandTotalTtc()).isEqualByComparingTo("480.00");
    }

    @Test
    void deniesAccessWhenPropertyBelongsToAnotherOrg() {
        LocalDate in = LocalDate.of(2026, 7, 1);
        LocalDate out = LocalDate.of(2026, 7, 2);
        when(propertyRepository.findById(99L)).thenReturn(Optional.of(property("FR")));
        doThrow(new AccessDeniedException("denied"))
            .when(accessGuard).requireSameOrganization(eq(1L), any(String.class));

        assertThatThrownBy(() -> service.simulate(new PriceSimulationRequest(
            99L, in, out, 1, 0, null, null)))
            .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void throwsNotFoundWhenPropertyMissing() {
        when(propertyRepository.findById(404L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.simulate(new PriceSimulationRequest(
            404L, LocalDate.of(2026, 7, 1), LocalDate.of(2026, 7, 2), 1, 0, null, null)))
            .isInstanceOf(NotFoundException.class);
    }

    @Test
    void rejectsCheckoutNotAfterCheckin() {
        assertThatThrownBy(() -> service.simulate(new PriceSimulationRequest(
            10L, LocalDate.of(2026, 7, 5), LocalDate.of(2026, 7, 5), 2, 0, null, null)))
            .isInstanceOf(IllegalArgumentException.class);
    }
}
