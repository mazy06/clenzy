package com.clenzy.dto.thermostat;

import java.time.LocalDateTime;

/**
 * Vue d'un thermostat cote client. Temperatures en °C (Double), mode normalise
 * (heat | cool | eco | off).
 */
public record ThermostatDto(
        Long id,
        String name,
        Long propertyId,
        String propertyName,
        String roomName,
        String brand,
        String status,
        boolean online,
        Double currentTempC,
        Double targetTempC,
        Integer humidity,
        String mode,
        String preset,
        LocalDateTime createdAt
) {
}
