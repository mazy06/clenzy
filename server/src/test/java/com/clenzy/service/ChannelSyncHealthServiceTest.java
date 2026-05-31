package com.clenzy.service;

import com.clenzy.dto.ChannelSyncHealthDto;
import com.clenzy.integration.airbnb.model.AirbnbListingMapping;
import com.clenzy.integration.airbnb.repository.AirbnbListingMappingRepository;
import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChannelSyncHealthServiceTest {

    @Mock private AirbnbListingMappingRepository airbnbRepo;
    @Mock private ChannelMappingRepository channelMappingRepo;

    private TenantContext tenantContext;
    private ChannelSyncHealthService service;

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(42L);
        service = new ChannelSyncHealthService(airbnbRepo, channelMappingRepo, tenantContext);
    }

    private static AirbnbListingMapping airbnbMapping(Long propertyId, boolean syncEnabled, LocalDateTime lastSync) {
        AirbnbListingMapping m = new AirbnbListingMapping();
        m.setPropertyId(propertyId);
        m.setSyncEnabled(syncEnabled);
        m.setLastSyncAt(lastSync);
        return m;
    }

    private static ChannelMapping channelMapping(Long internalId, LocalDateTime lastSync) {
        ChannelMapping m = new ChannelMapping();
        m.setInternalId(internalId);
        m.setLastSyncAt(lastSync);
        return m;
    }

    @Test
    void getHealthByPropertyIds_emptyList_returnsEmpty() {
        assertThat(service.getHealthByPropertyIds(List.of())).isEmpty();
        assertThat(service.getHealthByPropertyIds(null)).isEmpty();
    }

    @Test
    void getHealthByPropertyIds_airbnbRecentSync_countedAsSynced() {
        List<Long> ids = List.of(1L);
        LocalDateTime recent = LocalDateTime.now().minusHours(1);
        when(airbnbRepo.findByPropertyIdIn(ids))
                .thenReturn(List.of(airbnbMapping(1L, true, recent)));
        when(channelMappingRepo.findActiveByPropertyIds(ids, 42L))
                .thenReturn(List.of());

        Map<Long, ChannelSyncHealthDto> result = service.getHealthByPropertyIds(ids);

        assertThat(result.get(1L).synced()).isEqualTo(1);
        assertThat(result.get(1L).total()).isEqualTo(1);
    }

    @Test
    void getHealthByPropertyIds_airbnbOldSync_totalButNotSynced() {
        List<Long> ids = List.of(1L);
        LocalDateTime old = LocalDateTime.now().minusDays(2);
        when(airbnbRepo.findByPropertyIdIn(ids))
                .thenReturn(List.of(airbnbMapping(1L, true, old)));
        when(channelMappingRepo.findActiveByPropertyIds(any(), anyLong()))
                .thenReturn(List.of());

        Map<Long, ChannelSyncHealthDto> result = service.getHealthByPropertyIds(ids);

        assertThat(result.get(1L).synced()).isZero();
        assertThat(result.get(1L).total()).isEqualTo(1);
    }

    @Test
    void getHealthByPropertyIds_airbnbDisabled_notCounted() {
        List<Long> ids = List.of(1L);
        when(airbnbRepo.findByPropertyIdIn(ids))
                .thenReturn(List.of(airbnbMapping(1L, false, LocalDateTime.now())));
        when(channelMappingRepo.findActiveByPropertyIds(any(), anyLong()))
                .thenReturn(List.of());

        Map<Long, ChannelSyncHealthDto> result = service.getHealthByPropertyIds(ids);

        assertThat(result.get(1L).synced()).isZero();
        assertThat(result.get(1L).total()).isZero();
    }

    @Test
    void getHealthByPropertyIds_airbnbNullLastSync_notSynced() {
        List<Long> ids = List.of(1L);
        when(airbnbRepo.findByPropertyIdIn(ids))
                .thenReturn(List.of(airbnbMapping(1L, true, null)));
        when(channelMappingRepo.findActiveByPropertyIds(any(), anyLong()))
                .thenReturn(List.of());

        Map<Long, ChannelSyncHealthDto> result = service.getHealthByPropertyIds(ids);

        assertThat(result.get(1L).synced()).isZero();
        assertThat(result.get(1L).total()).isEqualTo(1);
    }

    @Test
    void getHealthByPropertyIds_channelMappingFresh_synced() {
        List<Long> ids = List.of(1L);
        when(airbnbRepo.findByPropertyIdIn(ids)).thenReturn(List.of());
        when(channelMappingRepo.findActiveByPropertyIds(ids, 42L))
                .thenReturn(List.of(channelMapping(1L, LocalDateTime.now().minusHours(1))));

        Map<Long, ChannelSyncHealthDto> result = service.getHealthByPropertyIds(ids);

        assertThat(result.get(1L).synced()).isEqualTo(1);
        assertThat(result.get(1L).total()).isEqualTo(1);
    }

    @Test
    void getHealthByPropertyIds_unknownProperty_ignored() {
        List<Long> ids = List.of(1L);
        when(airbnbRepo.findByPropertyIdIn(ids))
                .thenReturn(List.of(airbnbMapping(99L, true, LocalDateTime.now())));
        when(channelMappingRepo.findActiveByPropertyIds(ids, 42L))
                .thenReturn(List.of(channelMapping(77L, LocalDateTime.now())));

        Map<Long, ChannelSyncHealthDto> result = service.getHealthByPropertyIds(ids);

        assertThat(result.get(1L).total()).isZero();
        assertThat(result.get(1L).synced()).isZero();
    }

    @Test
    void getHealthByPropertyIds_mixedChannelsMultipleProperties() {
        List<Long> ids = List.of(1L, 2L);
        LocalDateTime recent = LocalDateTime.now().minusHours(2);
        LocalDateTime old = LocalDateTime.now().minusDays(2);
        when(airbnbRepo.findByPropertyIdIn(ids)).thenReturn(List.of(
                airbnbMapping(1L, true, recent),
                airbnbMapping(2L, true, old)
        ));
        when(channelMappingRepo.findActiveByPropertyIds(ids, 42L)).thenReturn(List.of(
                channelMapping(1L, recent),
                channelMapping(2L, null)
        ));

        Map<Long, ChannelSyncHealthDto> result = service.getHealthByPropertyIds(ids);

        assertThat(result.get(1L).synced()).isEqualTo(2);
        assertThat(result.get(1L).total()).isEqualTo(2);
        assertThat(result.get(2L).synced()).isZero();
        assertThat(result.get(2L).total()).isEqualTo(2);
    }
}
