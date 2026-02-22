package com.clenzy.integration.channel;

import com.clenzy.integration.channel.model.ChannelMapping;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Tests for {@link ChannelConnectorRegistry}.
 * Validates connector registration, lookup, capability filtering.
 */
class ChannelConnectorRegistryTest {

    private ChannelConnectorRegistry registry;

    private final ChannelConnector airbnbConnector = new TestConnector(ChannelName.AIRBNB,
            Set.of(ChannelCapability.INBOUND_CALENDAR, ChannelCapability.OUTBOUND_CALENDAR, ChannelCapability.WEBHOOKS));
    private final ChannelConnector icalConnector = new TestConnector(ChannelName.ICAL,
            Set.of(ChannelCapability.INBOUND_CALENDAR, ChannelCapability.POLLING));

    @BeforeEach
    void setUp() {
        registry = new ChannelConnectorRegistry(List.of(airbnbConnector, icalConnector));
    }

    @Nested
    @DisplayName("getConnector")
    class GetConnector {

        @Test
        void whenConnectorExists_thenReturnsPresent() {
            Optional<ChannelConnector> result = registry.getConnector(ChannelName.AIRBNB);
            assertThat(result).isPresent();
            assertThat(result.get().getChannelName()).isEqualTo(ChannelName.AIRBNB);
        }

        @Test
        void whenConnectorNotRegistered_thenReturnsEmpty() {
            Optional<ChannelConnector> result = registry.getConnector(ChannelName.BOOKING);
            assertThat(result).isEmpty();
        }
    }

    @Nested
    @DisplayName("getRequiredConnector")
    class GetRequiredConnector {

        @Test
        void whenConnectorExists_thenReturns() {
            ChannelConnector result = registry.getRequiredConnector(ChannelName.ICAL);
            assertThat(result.getChannelName()).isEqualTo(ChannelName.ICAL);
        }

        @Test
        void whenConnectorNotRegistered_thenThrows() {
            assertThatThrownBy(() -> registry.getRequiredConnector(ChannelName.VRBO))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("VRBO");
        }
    }

    @Nested
    @DisplayName("getAllConnectors")
    class GetAllConnectors {

        @Test
        void whenCalled_thenReturnsAllRegistered() {
            assertThat(registry.getAllConnectors()).hasSize(2);
        }
    }

    @Nested
    @DisplayName("getAvailableChannels")
    class GetAvailableChannels {

        @Test
        void whenCalled_thenReturnsChannelNames() {
            assertThat(registry.getAvailableChannels())
                    .containsExactlyInAnyOrder(ChannelName.AIRBNB, ChannelName.ICAL);
        }
    }

    @Nested
    @DisplayName("getConnectorsWithCapability")
    class GetConnectorsWithCapability {

        @Test
        void whenCapabilityShared_thenReturnsBoth() {
            List<ChannelConnector> result = registry.getConnectorsWithCapability(ChannelCapability.INBOUND_CALENDAR);
            assertThat(result).hasSize(2);
        }

        @Test
        void whenCapabilityExclusiveToOne_thenReturnsOnlyThat() {
            List<ChannelConnector> result = registry.getConnectorsWithCapability(ChannelCapability.WEBHOOKS);
            assertThat(result).hasSize(1);
            assertThat(result.get(0).getChannelName()).isEqualTo(ChannelName.AIRBNB);
        }

        @Test
        void whenCapabilityNotSupported_thenReturnsEmpty() {
            List<ChannelConnector> result = registry.getConnectorsWithCapability(ChannelCapability.MESSAGING);
            assertThat(result).isEmpty();
        }
    }

    @Nested
    @DisplayName("Empty registry")
    class EmptyRegistry {

        @Test
        void whenNoConnectors_thenRegistryWorksEmpty() {
            ChannelConnectorRegistry emptyRegistry = new ChannelConnectorRegistry(List.of());
            assertThat(emptyRegistry.getAllConnectors()).isEmpty();
            assertThat(emptyRegistry.getAvailableChannels()).isEmpty();
        }
    }

    /**
     * Minimal ChannelConnector implementation for testing.
     */
    private static class TestConnector implements ChannelConnector {
        private final ChannelName name;
        private final Set<ChannelCapability> capabilities;

        TestConnector(ChannelName name, Set<ChannelCapability> capabilities) {
            this.name = name;
            this.capabilities = capabilities;
        }

        @Override
        public ChannelName getChannelName() { return name; }

        @Override
        public Set<ChannelCapability> getCapabilities() { return capabilities; }

        @Override
        public Optional<ChannelMapping> resolveMapping(Long propertyId, Long orgId) { return Optional.empty(); }

        @Override
        public void handleInboundEvent(String eventType, Map<String, Object> data, Long orgId) {}
    }
}
