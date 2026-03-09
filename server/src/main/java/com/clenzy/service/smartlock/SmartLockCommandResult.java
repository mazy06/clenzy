package com.clenzy.service.smartlock;

/**
 * Resultat d'une commande envoyee a une serrure connectee.
 *
 * @param success    true si la commande a ete executee avec succes
 * @param message    message descriptif (succes ou erreur)
 * @param externalId identifiant externe retourne par le provider (ex: code ID)
 */
public record SmartLockCommandResult(
        boolean success,
        String message,
        String externalId
) {

    public static SmartLockCommandResult success(String message) {
        return new SmartLockCommandResult(true, message, null);
    }

    public static SmartLockCommandResult success(String message, String externalId) {
        return new SmartLockCommandResult(true, message, externalId);
    }

    public static SmartLockCommandResult failure(String message) {
        return new SmartLockCommandResult(false, message, null);
    }
}
