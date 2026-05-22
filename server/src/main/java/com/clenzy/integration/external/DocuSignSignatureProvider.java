package com.clenzy.integration.external;

import com.clenzy.service.signature.SignatureProvider;
import com.clenzy.service.signature.SignatureProviderType;
import com.clenzy.service.signature.SignatureRequest;
import com.clenzy.service.signature.SignatureResult;
import com.clenzy.service.signature.SignatureStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * DocuSign — leader mondial signature electronique. Supporte SES + AES + QES
 * (QES via partenariats avec QTSP europeens). Authentification OAuth2 (JWT
 * Grant ou Authorization Code Grant).
 *
 * <h2>Note de design</h2>
 * DocuSign n'utilise PAS le pattern API key generique (ExternalServiceConnection)
 * comme Yousign/Universign/DocaPoste — il utilise OAuth2 avec access_token +
 * refresh_token. Il aura donc sa propre entity {@code DocuSignConnection} +
 * controller dedie {@code DocuSignOAuthController} (a la maniere de
 * PennylaneOAuthController) quand on cablera l'integration.
 *
 * Pour ce scaffolding, on a juste le stub provider — pas encore d'entity
 * pour stocker les tokens DocuSign. Le bouton "Connecter DocuSign" cote UI
 * est desactive avec un tooltip "Configuration manuelle requise par
 * l'administrateur Clenzy" en attendant.
 */
@Service
public class DocuSignSignatureProvider implements SignatureProvider {

    private static final Logger log = LoggerFactory.getLogger(DocuSignSignatureProvider.class);
    private static final String NOT_IMPLEMENTED_MSG =
            "DocuSign signature provider is not yet implemented. "
                    + "OAuth2 flow + connection storage pending.";

    @Override
    public SignatureProviderType getType() {
        return SignatureProviderType.DOCUSIGN;
    }

    @Override
    public SignatureResult createSignatureRequest(SignatureRequest request) {
        log.warn("DocuSignSignatureProvider.createSignatureRequest not implemented yet");
        throw new UnsupportedOperationException(NOT_IMPLEMENTED_MSG);
    }

    @Override
    public SignatureStatus getStatus(String signatureRequestId) {
        log.warn("DocuSignSignatureProvider.getStatus not implemented yet");
        throw new UnsupportedOperationException(NOT_IMPLEMENTED_MSG);
    }

    @Override
    public byte[] getSignedDocument(String signatureRequestId) {
        log.warn("DocuSignSignatureProvider.getSignedDocument not implemented yet");
        throw new UnsupportedOperationException(NOT_IMPLEMENTED_MSG);
    }

    @Override
    public boolean isAvailable() {
        return false;
    }
}
