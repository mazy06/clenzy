package com.clenzy.integration.tuya.dto;

/**
 * Identifiants du compte app Tuya d'un hote (modele C), renvoyes au mobile pour la connexion SDK
 * avant l'appairage. {@code secret} = mot de passe du compte app — transmis uniquement a l'hote
 * authentifie proprietaire du compte, sur HTTPS.
 *
 * <p>TODO (durcissement) : remplacer le password en clair par un token de login SDK a usage unique
 * une fois le mecanisme exact du SDK Tuya confirme.
 */
public record TuyaAppAccountDto(
        String tuyaUid,
        String username,
        String secret,
        String countryCode,
        String schema
) {}
