package com.clenzy.integration.kyc.strategy;

import com.clenzy.integration.kyc.model.KycProviderType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;

import java.util.Map;

/**
 * Test de connexion Veriff — <b>appel réel</b> à l'API publique, requête signée.
 *
 * <h2>Faits d'API « grounded » (documentation publique Veriff)</h2>
 * <ul>
 *   <li>Auth par paire <b>API key</b> (publishable) + <b>Shared secret</b> : les
 *       lectures portent {@code X-AUTH-CLIENT} (API key) et {@code X-HMAC-SIGNATURE} =
 *       HMAC-SHA256 hex de l'identifiant de ressource, signé avec le shared secret.</li>
 *   <li>{@code GET /v1/sessions/{id}/decision} est une lecture sans effet de bord.</li>
 * </ul>
 *
 * <h2>Mapping des champs de connexion</h2>
 * <p>{@code accountIdentifier} = API key / X-AUTH-CLIENT (requis) ;
 * {@code apiKey} = Shared secret.</p>
 *
 * <h2>Verdict (probe sur session inexistante)</h2>
 * <p>On interroge une session-probe au UUID connu comme inexistant : credentials
 * valides → 404 (auth acceptée, session inconnue — attendu) ; credentials
 * invalides → 401/403. Tout autre code = échec explicite.</p>
 */
@Service
public class VeriffConnectionTestStrategy implements KycConnectionTestStrategy {

    private static final Logger log = LoggerFactory.getLogger(VeriffConnectionTestStrategy.class);

    /** UUID-probe volontairement inexistant : seul le verdict d'auth nous intéresse. */
    static final String PROBE_SESSION_ID = "00000000-0000-0000-0000-000000000000";

    private final KycProbeClient probeClient;

    public VeriffConnectionTestStrategy(KycProbeClient probeClient) {
        this.probeClient = probeClient;
    }

    @Override
    public KycProviderType providerType() {
        return KycProviderType.VERIFF;
    }

    @Override
    public boolean testConnection(String serverUrl, String accountIdentifier, String apiKey) {
        if (serverUrl == null || serverUrl.isBlank()
                || apiKey == null || apiKey.isBlank()
                || accountIdentifier == null || accountIdentifier.isBlank()) {
            // API key (accountIdentifier) ET shared secret (apiKey) sont requis pour signer.
            return false;
        }
        try {
            int status = probeClient.probe(
                    HttpMethod.GET,
                    base(serverUrl) + "/v1/sessions/" + PROBE_SESSION_ID + "/decision",
                    Map.of("X-AUTH-CLIENT", accountIdentifier,
                            "X-HMAC-SIGNATURE", KycHmac.sha256Hex(apiKey, PROBE_SESSION_ID),
                            "Accept", "application/json"));
            if (status == 404 || (status >= 200 && status < 300)) {
                return true;
            }
            log.warn("Veriff testConnection: refusé (HTTP {})", status);
            return false;
        } catch (RestClientException e) {
            log.warn("Veriff testConnection: erreur transport ({})", e.getMessage());
            return false;
        }
    }

    private static String base(String serverUrl) {
        String url = serverUrl.trim();
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}
