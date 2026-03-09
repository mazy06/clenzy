package com.clenzy.service.signature;

/**
 * Interface pour les fournisseurs de signature electronique.
 * Chaque implementation (Pennylane, DocuSign, Odoo, etc.) doit implementer cette interface.
 */
public interface SignatureProvider {

    /**
     * @return le type de fournisseur
     */
    SignatureProviderType getType();

    /**
     * Cree une demande de signature aupres du fournisseur.
     *
     * @param request details de la demande
     * @return resultat contenant l'identifiant et l'URL de signature
     */
    SignatureResult createSignatureRequest(SignatureRequest request);

    /**
     * Recupere le statut actuel d'une demande de signature.
     *
     * @param signatureRequestId identifiant externe de la demande
     * @return statut courant
     */
    SignatureStatus getStatus(String signatureRequestId);

    /**
     * Telecharge le document signe.
     *
     * @param signatureRequestId identifiant externe de la demande
     * @return contenu binaire du document signe (PDF)
     */
    byte[] getSignedDocument(String signatureRequestId);

    /**
     * Verifie si le fournisseur est disponible et correctement configure.
     *
     * @return true si le fournisseur est operationnel
     */
    boolean isAvailable();
}
