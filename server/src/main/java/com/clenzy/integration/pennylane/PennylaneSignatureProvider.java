package com.clenzy.integration.pennylane;

import com.clenzy.integration.pennylane.config.PennylaneConfig;
import com.clenzy.integration.pennylane.service.PennylaneApiService;
import com.clenzy.service.signature.SignatureProvider;
import com.clenzy.service.signature.SignatureProviderType;
import com.clenzy.service.signature.SignatureRequest;
import com.clenzy.service.signature.SignatureResult;
import com.clenzy.service.signature.SignatureStatus;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * Implementation Pennylane du fournisseur de signature electronique.
 * Delegue les appels au PennylaneApiService.
 */
@Service
@ConditionalOnProperty(name = "clenzy.pennylane.client-id")
public class PennylaneSignatureProvider implements SignatureProvider {

    private final PennylaneApiService apiService;
    private final PennylaneConfig config;

    public PennylaneSignatureProvider(PennylaneApiService apiService, PennylaneConfig config) {
        this.apiService = apiService;
        this.config = config;
    }

    @Override
    public SignatureProviderType getType() {
        return SignatureProviderType.PENNYLANE;
    }

    @Override
    public SignatureResult createSignatureRequest(SignatureRequest request) {
        return apiService.createSignatureRequest(request);
    }

    @Override
    public SignatureStatus getStatus(String signatureRequestId) {
        return apiService.getSignatureStatus(signatureRequestId);
    }

    @Override
    public byte[] getSignedDocument(String signatureRequestId) {
        return apiService.downloadDocument(signatureRequestId);
    }

    @Override
    public boolean isAvailable() {
        return config.isConfigured();
    }
}
