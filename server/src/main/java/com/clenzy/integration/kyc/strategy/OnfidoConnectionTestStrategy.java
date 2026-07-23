package com.clenzy.integration.kyc.strategy;

import com.clenzy.integration.kyc.model.KycProviderType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;

import java.util.Map;

/**
 * Test de connexion Onfido — <b>appel réel</b> à l'API publique.
 *
 * <h2>Faits d'API « grounded » (documentation publique Onfido)</h2>
 * <ul>
 *   <li>Auth : un unique API token, en-tête {@code Authorization: Token token=<api_token>}.</li>
 *   <li>Base régionale versionnée (ex. {@code https://api.eu.onfido.com/v3.6}) — prise du
 *       {@code serverUrl} de la connexion, jamais devinée en dur.</li>
 *   <li>{@code GET /applicants} liste les applicants — lecture seule, sans effet de bord.</li>
 * </ul>
 *
 * <p>Verdict : 2xx = token valide ; 401/403 = token refusé ; tout autre code (mauvaise
 * base URL, chemin invalide) = échec explicite.</p>
 */
@Service
public class OnfidoConnectionTestStrategy implements KycConnectionTestStrategy {

    private static final Logger log = LoggerFactory.getLogger(OnfidoConnectionTestStrategy.class);

    /** Chemin de listing des applicants (lecture seule, limité à 1 résultat). */
    static final String DEFAULT_LIST_PATH = "/applicants?per_page=1";

    private final KycProbeClient probeClient;

    public OnfidoConnectionTestStrategy(KycProbeClient probeClient) {
        this.probeClient = probeClient;
    }

    @Override
    public KycProviderType providerType() {
        return KycProviderType.ONFIDO;
    }

    @Override
    public boolean testConnection(String serverUrl, String accountIdentifier, String apiKey) {
        if (serverUrl == null || serverUrl.isBlank() || apiKey == null || apiKey.isBlank()) {
            return false;
        }
        try {
            int status = probeClient.probe(
                    HttpMethod.GET,
                    base(serverUrl) + DEFAULT_LIST_PATH,
                    Map.of("Authorization", "Token token=" + apiKey,
                            "Accept", "application/json"));
            if (status >= 200 && status < 300) {
                return true;
            }
            log.warn("Onfido testConnection: refusé (HTTP {})", status);
            return false;
        } catch (RestClientException e) {
            log.warn("Onfido testConnection: erreur transport ({})", e.getMessage());
            return false;
        }
    }

    private static String base(String serverUrl) {
        String url = serverUrl.trim();
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}
