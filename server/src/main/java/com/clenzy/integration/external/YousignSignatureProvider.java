package com.clenzy.integration.external;

import com.clenzy.integration.external.service.ExternalServiceConnectionService;
import com.clenzy.service.signature.SignatureProviderType;
import com.clenzy.tenant.TenantContext;
import org.springframework.stereotype.Service;

/**
 * Yousign — QTSP francais (ANSSI, certifie 2017). Supporte SES + AES + QES.
 * API REST documentee sur https://developers.yousign.com/.
 *
 * Stub pour l'instant. A cabler quand l'organisation aura un compte Yousign
 * (free tier disponible sur signup) :
 *   - POST /v3/signature_requests pour creer une demande
 *   - GET  /v3/signature_requests/{id} pour le statut
 *   - GET  /v3/signature_requests/{id}/documents/{docId}/download pour le PDF
 */
@Service
public class YousignSignatureProvider extends AbstractExternalSignatureProvider {

    public YousignSignatureProvider(ExternalServiceConnectionService connectionService,
                                     TenantContext tenantContext) {
        super(connectionService, tenantContext);
    }

    @Override
    public SignatureProviderType getType() {
        return SignatureProviderType.YOUSIGN;
    }
}
