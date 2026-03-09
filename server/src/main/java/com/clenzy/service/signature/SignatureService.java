package com.clenzy.service.signature;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Service orchestrateur pour la signature electronique.
 * Delegue les operations au fournisseur actif via le registre.
 */
@Service
public class SignatureService {

    private static final Logger log = LoggerFactory.getLogger(SignatureService.class);

    private final SignatureProviderRegistry providerRegistry;

    public SignatureService(SignatureProviderRegistry providerRegistry) {
        this.providerRegistry = providerRegistry;
    }

    /**
     * Cree une demande de signature pour un document.
     *
     * @param documentId identifiant du document a signer
     * @param signers    liste des signataires
     * @param orgId      identifiant de l'organisation
     * @return resultat de la demande
     */
    public SignatureResult requestSignature(Long documentId, List<Signer> signers, Long orgId) {
        SignatureProvider provider = providerRegistry.getActiveProvider();

        log.info("Demande de signature — document: {}, signataires: {}, fournisseur: {}",
            documentId, signers.size(), provider.getType());

        SignatureRequest request = new SignatureRequest(
            documentId,
            "Document #" + documentId,
            signers,
            null,
            orgId
        );

        SignatureResult result = provider.createSignatureRequest(request);

        if (result.success()) {
            log.info("Signature demandee — requestId: {}", result.signatureRequestId());
        } else {
            log.error("Echec demande de signature — document: {}, erreur: {}",
                documentId, result.errorMessage());
        }

        return result;
    }

    /**
     * Recupere le statut d'une demande de signature.
     *
     * @param requestId identifiant externe de la demande
     * @return statut courant
     */
    public SignatureStatus getSignatureStatus(String requestId) {
        SignatureProvider provider = providerRegistry.getActiveProvider();
        return provider.getStatus(requestId);
    }

    /**
     * Telecharge le document signe.
     *
     * @param requestId identifiant externe de la demande
     * @return contenu binaire du document signe (PDF)
     */
    public byte[] downloadSignedDocument(String requestId) {
        SignatureProvider provider = providerRegistry.getActiveProvider();
        return provider.getSignedDocument(requestId);
    }
}
