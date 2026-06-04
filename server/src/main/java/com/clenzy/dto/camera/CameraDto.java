package com.clenzy.dto.camera;

import java.time.LocalDateTime;

/**
 * Vue d'une camera cote client. N'expose JAMAIS l'URL RTSP (credentials) :
 * la lecture passe par {@code webrtcUrl} (flux servi par go2rtc).
 */
public record CameraDto(
        Long id,
        String name,
        Long propertyId,
        String propertyName,
        String roomName,
        String brand,
        String status,
        boolean online,
        boolean recording,
        String streamName,
        String webrtcUrl,
        String snapshotUrl,
        LocalDateTime createdAt
) {
}
