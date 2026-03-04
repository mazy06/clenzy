package com.clenzy.service.smartlock;

/**
 * Informations d'un device serrure connectee, independamment du provider.
 *
 * @param deviceId        identifiant externe du device chez le provider
 * @param name            nom du device
 * @param batteryLevel    niveau de batterie (0-100), null si inconnu
 * @param online          true si le device est en ligne
 * @param lockState       etat du verrou (LOCKED, UNLOCKED, UNKNOWN)
 * @param firmwareVersion version du firmware, null si inconnue
 */
public record SmartLockDeviceInfo(
        String deviceId,
        String name,
        Integer batteryLevel,
        boolean online,
        String lockState,
        String firmwareVersion
) {
}
