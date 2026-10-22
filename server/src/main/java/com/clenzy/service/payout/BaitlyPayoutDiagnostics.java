package com.clenzy.service.payout;

/** Diagnostics Baitly sans contenu fournisseur, coordonnées ni secrets. */
public final class BaitlyPayoutDiagnostics {
    public static final String FUNDS_UNAVAILABLE = "Financement du versement indisponible. Aucun transfert émis.";
    public static final String RECONCILIATION_REQUIRED = "Résultat du versement à rapprocher. Aucune réémission automatique.";
    public static final String PREPARATION_FAILED = "Préparation du versement indisponible. Vérification requise.";

    private BaitlyPayoutDiagnostics() {}

    /** Garde la pile technique ; ne copie ni message, ni cause, ni exception supprimée. */
    public static RuntimeException technicalCause(Throwable failure) {
        var safe = new IllegalStateException(RECONCILIATION_REQUIRED);
        safe.setStackTrace(failure.getStackTrace());
        return safe;
    }
}
