package com.clenzy.integration.kyc.strategy;

import com.clenzy.integration.kyc.model.KycProviderType;

/** Contrat de test de connexion pour un provider KYC. */
public interface KycConnectionTestStrategy {

    KycProviderType providerType();

    boolean testConnection(String serverUrl, String accountIdentifier, String apiKey);
}
