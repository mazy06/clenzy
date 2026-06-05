package com.clenzy.dto.netatmo;

/**
 * Statut de configuration de l'app Netatmo (credentials plateforme), expose a l'UI.
 * Le secret n'est JAMAIS renvoye — seul {@code configured} indique s'il est present.
 * {@code clientId} / {@code redirectUri} (non secrets) sont renvoyes pour le pre-remplissage.
 */
public record NetatmoConfigStatusDto(
        boolean configured,
        String clientId,
        String redirectUri
) {}
