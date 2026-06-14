package com.clenzy.dto;

import com.clenzy.model.AnomalySeverity;
import com.clenzy.model.AnomalyType;

/**
 * Anomalie détectée (Phase 4 différenciation). DTO record, jamais l'entité JPA exposée (audit #5).
 *
 * @param type        nature de l'anomalie
 * @param severity    gravité
 * @param entityType  type d'entité concernée (ex : "reservation")
 * @param entityId    identifiant de l'entité concernée
 * @param description message lisible (déjà localisé côté appelant si besoin)
 */
public record AnomalyDto(
    AnomalyType type,
    AnomalySeverity severity,
    String entityType,
    Long entityId,
    String description
) {
}
