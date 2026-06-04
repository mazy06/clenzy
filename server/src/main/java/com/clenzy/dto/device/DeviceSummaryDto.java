package com.clenzy.dto.device;

import java.time.LocalDateTime;

/**
 * Read-model unifie d'un objet connecte (serrure, capteur sonore, point de remise
 * des cles). Agrege les 3 types pour le Hub /connected-objects via GET /api/devices.
 *
 * Champs nullables selon le type :
 * - lockState, batteryLevel  : serrures uniquement
 * - activeCodesCount         : points de remise uniquement
 * - snapshotUrl              : cameras uniquement (poster du flux go2rtc)
 * - roomName                 : non renseigne pour les points de remise
 */
public record DeviceSummaryDto(
        String kind,              // "lock" | "noise" | "keybox"
        Long id,
        String name,
        Long propertyId,
        String propertyName,
        String roomName,
        String provider,          // brand (lock) / deviceType (noise) / provider (keybox)
        String status,            // ACTIVE | INACTIVE | PENDING
        String lockState,         // serrures : LOCKED | UNLOCKED | UNKNOWN
        Integer batteryLevel,     // serrures
        Integer activeCodesCount, // points de remise
        String snapshotUrl,       // cameras : URL du poster (go2rtc frame.jpeg)
        LocalDateTime createdAt
) {
}
