package com.clenzy.dto;

import com.clenzy.model.SecurityAuditLog;

import java.time.Instant;

/**
 * DTO pour exposer les logs d'audit securite via l'API monitoring.
 */
public record SecurityAuditLogDto(
    Long id,
    String timestamp,
    String eventType,
    String action,
    String actorId,
    String actorEmail,
    String actorIp,
    String result,
    String details,
    String userAgent
) {
    public static SecurityAuditLogDto from(SecurityAuditLog log) {
        return new SecurityAuditLogDto(
            log.getId(),
            log.getCreatedAt() != null ? log.getCreatedAt().toString() : null,
            log.getEventType() != null ? log.getEventType().name() : null,
            log.getAction(),
            log.getActorId(),
            log.getActorEmail(),
            log.getActorIp(),
            log.getResult(),
            log.getDetails(),
            log.getUserAgent()
        );
    }
}
