package com.clenzy.integration.tuya.dto;

/**
 * Statut de configuration du projet Tuya Cloud (credentials plateforme), expose a l'UI.
 * Les secrets ne sont JAMAIS renvoyes — seul {@code configured} indique si l'access secret est present.
 * Les AppKey App SDK ({@code appKey} = iOS, {@code androidAppKey} = Android) sont renvoyees pour
 * le pre-remplissage du dialog (ce ne sont pas des secrets).
 */
public record TuyaConfigStatusDto(
        boolean configured,
        String accessId,
        String baseUrl,
        String region,
        String appSchema,
        String appKey,
        String androidAppKey
) {}
