package com.clenzy.dto.environment;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Requete de creation d'un capteur d'environnement. {@code sensorType} ∈
 * {TEMP_HUMIDITY, CONTACT, MOTION, SMOKE}. {@code externalDeviceId} = identifiant
 * du device Tuya (pour la lecture d'etat via l'API Tuya existante).
 */
public record CreateEnvironmentSensorDto(
        @NotBlank String name,
        @NotNull Long propertyId,
        String roomName,
        @NotBlank String sensorType,
        String brand,
        String externalDeviceId
) {
}
