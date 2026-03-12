package com.clenzy.dto;

/**
 * Resultat d'un test de cle API IA.
 *
 * @param success   true si l'appel API a reussi (cle valide + compte fonctionnel)
 * @param keyValid  true si la cle elle-meme est authentifiee (meme si le compte manque de credits)
 * @param message   message descriptif (succes ou raison de l'echec)
 * @param provider  nom du provider teste ("openai" ou "anthropic")
 */
public record AiApiKeyTestResultDto(
        boolean success,
        boolean keyValid,
        String message,
        String provider
) {
}
