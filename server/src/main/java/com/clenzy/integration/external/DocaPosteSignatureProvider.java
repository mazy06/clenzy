package com.clenzy.integration.external;

import com.clenzy.integration.external.service.ExternalServiceConnectionService;
import com.clenzy.service.signature.SignatureProviderType;
import com.clenzy.tenant.TenantContext;
import org.springframework.stereotype.Service;

/**
 * DocaPoste (groupe La Poste) — QTSP francais. Supporte SES + AES + QES.
 * Atout specifique : integration LRE (Lettre Recommandee Electronique) qui
 * peut etre utile pour les mises en demeure aux locataires.
 *
 * API : suite Docusign-like + LRE add-on (https://www.docaposte.com/api).
 *
 * Stub pour l'instant.
 */
@Service
public class DocaPosteSignatureProvider extends AbstractExternalSignatureProvider {

    public DocaPosteSignatureProvider(ExternalServiceConnectionService connectionService,
                                       TenantContext tenantContext) {
        super(connectionService, tenantContext);
    }

    @Override
    public SignatureProviderType getType() {
        return SignatureProviderType.DOCAPOSTE;
    }
}
