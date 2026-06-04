package com.clenzy.integration.tuya.dto;

/**
 * Statut de configuration du projet Tuya Cloud (credentials plateforme), expose a l'UI.
 * Le secret n'est JAMAIS renvoye — seul {@code configured} indique s'il est present.
 */
public record TuyaConfigStatusDto(
        boolean configured,
        String accessId,
        String baseUrl,
        String region,
        String appSchema
) {}
