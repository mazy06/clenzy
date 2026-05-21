package com.clenzy.dto;

import java.time.LocalDateTime;

/**
 * Presence status of a user.
 *
 * <ul>
 *   <li>{@code online} = true when the user has at least one active WebSocket session.</li>
 *   <li>{@code lastSeen} = ISO timestamp of the last clean disconnect (null if never connected
 *   from a tracked instance, or if currently online).</li>
 * </ul>
 *
 * The representation is intentionally minimal so it stays cheap to serialize for bulk lookups.
 */
public record UserPresenceDto(
        String userId,
        boolean online,
        LocalDateTime lastSeen
) {
}
