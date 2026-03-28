package com.clenzy.dto;

import com.clenzy.model.Incident;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * DTO immutable pour exposer un Incident via l'API REST.
 */
public record IncidentDto(
        Long id,
        Incident.IncidentType type,
        Incident.IncidentSeverity severity,
        Incident.IncidentStatus status,
        String serviceName,
        String title,
        String description,
        LocalDateTime openedAt,
        LocalDateTime acknowledgedAt,
        LocalDateTime resolvedAt,
        BigDecimal resolutionMinutes,
        boolean autoDetected,
        boolean autoResolved
) {

    public static IncidentDto from(Incident incident) {
        return new IncidentDto(
                incident.getId(),
                incident.getType(),
                incident.getSeverity(),
                incident.getStatus(),
                incident.getServiceName(),
                incident.getTitle(),
                incident.getDescription(),
                incident.getOpenedAt(),
                incident.getAcknowledgedAt(),
                incident.getResolvedAt(),
                incident.getResolutionMinutes(),
                incident.isAutoDetected(),
                incident.isAutoResolved()
        );
    }
}
