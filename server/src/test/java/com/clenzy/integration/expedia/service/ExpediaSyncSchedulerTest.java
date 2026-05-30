package com.clenzy.integration.expedia.service;

import com.clenzy.integration.channel.ChannelName;
import com.clenzy.integration.channel.model.ChannelConnection;
import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.repository.ChannelConnectionRepository;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import com.clenzy.integration.expedia.config.ExpediaConfig;
import com.clenzy.integration.expedia.dto.ExpediaReservationDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Tests for {@link ExpediaSyncScheduler}.
 * Validates feature flag gating, channel filtering (VRBO only),
 * per-org error isolation, and availability sync.
 */
@ExtendWith(MockitoExtension.class)
class ExpediaSyncSchedulerTest {

    @Mock private ExpediaConfig config;
    @Mock private ExpediaApiClient apiClient;
    @Mock private ChannelConnectionRepository channelConnectionRepository;
    @Mock private ChannelMappingRepository channelMappingRepository;

    private ExpediaSyncScheduler scheduler;

    @BeforeEach
    void setUp() {
        scheduler = new ExpediaSyncScheduler(
                config, apiClient, channelConnectionRepository, channelMappingRepository);
    }

    private ChannelConnection createConnection(Long id, Long orgId, ChannelName channel) {
        ChannelConnection connection = new ChannelConnection();
        connection.setId(id);
        connection.setOrganizationId(orgId);
        connection.setChannel(channel);
        connection.setStatus(ChannelConnection.ConnectionStatus.ACTIVE);
        return connection;
    }

    private ChannelMapping createMapping(String externalId, Long orgId, boolean syncEnabled) {
        ChannelMapping mapping = new ChannelMapping();
        mapping.setExternalId(externalId);
        mapping.setOrganizationId(orgId);
        mapping.setSyncEnabled(syncEnabled);
        return mapping;
    }

    private ExpediaReservationDto createReservation(String reservationId, String propertyId) {
        return new ExpediaReservationDto(
                reservationId, propertyId, "room-1",
                "Jane", "Doe", "jane@example.com",
                LocalDate.now().plusDays(3), LocalDate.now().plusDays(5),
                "CONFIRMED", BigDecimal.valueOf(200), "EUR",
                2, 0, null, "VRBO");
    }

    @Nested
    @DisplayName("syncReservations")
    class SyncReservations {

        @Test
        void whenNotConfigured_thenSkipsEntirely() {
            when(config.isConfigured()).thenReturn(false);

            scheduler.syncReservations();

            verifyNoInteractions(channelConnectionRepository, channelMappingRepository, apiClient);
        }

        @Test
        void whenConfiguredButNoConnections_thenDoesNothing() {
            when(config.isConfigured()).thenReturn(true);
            when(channelConnectionRepository.findAllActive()).thenReturn(List.of());

            scheduler.syncReservations();

            verify(channelMappingRepository, never()).findByConnectionId(anyLong(), anyLong());
            verify(apiClient, never()).getReservations(anyString(), any(), any());
        }

        @Test
        void whenNonVrboConnectionsExist_thenIgnoresThem() {
            when(config.isConfigured()).thenReturn(true);
            when(channelConnectionRepository.findAllActive())
                    .thenReturn(List.of(createConnection(1L, 10L, ChannelName.AIRBNB)));

            scheduler.syncReservations();

            verify(channelMappingRepository, never()).findByConnectionId(anyLong(), anyLong());
        }

        @Test
        void whenVrboConnection_thenSyncsEachEnabledMapping() {
            when(config.isConfigured()).thenReturn(true);
            ChannelConnection vrbo = createConnection(1L, 10L, ChannelName.VRBO);
            when(channelConnectionRepository.findAllActive()).thenReturn(List.of(vrbo));

            ChannelMapping enabled = createMapping("ext-1", 10L, true);
            ChannelMapping disabled = createMapping("ext-2", 10L, false);
            when(channelMappingRepository.findByConnectionId(1L, 10L))
                    .thenReturn(List.of(enabled, disabled));
            when(apiClient.getReservations(eq("ext-1"), any(), any()))
                    .thenReturn(List.of(createReservation("R1", "ext-1")));

            scheduler.syncReservations();

            verify(apiClient).getReservations(eq("ext-1"), any(), any());
            verify(apiClient, never()).getReservations(eq("ext-2"), any(), any());
            assertThat(enabled.getLastSyncStatus()).isEqualTo("SUCCESS");
            assertThat(enabled.getLastSyncAt()).isNotNull();
        }

        @Test
        void whenMappingApiCallFails_thenMarksMappingErrorAndContinues() {
            when(config.isConfigured()).thenReturn(true);
            ChannelConnection vrbo = createConnection(1L, 10L, ChannelName.VRBO);
            when(channelConnectionRepository.findAllActive()).thenReturn(List.of(vrbo));

            ChannelMapping fails = createMapping("ext-1", 10L, true);
            ChannelMapping ok = createMapping("ext-2", 10L, true);
            when(channelMappingRepository.findByConnectionId(1L, 10L))
                    .thenReturn(List.of(fails, ok));
            when(apiClient.getReservations(eq("ext-1"), any(), any()))
                    .thenThrow(new RuntimeException("network"));
            when(apiClient.getReservations(eq("ext-2"), any(), any()))
                    .thenReturn(List.of());

            scheduler.syncReservations();

            assertThat(fails.getLastSyncStatus()).isEqualTo("ERROR");
            assertThat(ok.getLastSyncStatus()).isEqualTo("SUCCESS");
        }

        @Test
        void whenMultipleOrgs_thenProcessesAllIndependently() {
            when(config.isConfigured()).thenReturn(true);
            ChannelConnection org10 = createConnection(1L, 10L, ChannelName.VRBO);
            ChannelConnection org20 = createConnection(2L, 20L, ChannelName.VRBO);
            when(channelConnectionRepository.findAllActive()).thenReturn(List.of(org10, org20));
            when(channelMappingRepository.findByConnectionId(anyLong(), anyLong()))
                    .thenReturn(List.of());

            scheduler.syncReservations();

            verify(channelMappingRepository).findByConnectionId(1L, 10L);
            verify(channelMappingRepository).findByConnectionId(2L, 20L);
        }
    }

    @Nested
    @DisplayName("syncAvailability")
    class SyncAvailability {

        @Test
        void whenNotConfigured_thenSkips() {
            when(config.isConfigured()).thenReturn(false);

            scheduler.syncAvailability();

            verifyNoInteractions(channelConnectionRepository, channelMappingRepository, apiClient);
        }

        @Test
        void whenNoVrboConnections_thenDoesNothing() {
            when(config.isConfigured()).thenReturn(true);
            when(channelConnectionRepository.findAllActive())
                    .thenReturn(List.of(createConnection(1L, 10L, ChannelName.AIRBNB)));

            scheduler.syncAvailability();

            verify(channelMappingRepository, never()).findByConnectionId(anyLong(), anyLong());
        }

        @Test
        void whenVrboConnection_thenPollsAvailabilityForEnabledMappings() {
            when(config.isConfigured()).thenReturn(true);
            ChannelConnection vrbo = createConnection(1L, 10L, ChannelName.VRBO);
            when(channelConnectionRepository.findAllActive()).thenReturn(List.of(vrbo));

            ChannelMapping enabled = createMapping("ext-1", 10L, true);
            ChannelMapping disabled = createMapping("ext-2", 10L, false);
            when(channelMappingRepository.findByConnectionId(1L, 10L))
                    .thenReturn(List.of(enabled, disabled));

            scheduler.syncAvailability();

            verify(apiClient).getAvailability(eq("ext-1"), any(), any());
            verify(apiClient, never()).getAvailability(eq("ext-2"), any(), any());
            assertThat(enabled.getLastSyncStatus()).isEqualTo("SUCCESS");
        }

        @Test
        void whenAvailabilityCallThrows_thenLogsAndContinues() {
            when(config.isConfigured()).thenReturn(true);
            ChannelConnection vrbo1 = createConnection(1L, 10L, ChannelName.VRBO);
            ChannelConnection vrbo2 = createConnection(2L, 20L, ChannelName.VRBO);
            when(channelConnectionRepository.findAllActive()).thenReturn(List.of(vrbo1, vrbo2));

            when(channelMappingRepository.findByConnectionId(1L, 10L))
                    .thenThrow(new RuntimeException("DB down"));
            when(channelMappingRepository.findByConnectionId(2L, 20L))
                    .thenReturn(List.of());

            scheduler.syncAvailability();

            verify(channelMappingRepository).findByConnectionId(1L, 10L);
            verify(channelMappingRepository).findByConnectionId(2L, 20L);
        }

        @Test
        void whenMultipleMappings_thenSetsLastSyncOnAllEnabled() {
            when(config.isConfigured()).thenReturn(true);
            ChannelConnection vrbo = createConnection(1L, 10L, ChannelName.VRBO);
            when(channelConnectionRepository.findAllActive()).thenReturn(List.of(vrbo));

            ChannelMapping m1 = createMapping("ext-1", 10L, true);
            ChannelMapping m2 = createMapping("ext-2", 10L, true);
            when(channelMappingRepository.findByConnectionId(1L, 10L))
                    .thenReturn(List.of(m1, m2));

            scheduler.syncAvailability();

            verify(apiClient, times(2)).getAvailability(anyString(), any(), any());
            assertThat(m1.getLastSyncAt()).isNotNull();
            assertThat(m2.getLastSyncAt()).isNotNull();
        }
    }
}
