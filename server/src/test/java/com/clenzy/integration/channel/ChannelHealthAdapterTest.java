package com.clenzy.integration.channel;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.InjectMocks;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * T-ARCH-06 : l'adaptateur infrastructure du port ChannelHealthPort reproduit
 * le comportement historique de SyncAdminService (UNKNOWN sans connecteur,
 * nom du statut sinon, exceptions propagees).
 */
@ExtendWith(MockitoExtension.class)
class ChannelHealthAdapterTest {

    @Mock
    private ChannelConnectorRegistry connectorRegistry;

    @InjectMocks
    private ChannelHealthAdapter adapter;

    @Test
    void whenNoConnectorRegistered_thenReturnsUnknown() {
        // Arrange
        when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.empty());

        // Act
        String status = adapter.checkHealth("AIRBNB", 1L);

        // Assert
        assertThat(status).isEqualTo("UNKNOWN");
    }

    @Test
    void whenConnectorPresent_thenReturnsHealthStatusName() {
        // Arrange
        ChannelConnector connector = mock(ChannelConnector.class);
        when(connector.checkHealth(1L)).thenReturn(HealthStatus.HEALTHY);
        when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.of(connector));

        // Act
        String status = adapter.checkHealth("AIRBNB", 1L);

        // Assert
        assertThat(status).isEqualTo("HEALTHY");
    }

    @Test
    void whenConnectorThrows_thenExceptionPropagates() {
        // Arrange — la tolerance aux pannes est decidee par l'appelant (SyncAdminService)
        ChannelConnector connector = mock(ChannelConnector.class);
        when(connector.checkHealth(1L)).thenThrow(new IllegalStateException("boom"));
        when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.of(connector));

        // Act & Assert
        assertThatThrownBy(() -> adapter.checkHealth("AIRBNB", 1L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("boom");
    }
}
