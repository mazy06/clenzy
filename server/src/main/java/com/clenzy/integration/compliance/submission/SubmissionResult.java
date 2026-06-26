package com.clenzy.integration.compliance.submission;

/**
 * Résultat d'une soumission de fiche de police à un provider de conformité.
 *
 * <p>Immuable. {@code accepted=true} signifie que le provider a accusé réception
 * de la déclaration ; {@code externalReference} porte alors l'identifiant retourné
 * (id réservation/guest chez le provider) pour traçabilité. {@code accepted=false}
 * porte la raison dans {@code message} (rejet métier ou intégration en attente de
 * specs officielles) — l'orchestrateur la trace, ne l'avale jamais.</p>
 *
 * @param accepted          true si la déclaration a été acceptée par le provider
 * @param externalReference identifiant retourné par le provider (nullable si non accepté)
 * @param message           message humain (succès ou raison de l'échec / pending)
 */
public record SubmissionResult(boolean accepted, String externalReference, String message) {

    public static SubmissionResult accepted(String externalReference, String message) {
        return new SubmissionResult(true, externalReference, message);
    }

    public static SubmissionResult rejected(String message) {
        return new SubmissionResult(false, null, message);
    }
}
