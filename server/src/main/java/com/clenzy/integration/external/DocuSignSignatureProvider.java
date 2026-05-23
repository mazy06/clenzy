package com.clenzy.integration.external;

import com.clenzy.integration.docusign.config.DocuSignConfig;
import com.clenzy.integration.docusign.service.DocuSignOAuthService;
import com.clenzy.service.signature.SignatureProvider;
import com.clenzy.service.signature.SignatureProviderType;
import com.clenzy.service.signature.SignatureRequest;
import com.clenzy.service.signature.SignatureResult;
import com.clenzy.service.signature.SignatureStatus;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * DocuSign — leader mondial signature electronique. Supporte SES + AES + QES
 * (QES via partenariats avec QTSP europeens). Authentification OAuth2 via
 * Authorization Code Grant (cable sur le moteur OAuth partage —
 * {@link com.clenzy.integration.oauth.OAuthFlowEngine}).
 *
 * <h2>Etat actuel</h2>
 * <ul>
 *   <li><b>Connexion OAuth :</b> entierement cablee (controller, service,
 *       persistance) — meme infrastructure que Pennylane.</li>
 *   <li><b>API eSignature (create envelope / status / download) :</b> stubs
 *       qui jetent {@code UnsupportedOperationException}. A cabler quand on
 *       aura un Integration Key DocuSign actif + scenarios de signature
 *       cotes par les utilisateurs Clenzy.</li>
 * </ul>
 *
 * <h2>Activation</h2>
 * Le bean n'est instancie que si {@code clenzy.docusign.client-id} est defini
 * dans la config Spring. Sans cette propriete, DocuSign reste "non configure"
 * cote UI (selectable mais affiche un message clair).
 */
@Service
@ConditionalOnProperty(name = "clenzy.docusign.client-id")
public class DocuSignSignatureProvider implements SignatureProvider {

    private static final Logger log = LoggerFactory.getLogger(DocuSignSignatureProvider.class);
    private static final String NOT_IMPLEMENTED_MSG =
            "DocuSign envelope API not implemented yet. Connection works but signature "
                    + "operations need a real DocuSign Integration Key.";

    private final DocuSignConfig config;
    private final DocuSignOAuthService oauthService;
    private final TenantContext tenantContext;

    public DocuSignSignatureProvider(DocuSignConfig config,
                                       DocuSignOAuthService oauthService,
                                       TenantContext tenantContext) {
        this.config = config;
        this.oauthService = oauthService;
        this.tenantContext = tenantContext;
    }

    @Override
    public SignatureProviderType getType() {
        return SignatureProviderType.DOCUSIGN;
    }

    @Override
    public SignatureResult createSignatureRequest(SignatureRequest request) {
        ensureConnected();
        log.warn("DocuSignSignatureProvider.createSignatureRequest not implemented yet");
        throw new UnsupportedOperationException(NOT_IMPLEMENTED_MSG);
    }

    @Override
    public SignatureStatus getStatus(String signatureRequestId) {
        ensureConnected();
        log.warn("DocuSignSignatureProvider.getStatus not implemented yet");
        throw new UnsupportedOperationException(NOT_IMPLEMENTED_MSG);
    }

    @Override
    public byte[] getSignedDocument(String signatureRequestId) {
        ensureConnected();
        log.warn("DocuSignSignatureProvider.getSignedDocument not implemented yet");
        throw new UnsupportedOperationException(NOT_IMPLEMENTED_MSG);
    }

    /**
     * Indique si le provider est utilisable : config presente ET connexion
     * etablie pour l'organisation courante.
     */
    @Override
    public boolean isAvailable() {
        if (!config.isConfigured()) {
            return false;
        }
        Long orgId = tenantContext.getOrganizationId();
        return orgId != null && oauthService.isConnected(orgId);
    }

    private void ensureConnected() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        if (!oauthService.isConnected(orgId)) {
            throw new IllegalStateException(
                "DocuSign : organisation " + orgId + " n'est pas connectee. "
                + "Appeler /api/docusign/connect d'abord.");
        }
    }
}
