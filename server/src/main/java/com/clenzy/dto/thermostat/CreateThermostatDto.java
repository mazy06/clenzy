package com.clenzy.dto.thermostat;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Requete de creation d'un thermostat. {@code externalDeviceId} = identifiant du
 * device Tuya (pour la lecture/le pilotage via l'API Tuya existante).
 */
public record CreateThermostatDto(
        @NotBlank String name,
        @NotNull Long propertyId,
        String roomName,
        String brand,
        String externalDeviceId
) {
}
