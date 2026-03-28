package com.clenzy.dto;

/**
 * Resultat d'un retest de service pour un incident.
 */
public record RetestResultDto(
        String service,
        String status,
        String message,
        boolean resolved
) {
}
