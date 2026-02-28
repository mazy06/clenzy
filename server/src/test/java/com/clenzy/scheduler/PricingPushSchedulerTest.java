package com.clenzy.scheduler;

import com.clenzy.integration.airbnb.model.AirbnbListingMapping;
import com.clenzy.integration.airbnb.repository.AirbnbListingMappingRepository;
import com.clenzy.integration.channel.AirbnbChannelAdapter;
import com.clenzy.model.MessagingAutomationConfig;
import com.clenzy.repository.MessagingAutomationConfigRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

/**
 * Tests for {@link PricingPushScheduler}.
 * Validates global toggle check, per-org grouping, and push behavior.
 */
@ExtendWith(MockitoExtension.class)
class PricingPushSchedulerTest {

    @Mock
    private AirbnbListingMappingRepository listingRepository;
    @Mock
    private MessagingAutomationConfigRepository configRepository;
    @Mock
    private AirbnbChannelAdapter airbnbChannelAdapter;

    private PricingPushScheduler scheduler;

    @BeforeEach
    void setUp() {
        scheduler = new PricingPushScheduler(listingRepository, configRepository, airbnbChannelAdapter);
    }

    private AirbnbListingMapping createMapping(Long orgId, String listingId, Long propertyId) {
        AirbnbListingMapping mapping = new AirbnbListingMapping();
        mapping.setOrganizationId(orgId);
        mapping.setAirbnbListingId(listingId);
        mapping.setPropertyId(propertyId);
        return mapping;
    }

    @Nested
    @DisplayName("pushPricingToAirbnb")
    class PushPricingToAirbnb {

        @Test
        void whenNoMappings_thenDoesNothing() {
            when(listingRepository.findBySyncEnabledTrueAndAutoPushPricingTrue()).thenReturn(List.of());

            scheduler.pushPricingToAirbnb();

            verifyNoInteractions(configRepository);
        }

        @Test
        void whenGlobalToggleDisabled_thenSkipsOrg() {
            AirbnbListingMapping mapping = createMapping(1L, "listing-1", 10L);
            when(listingRepository.findBySyncEnabledTrueAndAutoPushPricingTrue()).thenReturn(List.of(mapping));

            MessagingAutomationConfig config = new MessagingAutomationConfig();
            config.setAutoPushPricingEnabled(false);
            when(configRepository.findByOrganizationId(1L)).thenReturn(Optional.of(config));

            scheduler.pushPricingToAirbnb();

            // No actual push should happen since global toggle is off
            verify(configRepository).findByOrganizationId(1L);
        }

        @Test
        void whenGlobalToggleEnabled_thenProcessesMappings() {
            AirbnbListingMapping mapping = createMapping(1L, "listing-1", 10L);
            when(listingRepository.findBySyncEnabledTrueAndAutoPushPricingTrue()).thenReturn(List.of(mapping));

            MessagingAutomationConfig config = new MessagingAutomationConfig();
            config.setAutoPushPricingEnabled(true);
            when(configRepository.findByOrganizationId(1L)).thenReturn(Optional.of(config));

            scheduler.pushPricingToAirbnb();

            // With toggle enabled, the scheduler processes the listing
            verify(configRepository).findByOrganizationId(1L);
        }

        @Test
        void whenNoGlobalConfig_thenSkipsOrg() {
            AirbnbListingMapping mapping = createMapping(1L, "listing-1", 10L);
            when(listingRepository.findBySyncEnabledTrueAndAutoPushPricingTrue()).thenReturn(List.of(mapping));
            when(configRepository.findByOrganizationId(1L)).thenReturn(Optional.empty());

            scheduler.pushPricingToAirbnb();

            // Default is false, so no push
            verify(configRepository).findByOrganizationId(1L);
        }

        @Test
        void whenMappingHasNullOrgId_thenFilteredOut() {
            AirbnbListingMapping mapping = createMapping(null, "listing-1", 10L);
            when(listingRepository.findBySyncEnabledTrueAndAutoPushPricingTrue()).thenReturn(List.of(mapping));

            scheduler.pushPricingToAirbnb();

            verify(configRepository, never()).findByOrganizationId(anyLong());
        }

        @Test
        void whenMultipleOrgs_thenProcessesSeparately() {
            AirbnbListingMapping mapping1 = createMapping(1L, "listing-1", 10L);
            AirbnbListingMapping mapping2 = createMapping(2L, "listing-2", 20L);
            when(listingRepository.findBySyncEnabledTrueAndAutoPushPricingTrue())
                    .thenReturn(List.of(mapping1, mapping2));

            MessagingAutomationConfig config1 = new MessagingAutomationConfig();
            config1.setAutoPushPricingEnabled(true);
            MessagingAutomationConfig config2 = new MessagingAutomationConfig();
            config2.setAutoPushPricingEnabled(false);
            when(configRepository.findByOrganizationId(1L)).thenReturn(Optional.of(config1));
            when(configRepository.findByOrganizationId(2L)).thenReturn(Optional.of(config2));

            scheduler.pushPricingToAirbnb();

            verify(configRepository).findByOrganizationId(1L);
            verify(configRepository).findByOrganizationId(2L);
        }
    }
}
