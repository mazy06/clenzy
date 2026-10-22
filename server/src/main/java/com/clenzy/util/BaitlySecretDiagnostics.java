package com.clenzy.util;

/** Erreurs Baitly de chiffrement sans secret ni graphe d'exceptions privé. */
public final class BaitlySecretDiagnostics {
    public enum Operation { ENCRYPT, DECRYPT, DERIVE_KEY }

    private BaitlySecretDiagnostics() {}

    public static IllegalStateException failure(Operation operation, Throwable original) {
        String message = switch (operation) {
            case ENCRYPT -> "Chiffrement du secret indisponible";
            case DECRYPT -> "Déchiffrement du secret indisponible ; vérification requise";
            case DERIVE_KEY -> "Initialisation de la clé de chiffrement indisponible";
        };
        var safe = new IllegalStateException(message);
        safe.setStackTrace(original.getStackTrace());
        return safe;
    }
}
