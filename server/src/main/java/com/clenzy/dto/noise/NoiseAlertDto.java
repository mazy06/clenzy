package com.clenzy.dto.noise;

import com.clenzy.model.NoiseAlert;

import java.time.LocalDateTime;

public record NoiseAlertDto(
    Long id,
    Long propertyId,
    String propertyName,
    Long deviceId,
    String deviceName,
    String severity,
    double measuredDb,
    int thresholdDb,
    String timeWindowLabel,
    String source,
    boolean notifiedInApp,
    boolean notifiedEmail,
    boolean notifiedGuest,
    boolean acknowledged,
    String acknowledgedBy,
    LocalDateTime acknowledgedAt,
    String notes,
    LocalDateTime createdAt
) {
    public static NoiseAlertDto from(NoiseAlert alert) {
        String propertyName = alert.getProperty() != null
            ? alert.getProperty().getName()
            : null;
        String deviceName = alert.getDevice() != null
            ? alert.getDevice().getName()
            : null;

        return new NoiseAlertDto(
            alert.getId(),
            alert.getPropertyId(),
            propertyName,
            alert.getDeviceId(),
            deviceName,
            alert.getSeverity().name(),
            alert.getMeasuredDb(),
            alert.getThresholdDb(),
            alert.getTimeWindowLabel(),
            alert.getSource().name(),
            alert.isNotifiedInApp(),
            alert.isNotifiedEmail(),
            alert.isNotifiedGuest(),
            alert.isAcknowledged(),
            alert.getAcknowledgedBy(),
            alert.getAcknowledgedAt(),
            alert.getNotes(),
            alert.getCreatedAt()
        );
    }
}
