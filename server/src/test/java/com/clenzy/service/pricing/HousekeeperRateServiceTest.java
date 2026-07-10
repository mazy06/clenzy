package com.clenzy.service.pricing;

import com.clenzy.dto.HousekeeperRatesDto;
import com.clenzy.dto.HousekeeperRatesDto.UpdateRequest;
import com.clenzy.dto.HousekeeperRatesDto.UpdateRequest.FlatRateEntry;
import com.clenzy.model.HousekeeperRate;
import com.clenzy.model.HousekeeperRate.RateUnit;
import com.clenzy.model.Property;
import com.clenzy.repository.HousekeeperRateRepository;
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

    @Mock private HousekeeperRateRepository rateRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private UserRepository userRepository;
    @Mock private CleaningPricingEngine cleaningPricingEngine;
    @Mock private TenantContext tenantContext;

    private HousekeeperRateService service;

    @BeforeEach
    void setUp() {
        service = new HousekeeperRateService(rateRepository, propertyRepository, userRepository,
                cleaningPricingEngine, tenantContext);
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

    @Test
    @DisplayName("getRates : advisories par logement + taux de référence org")
    void whenGetRates_thenReturnsAdvisoriesAndReference() {
        when(rateRepository.findByOrganizationIdAndUserId(7L, 42L)).thenReturn(List.of(
                new HousekeeperRate(7L, 42L, null, BigDecimal.valueOf(35), RateUnit.HOURLY),
                new HousekeeperRate(7L, 42L, 3L, BigDecimal.valueOf(90), RateUnit.FLAT)));
        when(propertyRepository.findByOrganizationId(7L)).thenReturn(List.of(orgProperty(3L, 7L)));

        HousekeeperRatesDto dto = service.getRates(42L);

        assertThat(dto.referenceHourlyRate()).isEqualByComparingTo("42");
        assertThat(dto.hourlyAmount()).isEqualByComparingTo("35");
        assertThat(dto.properties()).hasSize(1);
        assertThat(dto.properties().get(0).flatAmount()).isEqualByComparingTo("90");
        assertThat(dto.properties().get(0).advisoryMin()).isEqualByComparingTo("80");
        assertThat(dto.properties().get(0).advisoryRecommended()).isEqualByComparingTo("95");
        assertThat(dto.properties().get(0).advisoryMax()).isEqualByComparingTo("110");
    }

    @Test
    @DisplayName("updateRates : refuse un forfait sur un logement d'une AUTRE org")
    void whenFlatTargetsForeignProperty_thenAccessDenied() {
        when(propertyRepository.findById(99L)).thenReturn(Optional.of(orgProperty(99L, 666L)));

        UpdateRequest request = new UpdateRequest(null, List.of(new FlatRateEntry(99L, BigDecimal.valueOf(50))));

        assertThatThrownBy(() -> service.updateRates(42L, request))
                .isInstanceOf(AccessDeniedException.class);
        verify(rateRepository, never()).save(any());
    }

    @Test
    @DisplayName("updateRates : upsert hourly + sync des forfaits (absents supprimés)")
    void whenUpdateRates_thenUpsertsAndDeletesMissing() {
        HousekeeperRate existingHourly = new HousekeeperRate(7L, 42L, null, BigDecimal.valueOf(30), RateUnit.HOURLY);
        HousekeeperRate keptFlat = new HousekeeperRate(7L, 42L, 3L, BigDecimal.valueOf(90), RateUnit.FLAT);
        HousekeeperRate staleFlat = new HousekeeperRate(7L, 42L, 4L, BigDecimal.valueOf(70), RateUnit.FLAT);
        when(rateRepository.findByOrganizationIdAndUserIdAndPropertyIdIsNull(7L, 42L))
                .thenReturn(Optional.of(existingHourly));
        when(rateRepository.findByOrganizationIdAndUserId(7L, 42L))
                .thenReturn(List.of(existingHourly, keptFlat, staleFlat))
                .thenReturn(List.of());
        when(propertyRepository.findById(3L)).thenReturn(Optional.of(orgProperty(3L, 7L)));
        when(propertyRepository.findByOrganizationId(7L)).thenReturn(List.of());

        // Nouvel état : hourly 35, forfait P3 = 100 (maj), P4 absent (suppression).
        service.updateRates(42L, new UpdateRequest(BigDecimal.valueOf(35),
                List.of(new FlatRateEntry(3L, BigDecimal.valueOf(100)))));

        assertThat(existingHourly.getAmount()).isEqualByComparingTo("35");
        verify(rateRepository).save(existingHourly);
        assertThat(keptFlat.getAmount()).isEqualByComparingTo("100");
        verify(rateRepository).save(keptFlat);
        verify(rateRepository).delete(staleFlat);
    }

    @Test
    @DisplayName("updateRates : hourly null supprime le taux général")
    void whenHourlyNull_thenGeneralRateDeleted() {
        HousekeeperRate existingHourly = new HousekeeperRate(7L, 42L, null, BigDecimal.valueOf(30), RateUnit.HOURLY);
        when(rateRepository.findByOrganizationIdAndUserIdAndPropertyIdIsNull(7L, 42L))
                .thenReturn(Optional.of(existingHourly));
        when(rateRepository.findByOrganizationIdAndUserId(7L, 42L)).thenReturn(List.of(existingHourly));
        when(propertyRepository.findByOrganizationId(7L)).thenReturn(List.of());

        service.updateRates(42L, new UpdateRequest(null, List.of()));

        verify(rateRepository).delete(existingHourly);
        verify(rateRepository, never()).save(any());
    }
}
