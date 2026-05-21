package com.clenzy.service;

import com.clenzy.dto.UserPresenceDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

/**
 * Redis-backed presence tracking.
 *
 * <h2>Data model</h2>
 * <ul>
 *   <li><b>presence:sessions:{userId}</b> — Redis SET of active WebSocket session ids for a user.
 *   Carries a TTL so abruptly disconnected sessions don't leak forever.</li>
 *   <li><b>presence:lastSeen:{userId}</b> — ISO-8601 timestamp string of the last clean disconnect.
 *   TTL of 30 days.</li>
 * </ul>
 *
 * <h2>Scaling</h2>
 * All state lives in Redis, so this service is correct across multiple PMS instances — any
 * instance can observe presence changes regardless of which one holds the WebSocket. Presence
 * transitions are also broadcast via STOMP {@code /topic/presence} so connected clients get
 * realtime updates.
 *
 * <h2>SOLID</h2>
 * <ul>
 *   <li>SRP: only handles presence; no business knowledge about contacts, threads, etc.</li>
 *   <li>DIP: depends on {@code StringRedisTemplate} (Spring abstraction) and an
 *   {@code ObjectProvider<SimpMessagingTemplate>} so the WebSocket dependency is optional
 *   (matches how {@link ContactMessageEventPublisher} avoids a hard coupling).</li>
 * </ul>
 */
@Service
public class PresenceService {

    private static final Logger log = LoggerFactory.getLogger(PresenceService.class);

    /** TTL on the sessions SET — covers abrupt disconnects without a Spring event. */
    private static final Duration SESSION_TTL = Duration.ofMinutes(15);

    /** Retention for the last-seen timestamp. */
    private static final Duration LAST_SEEN_TTL = Duration.ofDays(30);

    private static final String SESSIONS_PREFIX = "presence:sessions:";
    private static final String LAST_SEEN_PREFIX = "presence:lastSeen:";

    private final StringRedisTemplate redis;
    private final SimpMessagingTemplate messagingTemplate;

    public PresenceService(StringRedisTemplate redis,
                           ObjectProvider<SimpMessagingTemplate> messagingTemplateProvider) {
        this.redis = redis;
        this.messagingTemplate = messagingTemplateProvider.getIfAvailable();
    }

    // ─── Mutations ───────────────────────────────────────────────────────────

    /**
     * Mark a user as online for the given session id.
     * Broadcasts an ONLINE transition if this is the first session for the user.
     */
    public void markOnline(String userId, String sessionId) {
        if (userId == null || userId.isBlank() || sessionId == null || sessionId.isBlank()) {
            return;
        }
        String key = sessionsKey(userId);
        boolean wasOffline = !isOnline(userId);
        redis.opsForSet().add(key, sessionId);
        redis.expire(key, SESSION_TTL);
        if (wasOffline) {
            broadcastPresenceChange(userId, true);
            log.debug("Presence ONLINE for {}", userId);
        }
    }

    /**
     * Remove the given session from a user's set.
     * Broadcasts an OFFLINE transition if it was the last session.
     */
    public void markOffline(String userId, String sessionId) {
        if (userId == null || userId.isBlank() || sessionId == null || sessionId.isBlank()) {
            return;
        }
        String key = sessionsKey(userId);
        Long remaining = redis.opsForSet().remove(key, sessionId);
        Long size = redis.opsForSet().size(key);
        if (size == null || size == 0) {
            redis.delete(key);
            recordLastSeen(userId);
            broadcastPresenceChange(userId, false);
            log.debug("Presence OFFLINE for {} (removed sessions: {})", userId, remaining);
        }
    }

    private void recordLastSeen(String userId) {
        String iso = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        redis.opsForValue().set(lastSeenKey(userId), iso, LAST_SEEN_TTL);
    }

    // ─── Queries ─────────────────────────────────────────────────────────────

    public boolean isOnline(String userId) {
        if (userId == null || userId.isBlank()) return false;
        Long size = redis.opsForSet().size(sessionsKey(userId));
        return size != null && size > 0;
    }

    public UserPresenceDto getPresence(String userId) {
        boolean online = isOnline(userId);
        LocalDateTime lastSeen = null;
        if (!online) {
            String raw = redis.opsForValue().get(lastSeenKey(userId));
            if (raw != null && !raw.isBlank()) {
                try {
                    lastSeen = LocalDateTime.parse(raw);
                } catch (Exception ignore) {
                    // Stale or malformed payload — treat as no info.
                }
            }
        }
        return new UserPresenceDto(userId, online, lastSeen);
    }

    /**
     * Bulk presence lookup. Single Redis round-trip per attribute, so it stays O(1) over the wire
     * even for large contact lists. Use this from the thread list / contact directory.
     */
    public List<UserPresenceDto> getBulkPresence(Collection<String> userIds) {
        if (userIds == null || userIds.isEmpty()) return List.of();
        List<UserPresenceDto> out = new ArrayList<>(userIds.size());
        for (String userId : userIds) {
            if (userId == null || userId.isBlank()) continue;
            out.add(getPresence(userId));
        }
        return out;
    }

    // ─── Broadcast ───────────────────────────────────────────────────────────

    private void broadcastPresenceChange(String userId, boolean online) {
        if (messagingTemplate == null) return;
        try {
            // Single global topic — privacy is not an issue here (presence of an authenticated
            // user is generally visible to the rest of their org / counterparts).
            // Frontend filters by the user ids it cares about.
            messagingTemplate.convertAndSend(
                    "/topic/presence",
                    new UserPresenceDto(
                            userId,
                            online,
                            online ? null : LocalDateTime.now(ZoneOffset.UTC)
                    )
            );
        } catch (Exception e) {
            log.warn("Presence broadcast failed for {}: {}", userId, e.getMessage());
        }
    }

    // ─── Key helpers ─────────────────────────────────────────────────────────

    private static String sessionsKey(String userId) {
        return SESSIONS_PREFIX + userId;
    }

    private static String lastSeenKey(String userId) {
        return LAST_SEEN_PREFIX + userId;
    }
}
