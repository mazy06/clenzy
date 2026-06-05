package com.clenzy.dto.environment;

import java.time.LocalDateTime;

/**
 * Vue d'un capteur d'environnement cote client. Champs d'etat nullables selon le
 * {@code sensorType} :
 * - temperatureC / humidity : TEMP_HUMIDITY
 * - contactOpen             : CONTACT (true = ouvert)
 * - motionDetected          : MOTION
 * - smokeDetected           : SMOKE
 * {@code online} tri-etat (null = jamais synchronise).
 */
public record EnvironmentSensorDto(
        Long id,
        String name,
        Long propertyId,
        String propertyName,
        String roomName,
        String sensorType,        // TEMP_HUMIDITY | CONTACT | MOTION | SMOKE
        String brand,
        String status,            // ACTIVE | INACTIVE | PENDING
        Boolean online,
        Integer batteryLevel,
        Double temperatureC,
        Integer humidity,
        Boolean contactOpen,
        Boolean motionDetected,
        Boolean smokeDetected,
        LocalDateTime lastSeenAt,
        LocalDateTime lastEventAt,
        LocalDateTime createdAt
) {
}
