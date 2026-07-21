package com.clenzy.integration.compliance.strategy;

import com.clenzy.integration.compliance.model.ComplianceProviderType;

/**
 * Contrat pour tester la connexion vers un provider de conformite legale
 * (declaration de voyageurs aupres des autorites locales).
 */
public interface ComplianceConnectionTestStrategy {

    ComplianceProviderType providerType();

    /** Teste les credentials. true si l'authentification reussit. */
    boolean testConnection(String serverUrl, String accountIdentifier, String apiKey);
}
