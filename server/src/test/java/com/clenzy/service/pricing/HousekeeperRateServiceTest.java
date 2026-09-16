package com.clenzy.service.pricing;

import com.clenzy.dto.HousekeeperRatesDto;
import com.clenzy.dto.HousekeeperRatesDto.UpdateRequest;
import com.clenzy.dto.HousekeeperRatesDto.UpdateRequest.FlatRateEntry;
import com.clenzy.model.Property;
import com.clenzy.repository.ProviderTariffRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.pricing.CleaningPricingEngine.CleaningQuote;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Moteur Ménage 2A — service des tarifs prestataire.
 * Ownership org fail-closed (un forfait ne peut cibler qu'un logement de l'org)
 * + upsert « état complet » (absents supprimés, hourly null supprimé).
 */
@ExtendWith(MockitoExtension.class)
class HousekeeperRateServiceTest {

    @Mock private ProviderTariffRepository rateRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private UserRepository userRepository;
    @Mock private CleaningPricingEngine cleaningPricingEngine;
    @Mock private TenantContext tenantContext;
    @Mock private HousekeeperScoreService housekeeperScoreService;

    private HousekeeperRateService service;

    @BeforeEach
    void setUp() {
        service = new HousekeeperRateService(rateRepository, propertyRepository, userRepository,
                cleaningPricingEngine, tenantContext, housekeeperScoreService, new ProviderTariffService(rateRepository));
        lenient().when(housekeeperScoreService.computeScore(any(), any()))
                .thenReturn(com.clenzy.service.pricing.HousekeeperScoreService.HousekeeperScore.empty());
        lenient().when(tenantContext.getRequiredOrganizationId()).thenReturn(7L);
        lenient().when(cleaningPricingEngine.referenceHourlyRate()).thenReturn(42.0);
        lenient().when(cleaningPricingEngine.quote(any(Property.class), any())).thenReturn(
                new CleaningQuote(135, BigDecimal.valueOf(95), BigDecimal.valueOf(80), BigDecimal.valueOf(110)));
    }

    private Property orgProperty(Long id, Long orgId) {
        Property p = new Property();
        p.setId(id);
        p.setOrganizationId(orgId);
        p.setName("P" + id);
        return p;
    }

    @Test void sameUserReadsSameHourlyPriceAcrossOrganizations() {
        var tariff = new com.clenzy.model.ProviderTariff();
        tariff.setAmount(new BigDecimal("35")); tariff.setPricingModel(com.clenzy.marketplace.model.PricingModel.HOURLY);
        when(rateRepository.findByUserIdAndServiceKey(42L, "cleaning-turnover")).thenReturn(Optional.of(tariff));
        assertThat(service.getRates(42L).hourlyAmount()).isEqualByComparingTo("35");
        when(tenantContext.getRequiredOrganizationId()).thenReturn(8L);
        assertThat(service.getRates(42L).hourlyAmount()).isEqualByComparingTo("35");
    }

    @Test void propertyOverridesAreRejectedBeforeWriting() {
        assertThatThrownBy(() -> service.updateRates(42L, new UpdateRequest(new BigDecimal("35"),
                List.of(new FlatRateEntry(3L, new BigDecimal("100"))))))
            .isInstanceOf(IllegalArgumentException.class);
        verify(rateRepository, never()).save(any());
        verifyNoInteractions(propertyRepository);
    }

    @Test void updateChangesGlobalRateAndKeepsItsCurrency() {
        var tariff = new com.clenzy.model.ProviderTariff();
        tariff.setCurrency("MAD"); tariff.setNeedsReview(true);
        when(rateRepository.findByUserIdAndServiceKey(42L, "cleaning-turnover")).thenReturn(Optional.of(tariff));
        service.updateRates(42L, new UpdateRequest(new BigDecimal("35"), List.of()));
        assertThat(tariff.getAmount()).isEqualByComparingTo("35");
        assertThat(tariff.getCurrency()).isEqualTo("MAD");
        assertThat(tariff.isNeedsReview()).isFalse();
        verify(rateRepository, times(2)).lockUser(42L);
        verify(rateRepository).save(tariff);
    }

    @Test void clearingPriceKeepsTheCanonicalReferenceOnQuote() {
        var tariff = new com.clenzy.model.ProviderTariff();
        when(rateRepository.findByUserIdAndServiceKey(42L, "cleaning-turnover")).thenReturn(Optional.of(tariff));
        service.updateRates(42L, new UpdateRequest(null, List.of()));
        assertThat(tariff.getAmount()).isNull();
        assertThat(tariff.getPricingModel()).isEqualTo(com.clenzy.marketplace.model.PricingModel.ON_QUOTE);
        verify(rateRepository, never()).delete(any());
    }
}
