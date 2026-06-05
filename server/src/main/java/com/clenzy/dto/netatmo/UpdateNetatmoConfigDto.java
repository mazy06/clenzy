package com.clenzy.dto.netatmo;

/**
 * Payload de sauvegarde des credentials de l'app Netatmo depuis l'UI.
 * {@code clientSecret} optionnel : laisse vide, conserve la valeur deja enregistree.
 */
public record UpdateNetatmoConfigDto(
        String clientId,
        String clientSecret,
        String redirectUri
) {}
