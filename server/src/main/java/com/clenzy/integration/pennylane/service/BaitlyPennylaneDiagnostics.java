package com.clenzy.integration.pennylane.service;

import com.clenzy.integration.oauth.BaitlyOAuthBusyException;

/** Diagnostics comptables Baitly fermés : aucun contenu d'exception fournisseur n'est recopié. */
public final class BaitlyPennylaneDiagnostics {
    private BaitlyPennylaneDiagnostics() {}

    public enum Reason {
        UNAVAILABLE("API Pennylane temporairement indisponible"),
        INVALID_RESPONSE("Réponse Pennylane invalide : identifiant absent ou invalide"),
        UNSUPPORTED_VAT("Taux de TVA non reconnu pour l'export Pennylane"),
        OAUTH_BUSY("Opération OAuth déjà en cours ; réessayer ultérieurement"),
        UNCONFIRMED("Synchronisation non confirmée ; vérifier le résultat avant de relancer");

        private final String message;
        Reason(String message) { this.message = message; }
        public String message() { return message; }
    }

    public static Failure failure(Reason reason) { return new Failure(reason); }

    public static Reason reason(Throwable failure) {
        if (failure instanceof BaitlyOAuthBusyException) return Reason.OAUTH_BUSY;
        if (failure instanceof Failure known) return known.reason;
        // Ne jamais classifier par message, ni parcourir les causes d'une erreur inconnue.
        return Reason.UNCONFIRMED;
    }

    public static final class Failure extends IllegalStateException {
        private final Reason reason;
        private Failure(Reason reason) {
            super(reason.message(), null);
            this.reason = reason;
        }
    }
}
