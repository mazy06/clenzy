package com.clenzy.integration.tuya.dto;

/**
 * Credentials de l'App SDK Tuya pour l'init du SDK natif mobile, par plateforme (ios|android).
 *
 * <p>Le SDK Tuya exige l'AppKey + AppSecret <b>cote client</b> (ils sont de toute facon embarques
 * dans tout build d'app natif). C'est donc une exposition <b>deliberee</b> a l'app authentifiee,
 * equivalente a un bake-in, mais configurable en base (DB-first) sans re-build.
 */
public record TuyaAppSdkCredentialsDto(
        String platform,
        String appKey,
        String appSecret
) {}
