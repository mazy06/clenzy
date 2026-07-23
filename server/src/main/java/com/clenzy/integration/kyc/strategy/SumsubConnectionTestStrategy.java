package com.clenzy.integration.kyc.strategy;

import com.clenzy.integration.kyc.model.KycProviderType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;

import java.time.Clock;
import java.util.Map;

/**
 * Test de connexion Sumsub — <b>appel réel</b> à l'API publique, requête signée.
 *
 * <h2>Faits d'API « grounded » (documentation publique Sumsub)</h2>
 * <ul>
 *   <li>Auth par paire <b>App Token</b> + <b>Secret Key</b> : chaque requête porte
 *       {@code X-App-Token}, {@code X-App-Access-Ts} (epoch secondes) et
 *       {@code X-App-Access-Sig} = HMAC-SHA256 hex de {@code ts + METHOD + pathAvecQuery}
 *       signé avec la Secret Key. Un token ou une signature invalides → 401.</li>
 *   <li>{@code POST /resources/accessTokens?userId=...} émet un token SDK éphémère —
 *       l'étape canonique de toute intégration, sans effet de bord durable.</li>
 * </ul>
 *
 * <h2>Mapping des champs de connexion</h2>
 * <p>{@code accountIdentifier} = App Token (requis) ; {@code apiKey} = Secret Key.</p>
 *
 * <h2>Verdict</h2>
 * <p>401/403 = credentials refusées. 2xx = credentials valides. <b>400 = credentials
 * valides</b> : chez Sumsub les erreurs d'auth sont des 401 — un 400 signifie que la
 * requête a été authentifiée mais que le contrat de paramètres (ex. levelName requis
 * selon la config du compte) diffère ; on ne pénalise pas la connexion pour ça.
 * Tout autre code (404 = mauvaise base URL…) = échec explicite.</p>
 */
@Service
public class SumsubConnectionTestStrategy implements KycConnectionTestStrategy {

    private static final Logger log = LoggerFactory.getLogger(SumsubConnectionTestStrategy.class);

    /** Chemin (avec query) d'émission d'un token SDK éphémère, utilisé comme probe. */
    static final String DEFAULT_PROBE_PATH = "/resources/accessTokens?userId=baitly-connection-test&ttlInSecs=600";

    private final KycProbeClient probeClient;
    private final Clock clock;

    public SumsubConnectionTestStrategy(KycProbeClient probeClient, Clock clock) {
        this.probeClient = probeClient;
        this.clock = clock;
    }

    @Override
    public KycProviderType providerType() {
        return KycProviderType.SUMSUB;
    }

    @Override
    public boolean testConnection(String serverUrl, String accountIdentifier, String apiKey) {
        if (serverUrl == null || serverUrl.isBlank()
                || apiKey == null || apiKey.isBlank()
                || accountIdentifier == null || accountIdentifier.isBlank()) {
            // App Token (accountIdentifier) ET Secret Key (apiKey) sont requis pour signer.
            return false;
        }
        try {
            String ts = String.valueOf(clock.instant().getEpochSecond());
            String signature = KycHmac.sha256Hex(apiKey, ts + "POST" + DEFAULT_PROBE_PATH);
            int status = probeClient.probe(
                    HttpMethod.POST,
                    base(serverUrl) + DEFAULT_PROBE_PATH,
                    Map.of("X-App-Token", accountIdentifier,
                            "X-App-Access-Ts", ts,
                            "X-App-Access-Sig", signature,
                            "Accept", "application/json"));
            if (status == 401 || status == 403) {
                log.warn("Sumsub testConnection: credentials refusées (HTTP {})", status);
                return false;
            }
            if ((status >= 200 && status < 300) || status == 400) {
                return true;
            }
            log.warn("Sumsub testConnection: réponse inattendue (HTTP {})", status);
            return false;
        } catch (RestClientException e) {
            log.warn("Sumsub testConnection: erreur transport ({})", e.getMessage());
            return false;
        }
    }

    private static String base(String serverUrl) {
        String url = serverUrl.trim();
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}
