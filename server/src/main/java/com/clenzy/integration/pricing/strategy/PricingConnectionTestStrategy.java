package com.clenzy.integration.pricing.strategy;

import com.clenzy.integration.pricing.model.PricingProviderType;

/**
 * Contrat pour tester la connexion vers un provider de tarification dynamique.
 * Mirror de {@code ConnectionTestStrategy} mais pour le domaine pricing.
 */
public interface PricingConnectionTestStrategy {

    PricingProviderType providerType();

    /**
     * Teste les credentials contre l'API du provider.
     * @return true si l'authentification reussit, false sinon.
     */
    boolean testConnection(String serverUrl, String accountIdentifier, String apiKey);
}
