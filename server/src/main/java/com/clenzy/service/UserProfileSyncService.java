package com.clenzy.service;

import com.clenzy.integration.channel.ChannelCapability;
import com.clenzy.integration.channel.ChannelConnector;
import com.clenzy.integration.channel.ChannelConnectorRegistry;
import com.clenzy.integration.channel.HostProfileUpdate;
import com.clenzy.integration.channel.SyncResult;
import com.clenzy.model.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/**
 * Fan-out of a PMS user-profile change to every OTA channel that declares
 * {@link ChannelCapability#OUTBOUND_HOST_PROFILE}.
 *
 * <p>Each connector receives an immutable {@link HostProfileUpdate} snapshot and decides
 * what to do with it (Airbnb has a real implementation; iCal / direct-booking / generic
 * channels return UNSUPPORTED).</p>
 *
 * <h2>Why a dedicated service</h2>
 * <ul>
 *   <li>SRP — {@link UserService} stays focused on the user lifecycle; channel concerns live here.</li>
 *   <li>OCP — adding a new channel adapter requires no change in this class; the registry picks it up.</li>
 *   <li>Async — the call is fire-and-forget so an Airbnb timeout never blocks the PMS save.</li>
 * </ul>
 *
 * <h2>Reliability</h2>
 * The complementary {@code USER_PROFILE_UPDATED} outbox event written by
 * {@link UserService} guarantees at-least-once delivery: if this async fan-out fails or the
 * process restarts mid-flight, the Kafka consumer (when wired) replays the event.
 */
@Service
public class UserProfileSyncService {

    private static final Logger log = LoggerFactory.getLogger(UserProfileSyncService.class);

    private final ChannelConnectorRegistry connectorRegistry;

    public UserProfileSyncService(ChannelConnectorRegistry connectorRegistry) {
        this.connectorRegistry = connectorRegistry;
    }

    /** Build a snapshot from a user entity. */
    public static HostProfileUpdate snapshot(User user, String publicProfilePictureUrl) {
        if (user == null) return null;
        return new HostProfileUpdate(
                user.getId(),
                user.getFirstName(),
                user.getLastName(),
                user.getEmail(),
                user.getPhoneNumber(),
                publicProfilePictureUrl
        );
    }

    /**
     * Dispatch the profile update to every connector that supports host-profile push.
     *
     * <p>Returns immediately; failures from individual channels are logged and don't
     * propagate. Use the outbox-driven Kafka path for guaranteed retry.</p>
     */
    @Async
    public void dispatchAsync(HostProfileUpdate update, Long orgId) {
        if (update == null) return;
        for (ChannelConnector connector : connectorRegistry.getAllConnectors()) {
            if (!connector.supports(ChannelCapability.OUTBOUND_HOST_PROFILE)) continue;
            try {
                SyncResult result = connector.pushHostProfile(update, orgId);
                if (result == null || !result.isSuccess()) {
                    log.warn("Host profile sync to {} did not succeed: {}",
                            connector.getChannelName(),
                            result == null ? "null" : result.getMessage());
                }
            } catch (Exception e) {
                log.warn("Host profile sync to {} threw: {}",
                        connector.getChannelName(), e.getMessage());
            }
        }
    }
}
