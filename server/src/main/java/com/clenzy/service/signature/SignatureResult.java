package com.clenzy.service.signature;

/**
 * Resultat d'une demande de signature electronique.
 *
 * @param success            true si la demande a ete creee avec succes
 * @param signatureRequestId identifiant externe de la demande de signature
 * @param signingUrl         URL de signature pour le signataire
 * @param errorMessage       message d'erreur si la demande a echoue
 */
public record SignatureResult(
    boolean success,
    String signatureRequestId,
    String signingUrl,
    String errorMessage
) {

    public static SignatureResult success(String requestId, String signingUrl) {
        return new SignatureResult(true, requestId, signingUrl, null);
    }

    public static SignatureResult failure(String error) {
        return new SignatureResult(false, null, null, error);
    }
}
