package com.clenzy.integration.oauth;

/** Diagnostics Baitly bornés, sans réponse OAuth ni graphe d'exceptions privé. */
public final class BaitlyOAuthDiagnostics {
    public enum Operation { EXCHANGE, REFRESH, REVOKE }
    private BaitlyOAuthDiagnostics() {}

    public static String message(Operation operation) {
        return switch(operation) {
            case EXCHANGE -> "Connexion OAuth non confirmée ; reconnexion requise";
            case REFRESH -> "Rafraîchissement OAuth non confirmé ; reconnexion requise";
            case REVOKE -> "Révocation distante non confirmée ; connexion supprimée localement";
        };
    }

    public static IllegalStateException failure(Operation operation, Throwable original) {
        var safe = new IllegalStateException(message(operation));
        safe.setStackTrace(original.getStackTrace());
        return safe;
    }
}
