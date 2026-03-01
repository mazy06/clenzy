package com.clenzy.service;

import com.clenzy.integration.channel.ChannelName;
import com.clenzy.integration.channel.model.ChannelConnection;
import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import com.clenzy.repository.YieldRuleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class YieldManagementSchedulerTest {

    @Mock private AdvancedRateManager advancedRateManager;
    @Mock private YieldRuleRepository yieldRuleRepository;
    @Mock private ChannelMappingRepository channelMappingRepository;

    private YieldManagementScheduler scheduler;

    private static final Long PROPERTY_ID = 42L;
    private static final Long ORG_ID = 1L;

    @BeforeEach
    void setUp() {
        scheduler = new YieldManagementScheduler(
                advancedRateManager,
                yieldRuleRepository,
                channelMappingRepository
        );
    }

    // =========================================================================
    // evaluateForProperty
    // =========================================================================

    @Nested
    @DisplayName("evaluateForProperty")
    class EvaluateForPropertyTests {

        @Test
        @DisplayName("delegates to advancedRateManager.applyYieldRules")
        void evaluateForProperty_callsApplyYieldRules() {
            // Arrange: no exception from applyYieldRules
            doNothing().when(advancedRateManager).applyYieldRules(PROPERTY_ID, ORG_ID);

            // Act
            scheduler.evaluateForProperty(PROPERTY_ID, ORG_ID);

            // Assert
            verify(advancedRateManager).applyYieldRules(PROPERTY_ID, ORG_ID);
        }

        @Test
        @DisplayName("propagates exception from applyYieldRules")
        void evaluateForProperty_logsError_onFailure() {
            // Arrange: applyYieldRules throws
            doThrow(new RuntimeException("DB connection lost"))
                    .when(advancedRateManager).applyYieldRules(PROPERTY_ID, ORG_ID);

            // Act & Assert: evaluateForProperty does NOT catch exceptions itself,
            // so the exception propagates to the caller
            assertThatCode(() -> scheduler.evaluateForProperty(PROPERTY_ID, ORG_ID))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("DB connection lost");

            verify(advancedRateManager).applyYieldRules(PROPERTY_ID, ORG_ID);
        }
    }

    // =========================================================================
    // evaluateYieldRules (scheduled)
    // =========================================================================

    @Nested
    @DisplayName("evaluateYieldRules (scheduled)")
    class EvaluateYieldRulesScheduledTests {

        @Test
        @DisplayName("processes all active mappings and delegates to applyYieldRules")
        void evaluateYieldRules_processesActiveMappings() {
            // Arrange
            ChannelConnection conn = new ChannelConnection(ORG_ID, ChannelName.AIRBNB);
            ChannelMapping mapping = new ChannelMapping(conn, PROPERTY_ID, "ext-123", ORG_ID);

            when(channelMappingRepository.findAllActiveCrossOrg())
                    .thenReturn(List.of(mapping));

            // Act
            scheduler.evaluateYieldRules();

            // Assert
            verify(advancedRateManager).applyYieldRules(PROPERTY_ID, ORG_ID);
        }

        @Test
        @DisplayName("deduplicates property/org pairs")
        void evaluateYieldRules_deduplicatesProperties() {
            // Arrange: same property+org mapped twice (two channels)
            ChannelConnection airbnbConn = new ChannelConnection(ORG_ID, ChannelName.AIRBNB);
            ChannelConnection bookingConn = new ChannelConnection(ORG_ID, ChannelName.BOOKING);
            ChannelMapping airbnbMapping = new ChannelMapping(airbnbConn, PROPERTY_ID, "ext-airbnb", ORG_ID);
            ChannelMapping bookingMapping = new ChannelMapping(bookingConn, PROPERTY_ID, "ext-booking", ORG_ID);

            when(channelMappingRepository.findAllActiveCrossOrg())
                    .thenReturn(List.of(airbnbMapping, bookingMapping));

            // Act
            scheduler.evaluateYieldRules();

            // Assert: only called once despite two mappings for the same property
            verify(advancedRateManager, times(1)).applyYieldRules(PROPERTY_ID, ORG_ID);
        }

        @Test
        @DisplayName("catches per-property errors and continues processing")
        void evaluateYieldRules_catchesPerPropertyError() {
            // Arrange: two properties, first one throws
            Long propId2 = 99L;
            Long orgId2 = 2L;
            ChannelConnection conn1 = new ChannelConnection(ORG_ID, ChannelName.AIRBNB);
            ChannelConnection conn2 = new ChannelConnection(orgId2, ChannelName.BOOKING);
            ChannelMapping mapping1 = new ChannelMapping(conn1, PROPERTY_ID, "ext-1", ORG_ID);
            ChannelMapping mapping2 = new ChannelMapping(conn2, propId2, "ext-2", orgId2);

            when(channelMappingRepository.findAllActiveCrossOrg())
                    .thenReturn(List.of(mapping1, mapping2));

            doThrow(new RuntimeException("fail")).when(advancedRateManager)
                    .applyYieldRules(PROPERTY_ID, ORG_ID);

            // Act: should not throw
            assertThatCode(() -> scheduler.evaluateYieldRules()).doesNotThrowAnyException();

            // Assert: second property still processed
            verify(advancedRateManager).applyYieldRules(PROPERTY_ID, ORG_ID);
            verify(advancedRateManager).applyYieldRules(propId2, orgId2);
        }
    }
}
