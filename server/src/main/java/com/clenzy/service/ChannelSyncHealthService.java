package com.clenzy.service;

import com.clenzy.dto.ChannelSyncHealthDto;
import com.clenzy.integration.airbnb.model.AirbnbListingMapping;
import com.clenzy.integration.airbnb.repository.AirbnbListingMappingRepository;
import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import com.clenzy.tenant.TenantContext;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Calcule la sante de synchronisation multi-canaux par propriete.
 *
 * Pour chaque propriete on agrege :
 *  - les Airbnb listings actifs (syncEnabled)
 *  - les mappings ChannelMapping actifs (iCal Booking/Vrbo, autres PMS)
 *
 * Un canal est "synced" s'il a un `lastSyncAt` recent (< 24h). Sinon il est
 * compte dans le total mais pas dans synced → l'utilisateur voit "X/Y" et
 * detecte rapidement les canaux desynchronises.
 */
@Service
public class ChannelSyncHealthService {

    /** Seuil au-dela duquel un canal est considere "obsolete". */
    private static final long SYNC_HEALTH_THRESHOLD_HOURS = 24;

    private final AirbnbListingMappingRepository airbnbRepo;
    private final ChannelMappingRepository channelMappingRepo;
    private final TenantContext tenantContext;

    public ChannelSyncHealthService(AirbnbListingMappingRepository airbnbRepo,
                                    ChannelMappingRepository channelMappingRepo,
                                    TenantContext tenantContext) {
        this.airbnbRepo = airbnbRepo;
        this.channelMappingRepo = channelMappingRepo;
        this.tenantContext = tenantContext;
    }

    public Map<Long, ChannelSyncHealthDto> getHealthByPropertyIds(List<Long> propertyIds) {
        if (propertyIds == null || propertyIds.isEmpty()) {
            return Map.of();
        }
        Long orgId = tenantContext.getRequiredOrganizationId();
        LocalDateTime healthyThreshold = LocalDateTime.now().minusHours(SYNC_HEALTH_THRESHOLD_HOURS);

        // [synced, total] par propertyId — LinkedHashMap pour preserver l'ordre input
        Map<Long, int[]> counts = new LinkedHashMap<>();
        for (Long pid : propertyIds) {
            counts.put(pid, new int[]{0, 0});
        }

        // Airbnb mappings (filter @Filter applied par TenantContext via interceptor JPA)
        List<AirbnbListingMapping> airbnbMappings = airbnbRepo.findByPropertyIdIn(propertyIds);
        for (AirbnbListingMapping m : airbnbMappings) {
            if (!m.isSyncEnabled()) continue;
            int[] c = counts.get(m.getPropertyId());
            if (c == null) continue;
            c[1]++;
            if (m.getLastSyncAt() != null && m.getLastSyncAt().isAfter(healthyThreshold)) {
                c[0]++;
            }
        }

        // ChannelMappings (iCal Booking/Vrbo + autres PMS)
        List<ChannelMapping> channelMappings = channelMappingRepo.findActiveByPropertyIds(propertyIds, orgId);
        for (ChannelMapping m : channelMappings) {
            int[] c = counts.get(m.getInternalId());
            if (c == null) continue;
            c[1]++;
            if (m.getLastSyncAt() != null && m.getLastSyncAt().isAfter(healthyThreshold)) {
                c[0]++;
            }
        }

        Map<Long, ChannelSyncHealthDto> result = new HashMap<>();
        counts.forEach((pid, c) -> result.put(pid, new ChannelSyncHealthDto(pid, c[0], c[1])));
        return result;
    }
}
