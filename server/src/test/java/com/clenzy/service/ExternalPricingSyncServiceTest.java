package com.clenzy.service;

import com.clenzy.dto.ExternalPriceRecommendation;
import com.clenzy.model.ExternalPricingConfig;
import com.clenzy.model.PricingProvider;
import com.clenzy.model.Property;
import com.clenzy.model.RateOverride;
import com.clenzy.repository.ExternalPricingConfigRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.RateOverrideRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ExternalPricingSyncServiceTest {

    @Mock private ExternalPricingConfigRepository configRepository;
    @Mock private PriceLabsService priceLabsService;
    @Mock private RateOverrideRepository rateOverrideRepository;
    @Mock private PropertyRepository propertyRepository;

    @InjectMocks
    private ExternalPricingSyncService service;

    private static final Long ORG_ID = 1L;

    private ExternalPricingConfig enabledConfig;

    @BeforeEach
    void setUp() {
        enabledConfig = new ExternalPricingConfig();
        enabledConfig.setId(1L);
        enabledConfig.setOrganizationId(ORG_ID);
        enabledConfig.setProvider(PricingProvider.PRICELABS);
        enabledConfig.setApiKey("test-key");
        enabledConfig.setEnabled(true);
        enabledConfig.setPropertyMappings(Map.of("100", "pl-123"));
    }

    @Test
    void syncPricesForOrg_disabledConfig_skips() {
        enabledConfig.setEnabled(false);
        when(configRepository.findByOrganizationId(ORG_ID)).thenReturn(List.of(enabledConfig));

        int result = service.syncPricesForOrg(ORG_ID);

        assertEquals(0, result);
        verifyNoInteractions(priceLabsService);
    }

    @Test
    void syncPricesForOrg_noConfigs_returnsZero() {
        when(configRepository.findByOrganizationId(ORG_ID)).thenReturn(List.of());

        int result = service.syncPricesForOrg(ORG_ID);

        assertEquals(0, result);
    }

    @Test
    void syncPricesForOrg_withRecommendations_createsOverrides() {
        Property property = new Property();
        property.setId(100L);

        ExternalPriceRecommendation rec = new ExternalPriceRecommendation(
            100L, LocalDate.of(2025, 8, 1), new BigDecimal("150.00"), "EUR", 0.95, "pricelabs");

        when(configRepository.findByOrganizationId(ORG_ID)).thenReturn(List.of(enabledConfig));
        when(priceLabsService.fetchRecommendations(eq(enabledConfig), eq(100L), any(LocalDate.class), any(LocalDate.class)))
            .thenReturn(List.of(rec));
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));
        when(rateOverrideRepository.findByPropertyIdAndDate(100L, LocalDate.of(2025, 8, 1), ORG_ID))
            .thenReturn(Optional.empty());
        when(rateOverrideRepository.save(any(RateOverride.class))).thenAnswer(inv -> inv.getArgument(0));
        when(configRepository.save(any(ExternalPricingConfig.class))).thenAnswer(inv -> inv.getArgument(0));

        int result = service.syncPricesForOrg(ORG_ID);

        assertEquals(1, result);
        verify(rateOverrideRepository).save(argThat(override ->
            override.getNightlyPrice().compareTo(new BigDecimal("150.00")) == 0
            && "EXTERNAL_PRICING".equals(override.getSource())
        ));
    }

    @Test
    void syncPricesForOrg_existingExternalOverride_updatesPrice() {
        Property property = new Property();
        property.setId(100L);

        RateOverride existingOverride = new RateOverride(property, LocalDate.of(2025, 8, 1),
            new BigDecimal("120.00"), "EXTERNAL_PRICING", ORG_ID);

        ExternalPriceRecommendation rec = new ExternalPriceRecommendation(
            100L, LocalDate.of(2025, 8, 1), new BigDecimal("160.00"), "EUR", 0.9, "pricelabs");

        when(configRepository.findByOrganizationId(ORG_ID)).thenReturn(List.of(enabledConfig));
        when(priceLabsService.fetchRecommendations(eq(enabledConfig), eq(100L), any(LocalDate.class), any(LocalDate.class)))
            .thenReturn(List.of(rec));
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));
        when(rateOverrideRepository.findByPropertyIdAndDate(100L, LocalDate.of(2025, 8, 1), ORG_ID))
            .thenReturn(Optional.of(existingOverride));
        when(rateOverrideRepository.save(any(RateOverride.class))).thenAnswer(inv -> inv.getArgument(0));
        when(configRepository.save(any(ExternalPricingConfig.class))).thenAnswer(inv -> inv.getArgument(0));

        int result = service.syncPricesForOrg(ORG_ID);

        assertEquals(1, result);
        assertEquals(new BigDecimal("160.00"), existingOverride.getNightlyPrice());
    }

    @Test
    void syncPricesForOrg_existingManualOverride_doesNotUpdate() {
        Property property = new Property();
        property.setId(100L);

        RateOverride manualOverride = new RateOverride(property, LocalDate.of(2025, 8, 1),
            new BigDecimal("200.00"), "MANUAL", ORG_ID);

        ExternalPriceRecommendation rec = new ExternalPriceRecommendation(
            100L, LocalDate.of(2025, 8, 1), new BigDecimal("150.00"), "EUR", 0.9, "pricelabs");

        when(configRepository.findByOrganizationId(ORG_ID)).thenReturn(List.of(enabledConfig));
        when(priceLabsService.fetchRecommendations(eq(enabledConfig), eq(100L), any(LocalDate.class), any(LocalDate.class)))
            .thenReturn(List.of(rec));
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));
        when(rateOverrideRepository.findByPropertyIdAndDate(100L, LocalDate.of(2025, 8, 1), ORG_ID))
            .thenReturn(Optional.of(manualOverride));
        when(configRepository.save(any(ExternalPricingConfig.class))).thenAnswer(inv -> inv.getArgument(0));

        service.syncPricesForOrg(ORG_ID);

        // Manual override should NOT be updated
        assertEquals(new BigDecimal("200.00"), manualOverride.getNightlyPrice());
        verify(rateOverrideRepository, never()).save(manualOverride);
    }
}
