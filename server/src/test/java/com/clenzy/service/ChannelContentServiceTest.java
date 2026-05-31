package com.clenzy.service;

import com.clenzy.dto.CreateChannelContentMappingRequest;
import com.clenzy.integration.channel.ChannelCapability;
import com.clenzy.integration.channel.ChannelConnector;
import com.clenzy.integration.channel.ChannelConnectorRegistry;
import com.clenzy.integration.channel.ChannelName;
import com.clenzy.integration.channel.SyncResult;
import com.clenzy.model.ChannelContentMapping;
import com.clenzy.repository.ChannelContentMappingRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChannelContentServiceTest {

    @Mock private ChannelContentMappingRepository contentRepository;
    @Mock private ChannelConnectorRegistry connectorRegistry;
    @Mock private ChannelConnector airbnbConnector;
    @Mock private ChannelConnector bookingConnector;

    private ChannelContentService service;

    private static final Long ORG_ID = 7L;
    private static final Long PROPERTY_ID = 42L;

    @BeforeEach
    void setUp() {
        service = new ChannelContentService(contentRepository, connectorRegistry);
    }

    private ChannelContentMapping buildMapping(Long id, ChannelName channelName) {
        ChannelContentMapping c = new ChannelContentMapping();
        c.setId(id);
        c.setOrganizationId(ORG_ID);
        c.setPropertyId(PROPERTY_ID);
        c.setChannelName(channelName);
        c.setTitle("Title-" + id);
        c.setDescription("Desc-" + id);
        c.setBedrooms(2);
        c.setBathrooms(1);
        c.setMaxGuests(4);
        return c;
    }

    private CreateChannelContentMappingRequest buildRequest(ChannelName channelName) {
        return new CreateChannelContentMappingRequest(
                PROPERTY_ID,
                channelName,
                "New Title",
                "New Description",
                List.of("WIFI", "POOL"),
                List.of("http://photo1.jpg"),
                "APARTMENT",
                2,
                1,
                4,
                Map.of("k", "v")
        );
    }

    @Nested
    @DisplayName("getAll / getByProperty / getById")
    class Reads {

        @Test
        void getAll_delegatesToRepository() {
            ChannelContentMapping m1 = buildMapping(1L, ChannelName.AIRBNB);
            ChannelContentMapping m2 = buildMapping(2L, ChannelName.BOOKING);
            when(contentRepository.findAllByOrgId(ORG_ID)).thenReturn(List.of(m1, m2));

            List<ChannelContentMapping> result = service.getAll(ORG_ID);

            assertThat(result).hasSize(2);
        }

        @Test
        void getByProperty_delegatesToRepository() {
            ChannelContentMapping m = buildMapping(1L, ChannelName.AIRBNB);
            when(contentRepository.findByPropertyId(PROPERTY_ID, ORG_ID)).thenReturn(List.of(m));

            List<ChannelContentMapping> result = service.getByProperty(PROPERTY_ID, ORG_ID);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).getId()).isEqualTo(1L);
        }

        @Test
        void getById_whenFound_returnsMapping() {
            ChannelContentMapping m = buildMapping(5L, ChannelName.AIRBNB);
            when(contentRepository.findByIdAndOrgId(5L, ORG_ID)).thenReturn(Optional.of(m));

            ChannelContentMapping result = service.getById(5L, ORG_ID);

            assertThat(result.getId()).isEqualTo(5L);
        }

        @Test
        void getById_whenMissing_throws() {
            when(contentRepository.findByIdAndOrgId(99L, ORG_ID)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.getById(99L, ORG_ID))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("not found");
        }
    }

    @Nested
    @DisplayName("create")
    class Create {

        @Test
        void whenConnectorPushesSuccess_thenStatusSynced() {
            when(contentRepository.save(any(ChannelContentMapping.class))).thenAnswer(inv -> {
                ChannelContentMapping c = inv.getArgument(0);
                if (c.getId() == null) c.setId(1L);
                return c;
            });
            when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.of(airbnbConnector));
            when(airbnbConnector.supports(ChannelCapability.CONTENT_SYNC)).thenReturn(true);
            when(airbnbConnector.pushContent(any(ChannelContentMapping.class), eq(ORG_ID)))
                    .thenReturn(SyncResult.success(1, 100));

            ChannelContentMapping result = service.create(buildRequest(ChannelName.AIRBNB), ORG_ID);

            assertThat(result.getSyncStatus()).isEqualTo("SYNCED");
            assertThat(result.getSyncedAt()).isNotNull();
            assertThat(result.getTitle()).isEqualTo("New Title");
            assertThat(result.getAmenities()).containsExactly("WIFI", "POOL");
        }

        @Test
        void whenNoConnectorForChannel_thenStatusRemainsPending() {
            when(contentRepository.save(any(ChannelContentMapping.class))).thenAnswer(inv -> {
                ChannelContentMapping c = inv.getArgument(0);
                if (c.getId() == null) c.setId(2L);
                return c;
            });
            when(connectorRegistry.getConnector(ChannelName.BOOKING)).thenReturn(Optional.empty());

            ChannelContentMapping result = service.create(buildRequest(ChannelName.BOOKING), ORG_ID);

            assertThat(result.getSyncStatus()).isEqualTo("PENDING");
        }

        @Test
        void whenConnectorDoesNotSupportContentSync_thenNoStatusChange() {
            when(contentRepository.save(any(ChannelContentMapping.class))).thenAnswer(inv -> {
                ChannelContentMapping c = inv.getArgument(0);
                if (c.getId() == null) c.setId(3L);
                return c;
            });
            when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.of(airbnbConnector));
            when(airbnbConnector.supports(ChannelCapability.CONTENT_SYNC)).thenReturn(false);

            ChannelContentMapping result = service.create(buildRequest(ChannelName.AIRBNB), ORG_ID);

            assertThat(result.getSyncStatus()).isEqualTo("PENDING");
            verify(airbnbConnector, never()).pushContent(any(), any());
        }

        @Test
        void whenPushFails_thenStatusFailed() {
            when(contentRepository.save(any(ChannelContentMapping.class))).thenAnswer(inv -> {
                ChannelContentMapping c = inv.getArgument(0);
                if (c.getId() == null) c.setId(4L);
                return c;
            });
            when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.of(airbnbConnector));
            when(airbnbConnector.supports(ChannelCapability.CONTENT_SYNC)).thenReturn(true);
            when(airbnbConnector.pushContent(any(), eq(ORG_ID)))
                    .thenReturn(SyncResult.failed("rejected by API"));

            ChannelContentMapping result = service.create(buildRequest(ChannelName.AIRBNB), ORG_ID);

            assertThat(result.getSyncStatus()).isEqualTo("FAILED");
        }

        @Test
        void whenPushThrows_thenExceptionIsSwallowed() {
            when(contentRepository.save(any(ChannelContentMapping.class))).thenAnswer(inv -> {
                ChannelContentMapping c = inv.getArgument(0);
                if (c.getId() == null) c.setId(5L);
                return c;
            });
            when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.of(airbnbConnector));
            when(airbnbConnector.supports(ChannelCapability.CONTENT_SYNC)).thenReturn(true);
            when(airbnbConnector.pushContent(any(), eq(ORG_ID)))
                    .thenThrow(new RuntimeException("network"));

            ChannelContentMapping result = service.create(buildRequest(ChannelName.AIRBNB), ORG_ID);

            assertThat(result).isNotNull();
            // Initial PENDING status preserved on exception (no save call in catch block)
            assertThat(result.getSyncStatus()).isEqualTo("PENDING");
        }

        @Test
        void whenRequestHasNullAmenitiesAndPhotos_thenDoesNotOverwriteDefaults() {
            when(contentRepository.save(any(ChannelContentMapping.class))).thenAnswer(inv -> {
                ChannelContentMapping c = inv.getArgument(0);
                if (c.getId() == null) c.setId(6L);
                return c;
            });
            when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.empty());

            CreateChannelContentMappingRequest req = new CreateChannelContentMappingRequest(
                    PROPERTY_ID, ChannelName.AIRBNB, "T", "D",
                    null, null, "APT", null, null, null, null);

            ChannelContentMapping result = service.create(req, ORG_ID);

            assertThat(result.getAmenities()).isEmpty();
            assertThat(result.getPhotoUrls()).isEmpty();
        }
    }

    @Nested
    @DisplayName("update")
    class Update {

        @Test
        void whenExists_thenAppliesFields() {
            ChannelContentMapping existing = buildMapping(1L, ChannelName.AIRBNB);
            existing.setSyncStatus("SYNCED");
            when(contentRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(existing));
            when(contentRepository.save(any(ChannelContentMapping.class))).thenAnswer(inv -> inv.getArgument(0));
            when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.empty());

            ChannelContentMapping result = service.update(1L, ORG_ID, buildRequest(ChannelName.AIRBNB));

            assertThat(result.getTitle()).isEqualTo("New Title");
            assertThat(result.getDescription()).isEqualTo("New Description");
            assertThat(result.getAmenities()).containsExactly("WIFI", "POOL");
        }

        @Test
        void whenIdMissing_thenThrows() {
            when(contentRepository.findByIdAndOrgId(99L, ORG_ID)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.update(99L, ORG_ID, buildRequest(ChannelName.AIRBNB)))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Nested
    @DisplayName("delete")
    class Delete {

        @Test
        void whenExists_thenDeletes() {
            ChannelContentMapping existing = buildMapping(1L, ChannelName.AIRBNB);
            when(contentRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(existing));

            service.delete(1L, ORG_ID);

            verify(contentRepository).delete(existing);
        }

        @Test
        void whenMissing_thenThrows() {
            when(contentRepository.findByIdAndOrgId(99L, ORG_ID)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.delete(99L, ORG_ID))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Nested
    @DisplayName("syncWithChannel")
    class SyncWithChannel {

        @Test
        void whenNoConnectors_thenNoop() {
            when(connectorRegistry.getConnectorsWithCapability(ChannelCapability.CONTENT_SYNC))
                    .thenReturn(List.of());

            service.syncWithChannel(PROPERTY_ID, ORG_ID);

            // No exceptions, no repo or connector calls
            verify(contentRepository, never()).save(any());
        }

        @Test
        void whenConnectorPullsSuccess_thenLogsOnly() {
            lenient().when(airbnbConnector.getChannelName()).thenReturn(ChannelName.AIRBNB);
            when(connectorRegistry.getConnectorsWithCapability(ChannelCapability.CONTENT_SYNC))
                    .thenReturn(List.of(airbnbConnector));
            when(airbnbConnector.pullContent(PROPERTY_ID, ORG_ID))
                    .thenReturn(SyncResult.success(3, 50));

            service.syncWithChannel(PROPERTY_ID, ORG_ID);

            verify(airbnbConnector).pullContent(PROPERTY_ID, ORG_ID);
        }

        @Test
        void whenConnectorThrows_thenContinuesToNextConnector() {
            lenient().when(airbnbConnector.getChannelName()).thenReturn(ChannelName.AIRBNB);
            lenient().when(bookingConnector.getChannelName()).thenReturn(ChannelName.BOOKING);
            when(connectorRegistry.getConnectorsWithCapability(ChannelCapability.CONTENT_SYNC))
                    .thenReturn(List.of(airbnbConnector, bookingConnector));
            when(airbnbConnector.pullContent(PROPERTY_ID, ORG_ID))
                    .thenThrow(new RuntimeException("boom"));
            when(bookingConnector.pullContent(PROPERTY_ID, ORG_ID))
                    .thenReturn(SyncResult.success(2, 30));

            service.syncWithChannel(PROPERTY_ID, ORG_ID);

            verify(bookingConnector).pullContent(PROPERTY_ID, ORG_ID);
        }
    }

    @Nested
    @DisplayName("pushContentToChannel - direct")
    class PushContent {

        @Test
        void whenSuccess_thenSetsSyncedFields() {
            ChannelContentMapping mapping = buildMapping(10L, ChannelName.AIRBNB);
            when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.of(airbnbConnector));
            when(airbnbConnector.supports(ChannelCapability.CONTENT_SYNC)).thenReturn(true);
            when(airbnbConnector.pushContent(eq(mapping), eq(ORG_ID)))
                    .thenReturn(SyncResult.success(1, 10));
            when(contentRepository.save(any(ChannelContentMapping.class))).thenAnswer(inv -> inv.getArgument(0));

            service.pushContentToChannel(mapping, ORG_ID);

            assertThat(mapping.getSyncStatus()).isEqualTo("SYNCED");
            assertThat(mapping.getSyncedAt()).isNotNull();
        }

        @Test
        void whenFailed_thenSetsFailedStatus() {
            ChannelContentMapping mapping = buildMapping(11L, ChannelName.AIRBNB);
            when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.of(airbnbConnector));
            when(airbnbConnector.supports(ChannelCapability.CONTENT_SYNC)).thenReturn(true);
            when(airbnbConnector.pushContent(eq(mapping), eq(ORG_ID)))
                    .thenReturn(SyncResult.failed("bad data"));
            when(contentRepository.save(any(ChannelContentMapping.class))).thenAnswer(inv -> inv.getArgument(0));

            service.pushContentToChannel(mapping, ORG_ID);

            assertThat(mapping.getSyncStatus()).isEqualTo("FAILED");
        }

        @Test
        void whenSkipped_thenStatusUnchanged() {
            ChannelContentMapping mapping = buildMapping(12L, ChannelName.AIRBNB);
            mapping.setSyncStatus("PENDING");
            when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.of(airbnbConnector));
            when(airbnbConnector.supports(ChannelCapability.CONTENT_SYNC)).thenReturn(true);
            when(airbnbConnector.pushContent(eq(mapping), eq(ORG_ID)))
                    .thenReturn(SyncResult.skipped("nothing changed"));

            service.pushContentToChannel(mapping, ORG_ID);

            assertThat(mapping.getSyncStatus()).isEqualTo("PENDING");
            verify(contentRepository, never()).save(any());
        }
    }
}
