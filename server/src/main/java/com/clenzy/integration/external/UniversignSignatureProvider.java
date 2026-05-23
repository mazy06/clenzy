package com.clenzy.integration.external;

import com.clenzy.integration.external.service.ExternalServiceConnectionService;
import com.clenzy.service.signature.SignatureProviderType;
import com.clenzy.tenant.TenantContext;
import org.springframework.stereotype.Service;

/**
 * Universign (Quadient) — QTSP francais. Supporte SES + AES + QES.
 * Tres utilise dans le secteur bancaire et assurance.
 * API : https://help.universign.com/hc/en-us/categories/360002595260-API
 *
 * Stub pour l'instant. Endpoint principal : POST /v1/transaction pour creer
 * une transaction de signature, puis polling sur /v1/transaction/{id}.
 */
@Service
public class UniversignSignatureProvider extends AbstractExternalSignatureProvider {

    public UniversignSignatureProvider(ExternalServiceConnectionService connectionService,
                                        TenantContext tenantContext) {
        super(connectionService, tenantContext);
    }

    @Override
    public SignatureProviderType getType() {
        return SignatureProviderType.UNIVERSIGN;
    }
}
