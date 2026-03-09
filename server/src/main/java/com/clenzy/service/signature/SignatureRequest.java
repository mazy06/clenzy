package com.clenzy.service.signature;

import java.util.List;

/**
 * Demande de signature electronique.
 *
 * @param documentId   identifiant du document a signer
 * @param documentName nom du document
 * @param signers      liste des signataires
 * @param callbackUrl  URL de callback pour les notifications de statut
 * @param orgId        identifiant de l'organisation
 */
public record SignatureRequest(
    Long documentId,
    String documentName,
    List<Signer> signers,
    String callbackUrl,
    Long orgId
) {}
