package com.clenzy.integration.compliance.strategy;

import com.clenzy.integration.compliance.model.ComplianceProviderType;
import com.clenzy.integration.compliance.submission.chekin.ChekinApiClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;

/**
 * Test de connexion Chekin — <b>appel reel</b> a l'API publique.
 *
 * <p>Valide la cle API en tentant l'echange cle → JWT temporaire (meme flux que la
 * soumission des declarations, cf. {@link ChekinApiClient#exchangeApiKeyForToken}).
 * Une cle invalide ou une URL injoignable font echouer l'echange → credentials
 * refusees avant toute persistance.</p>
 */
@Service
public class ChekinConnectionTestStrategy implements ComplianceConnectionTestStrategy {

    private static final Logger log = LoggerFactory.getLogger(ChekinConnectionTestStrategy.class);

    private final ChekinApiClient client;

    public ChekinConnectionTestStrategy(ChekinApiClient client) {
        this.client = client;
    }

    @Override
    public ComplianceProviderType providerType() {
        return ComplianceProviderType.CHEKIN;
    }

    @Override
    public boolean testConnection(String serverUrl, String accountIdentifier, String apiKey) {
        if (serverUrl == null || serverUrl.isBlank() || apiKey == null || apiKey.isBlank()) {
            return false;
        }
        try {
            String token = client.exchangeApiKeyForToken(
                    serverUrl, ChekinApiClient.DEFAULT_TOKEN_PATH, apiKey);
            return token != null && !token.isBlank();
        } catch (RestClientException | IllegalStateException e) {
            // Cle invalide, URL injoignable ou reponse sans token : refus explicite, jamais avale.
            log.warn("Chekin testConnection: echec de l'echange cle API → JWT ({})", e.getMessage());
            return false;
        }
    }
}
