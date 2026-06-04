package com.clenzy.integration.tuya.dto;

/**
 * Payload de sauvegarde des credentials du projet Tuya Cloud depuis l'UI.
 * Secrets optionnels : laisses vides, conservent les valeurs deja enregistrees.
 * Les couples AppKey/AppSecret App SDK sont <b>distincts par plateforme</b> :
 * {@code appKey}/{@code appSecret} = iOS, {@code androidAppKey}/{@code androidAppSecret} = Android.
 */
public record UpdateTuyaConfigDto(
        String accessId,
        String accessSecret,
        String baseUrl,
        String region,
        String appSchema,
        String appKey,
        String appSecret,
        String androidAppKey,
        String androidAppSecret
) {}
