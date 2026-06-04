package com.clenzy.integration.tuya.dto;

/**
 * Payload de sauvegarde des credentials du projet Tuya Cloud depuis l'UI.
 * {@code accessSecret} optionnel : laisse vide, conserve le secret deja enregistre.
 */
public record UpdateTuyaConfigDto(
        String accessId,
        String accessSecret,
        String baseUrl,
        String region,
        String appSchema
) {}
