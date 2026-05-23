package com.clenzy.integration.external;

import com.clenzy.integration.external.service.ExternalServiceConnectionService;
import com.clenzy.service.signature.SignatureProvider;
import com.clenzy.service.signature.SignatureProviderType;
import com.clenzy.service.signature.SignatureRequest;
import com.clenzy.service.signature.SignatureResult;
import com.clenzy.service.signature.SignatureStatus;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Base abstraite pour les SignatureProvider qui s'authentifient via API key
 * (Yousign, Universign, DocaPoste, ...).
 *
 * Mutualise la logique commune :
 *   - delegation a ExternalServiceConnectionService pour la persistance
 *   - {@link #isAvailable()} verifie qu'une connexion existe pour l'org courante
 *   - Methodes de signature sont des stubs (throw UnsupportedOperationException)
 *     a cabler par sous-classe quand le provider est integre.
 *
 * Les sous-classes n'ont besoin de redefinir que {@link #getType()} (1 ligne).
 */
public abstract class AbstractExternalSignatureProvider implements SignatureProvider {

    private static final Logger log = LoggerFactory.getLogger(AbstractExternalSignatureProvider.class);

    protected final ExternalServiceConnectionService connectionService;
    protected final TenantContext tenantContext;

    protected AbstractExternalSignatureProvider(ExternalServiceConnectionService connectionService,
                                                 TenantContext tenantContext) {
        this.connectionService = connectionService;
        this.tenantContext = tenantContext;
    }

    @Override
    public abstract SignatureProviderType getType();

    @Override
    public SignatureResult createSignatureRequest(SignatureRequest request) {
        log.warn("{}.createSignatureRequest called but not implemented yet", getType());
        throw new UnsupportedOperationException(notImplementedMessage("createSignatureRequest"));
    }

    @Override
    public SignatureStatus getStatus(String signatureRequestId) {
        log.warn("{}.getStatus called but not implemented yet", getType());
        throw new UnsupportedOperationException(notImplementedMessage("getStatus"));
    }

    @Override
    public byte[] getSignedDocument(String signatureRequestId) {
        log.warn("{}.getSignedDocument called but not implemented yet", getType());
        throw new UnsupportedOperationException(notImplementedMessage("getSignedDocument"));
    }

    @Override
    public boolean isAvailable() {
        // Pas encore d'impl reelle → toujours false, meme si une connexion est saisie.
        // A passer a true quand la signature est cablee (par sous-classe).
        return false;
    }

    protected String notImplementedMessage(String method) {
        return getType() + "." + method + " is not yet implemented. "
                + "Connection scaffolding is in place; provider integration pending.";
    }
}
