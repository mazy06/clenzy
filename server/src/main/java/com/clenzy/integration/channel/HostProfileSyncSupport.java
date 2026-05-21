package com.clenzy.integration.channel;

import com.clenzy.integration.channel.model.ChannelConnection;
import com.clenzy.integration.channel.model.ChannelSyncLog;
import com.clenzy.integration.channel.repository.ChannelConnectionRepository;
import com.clenzy.integration.channel.repository.ChannelSyncLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.concurrent.Callable;

/**
 * Shared infrastructure for pushing a host profile to any OTA channel.
 *
 * <h2>Why this exists</h2>
 * Every OTA adapter that surfaces a host profile concept (Airbnb, Booking, Expedia,
 * HomeAway, Agoda, Hotels.com, TripAdvisor, Google Vacation Rentals…) follows the same
 * skeleton:
 *
 * <ol>
 *   <li>Look up the {@link ChannelConnection} for the org.</li>
 *   <li>Skip cleanly when the channel isn't connected.</li>
 *   <li>Call the channel-specific API (or record "pending" until the partner contract lands).</li>
 *   <li>Write a {@link ChannelSyncLog} entry so the Sync & Diagnostics UI shows the attempt.</li>
 *   <li>Measure duration + capture exceptions in a uniform way.</li>
 * </ol>
 *
 * Centralising that skeleton here means each adapter is reduced to a one-liner delegate +
 * an optional callable holding the real REST/SOAP/GraphQL call. Switching a channel from
 * "pending" to "live" is purely local to its adapter — no boilerplate to copy/paste.
 *
 * <h2>SOLID</h2>
 * <ul>
 *   <li>SRP — this class owns the sync orchestration; adapters own the API call shape.</li>
 *   <li>OCP — a new channel adapter plugs in by injecting this service and overriding
 *   {@code pushHostProfile} with a one-line delegate. No edit here.</li>
 *   <li>DIP — adapters depend on this abstraction, not on each other; the registry resolves
 *   them generically.</li>
 * </ul>
 *
 * <h2>Reliability</h2>
 * The {@code USER_PROFILE_UPDATED} outbox event written by {@code UserService} provides
 * at-least-once delivery via Kafka. This service handles the immediate fan-out; the outbox
 * relay handles retries when this dispatch fails or the process dies mid-flight.
 */
@Service
public class HostProfileSyncSupport {

    private static final Logger log = LoggerFactory.getLogger(HostProfileSyncSupport.class);

    /** Event type written to {@link ChannelSyncLog} for host-profile sync attempts. */
    public static final String EVENT_TYPE = "HOST_PROFILE_PUSH";

    /** Status string for the "pending" stub case. Visible in the Sync & Diagnostics UI. */
    public static final String STATUS_PENDING_WIRE_UP = "PENDING_WIRE_UP";

    private final ChannelConnectionRepository connectionRepository;
    private final ChannelSyncLogRepository syncLogRepository;

    public HostProfileSyncSupport(ChannelConnectionRepository connectionRepository,
                                  ChannelSyncLogRepository syncLogRepository) {
        this.connectionRepository = connectionRepository;
        this.syncLogRepository = syncLogRepository;
    }

    /**
     * Dispatch a host-profile push through a channel-specific {@link Callable}.
     *
     * <p>The callable should encapsulate the actual REST call. This method handles:</p>
     * <ul>
     *   <li>Connection resolution (returns {@code SKIPPED} when none).</li>
     *   <li>Duration measurement.</li>
     *   <li>Exception capture (translated to {@code FAILED}).</li>
     *   <li>Persistence of the sync attempt to {@link ChannelSyncLog}.</li>
     * </ul>
     */
    public SyncResult dispatch(ChannelName channel,
                               HostProfileUpdate profile,
                               Long orgId,
                               Callable<SyncResult> apiCall) {
        if (profile == null || profile.userId() == null) {
            return SyncResult.failed("Invalid host profile payload");
        }
        if (orgId == null) {
            return SyncResult.skipped("No organization context for host profile sync");
        }

        Optional<ChannelConnection> connection =
                connectionRepository.findByOrganizationIdAndChannel(orgId, channel);
        if (connection.isEmpty()) {
            log.debug("Skipping host profile push to {} — no connection for org {}", channel, orgId);
            return SyncResult.skipped("No active " + channel + " connection for org " + orgId);
        }

        long start = System.currentTimeMillis();
        SyncResult result;
        try {
            result = apiCall.call();
            if (result == null) {
                result = SyncResult.failed("Channel adapter returned null");
            }
        } catch (Exception e) {
            log.warn("Host profile push to {} threw for user {} (org {}): {}",
                    channel, profile.userId(), orgId, e.getMessage());
            result = SyncResult.failed(e.getMessage(),
                    System.currentTimeMillis() - start);
        }

        recordLog(connection.get(), orgId, profile, result,
                (int) (System.currentTimeMillis() - start));
        return result;
    }

    /**
     * Convenience for adapters that don't have an API contract yet: records the change
     * as {@code PENDING_WIRE_UP} so it shows up in the Sync & Diagnostics UI and we can
     * audit which channels still need partner integration work.
     */
    public SyncResult recordPendingWireUp(ChannelName channel,
                                          HostProfileUpdate profile,
                                          Long orgId) {
        return dispatch(channel, profile, orgId, () -> SyncResult.success(
                "Host profile change recorded for " + channel + " sync (API wire-up pending)",
                1,
                0L
        ));
    }

    // ─── Internal ────────────────────────────────────────────────────────────

    private void recordLog(ChannelConnection connection,
                           Long orgId,
                           HostProfileUpdate profile,
                           SyncResult result,
                           int durationMs) {
        try {
            ChannelSyncLog logEntry = new ChannelSyncLog(
                    orgId,
                    connection,
                    SyncDirection.OUTBOUND,
                    EVENT_TYPE,
                    statusFor(result)
            );
            logEntry.setDurationMs(durationMs);
            logEntry.setDetails(buildDetails(profile, result));
            if (!result.isSuccess()) {
                logEntry.setErrorMessage(result.getMessage());
            }
            syncLogRepository.save(logEntry);
        } catch (Exception e) {
            // Never let logging failures bubble up to the caller — sync remains best-effort.
            log.warn("Failed to record host profile sync log for {} (user {}): {}",
                    connection.getChannel(), profile.userId(), e.getMessage());
        }
    }

    private static String statusFor(SyncResult result) {
        if (result == null) return "FAILED";
        if (!result.isSuccess()) return "FAILED";
        if (result.getMessage() != null && result.getMessage().contains("wire-up pending")) {
            return STATUS_PENDING_WIRE_UP;
        }
        return "SUCCESS";
    }

    private static String buildDetails(HostProfileUpdate profile, SyncResult result) {
        StringBuilder sb = new StringBuilder();
        sb.append("userId=").append(profile.userId());
        if (profile.firstName() != null) sb.append(" firstName=").append(profile.firstName());
        if (profile.lastName() != null) sb.append(" lastName=").append(profile.lastName());
        sb.append(" photo=").append(profile.profilePictureUrl() != null);
        if (result != null && result.getMessage() != null) {
            sb.append(" | ").append(result.getMessage());
        }
        return sb.toString();
    }
}
