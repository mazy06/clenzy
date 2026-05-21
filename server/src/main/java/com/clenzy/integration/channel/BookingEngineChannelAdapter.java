package com.clenzy.integration.channel;

import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.EnumSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Channel adapter for the white-label Booking Engine widgets that conciergeries and
 * propriétaires embed on their own websites.
 *
 * <h2>Why a dedicated adapter</h2>
 * The Booking Engine isn't an external OTA — it's a Clenzy-owned surface. But we still
 * treat it as a first-class channel so:
 * <ul>
 *   <li>Profile sync goes through the same mutualised plumbing as Airbnb / Booking / …</li>
 *   <li>The Sync & Diagnostics UI logs every booking-engine cache flush + broadcast.</li>
 *   <li>Adding the booking engine to an organisation later won't require new code paths.</li>
 * </ul>
 *
 * <h2>What pushHostProfile does</h2>
 * Unlike external OTAs (which need partner API contracts), here we own the entire stack:
 * <ol>
 *   <li>Evicts the {@code booking-engine-properties} Redis cache so the next widget request
 *   re-renders with the new host name / photo.</li>
 *   <li>Broadcasts a STOMP message on {@code /topic/booking-engine/host/{userId}} so any
 *   widget instance currently open on a guest's screen can react in real time (subscription
 *   on the widget side is optional — the cache eviction guarantees correctness on next nav).</li>
 * </ol>
 *
 * <h2>SOLID</h2>
 * <ul>
 *   <li>SRP — owns booking-engine-specific reactions to a host change. No knowledge of any OTA.</li>
 *   <li>OCP — when we add per-host or per-property cache keys, only the eviction logic changes.</li>
 *   <li>DIP — depends on Spring's {@code CacheManager} + an optional {@code SimpMessagingTemplate};
 *   the rest of the codebase doesn't know booking-engine-specific keys exist.</li>
 * </ul>
 */
@Component
public class BookingEngineChannelAdapter implements ChannelConnector {

    private static final Logger log = LoggerFactory.getLogger(BookingEngineChannelAdapter.class);

    /** Spring cache name that {@code PublicBookingService.getPropertyDetail} writes to. */
    public static final String PROPERTY_CACHE = "booking-engine-properties";

    private final ChannelMappingRepository channelMappingRepository;
    private final CacheManager cacheManager;
    private final SimpMessagingTemplate messagingTemplate;

    public BookingEngineChannelAdapter(
            ChannelMappingRepository channelMappingRepository,
            CacheManager cacheManager,
            ObjectProvider<SimpMessagingTemplate> messagingTemplateProvider) {
        this.channelMappingRepository = channelMappingRepository;
        this.cacheManager = cacheManager;
        this.messagingTemplate = messagingTemplateProvider.getIfAvailable();
    }

    @Override
    public ChannelName getChannelName() {
        return ChannelName.BOOKING_ENGINE;
    }

    @Override
    public Set<ChannelCapability> getCapabilities() {
        return EnumSet.of(
                ChannelCapability.OUTBOUND_HOST_PROFILE,
                ChannelCapability.CONTENT_SYNC
        );
    }

    @Override
    public Optional<ChannelMapping> resolveMapping(Long propertyId, Long orgId) {
        // The booking engine isn't a per-property mapping today — every visible property is
        // surfaced. Returning empty keeps generic mapping lookups well-typed.
        return channelMappingRepository.findByPropertyIdAndChannel(
                propertyId, ChannelName.BOOKING_ENGINE, orgId);
    }

    @Override
    public void handleInboundEvent(String eventType, Map<String, Object> data, Long orgId) {
        // Inbound traffic from the widget hits the public REST API directly; no event
        // handling needed here.
    }

    /**
     * Push a host-profile change to the booking-engine layer.
     *
     * <p>Concrete behaviour (no partner contract required — this surface is ours):</p>
     * <ol>
     *   <li>Invalidate the public property cache so subsequent widget loads serve the
     *   refreshed host info.</li>
     *   <li>Push a STOMP notification on {@code /topic/booking-engine/host/{userId}} so any
     *   live widget can refresh without a page reload.</li>
     * </ol>
     */
    @Override
    public SyncResult pushHostProfile(HostProfileUpdate profile, Long orgId) {
        if (profile == null || profile.userId() == null) {
            return SyncResult.failed("Invalid host profile payload");
        }
        long start = System.currentTimeMillis();

        evictPropertyCache();
        broadcastHostUpdate(profile);

        long durationMs = System.currentTimeMillis() - start;
        log.info("BookingEngineChannelAdapter pushHostProfile userId={} orgId={} took={}ms",
                profile.userId(), orgId, durationMs);
        return SyncResult.success(
                "Booking engine cache evicted + widgets notified",
                1,
                durationMs
        );
    }

    private void evictPropertyCache() {
        Cache cache = cacheManager.getCache(PROPERTY_CACHE);
        if (cache != null) {
            // Booking-engine property cache is small + bounded (10-min TTL). Flushing all
            // entries on host change is correct and trivially cheap; per-property eviction
            // would require an owner→propertyIds map that we don't currently keep hot.
            cache.clear();
            log.debug("Booking engine property cache cleared");
        }
    }

    private void broadcastHostUpdate(HostProfileUpdate profile) {
        if (messagingTemplate == null) return;
        try {
            messagingTemplate.convertAndSend(
                    "/topic/booking-engine/host/" + profile.userId(),
                    Map.of(
                            "userId", profile.userId(),
                            "firstName", profile.firstName() == null ? "" : profile.firstName(),
                            "profilePictureUrl", profile.profilePictureUrl() == null ? "" : profile.profilePictureUrl()
                    )
            );
        } catch (Exception e) {
            log.warn("Booking engine host broadcast failed for user {}: {}",
                    profile.userId(), e.getMessage());
        }
    }
}
