package com.clenzy.integration.external.strategy;

import com.clenzy.service.ICalUrlValidator;
import com.clenzy.service.signature.SignatureProviderType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.Map;

/**
 * Strategie de test de connexion Odoo.
 *
 * Appelle l'endpoint JSON-RPC standard {@code /web/session/authenticate} :
 *   - URL serveur + path
 *   - accountIdentifier au format "dbName|userLogin" (separe par |)
 *   - apiKey = password Odoo (API key generee dans Preferences > Securite)
 *
 * Reponse OK : {@code { result: { uid: <int>, ... } }} avec uid non-null/false.
 * Reponse KO : {@code { result: { uid: false } }} ou error.
 */
@Service
public class OdooConnectionTestStrategy implements ConnectionTestStrategy {

    private static final Logger log = LoggerFactory.getLogger(OdooConnectionTestStrategy.class);

    private final RestClient restClient = RestClient.builder().build();

    @Override
    public SignatureProviderType providerType() {
        return SignatureProviderType.ODOO;
    }

    @Override
    public boolean testConnection(String serverUrl, String accountIdentifier, String apiKey) {
        if (serverUrl == null || accountIdentifier == null || apiKey == null) {
            return false;
        }

        // accountIdentifier format Odoo : "dbName|userLogin"
        String[] parts = accountIdentifier.split("\\|", 2);
        if (parts.length != 2) {
            log.warn("Odoo testConnection: accountIdentifier must be 'dbName|userLogin', got: {}",
                    accountIdentifier);
            return false;
        }
        String dbName = parts[0];
        String userLogin = parts[1];

        // I1-OTA-02 : serverUrl est fourni par l'utilisateur → risque SSRF (le serveur
        // ferait une requete vers une URL arbitraire, ex. metadata cloud ou service
        // interne RFC1918). Valider AVANT tout appel via le validateur SSRF partage :
        // HTTPS uniquement, refus loopback/link-local/RFC1918/metadata cloud,
        // resolution DNS effectuee. Une URL non conforme refuse la connexion.
        try {
            ICalUrlValidator.validateAndResolve(serverUrl);
        } catch (IllegalArgumentException e) {
            log.warn("Odoo testConnection: serverUrl refuse (SSRF) {} → {}", serverUrl, e.getMessage());
            return false;
        }

        String url = serverUrl.endsWith("/") ? serverUrl + "web/session/authenticate"
                : serverUrl + "/web/session/authenticate";

        Map<String, Object> body = Map.of(
                "jsonrpc", "2.0",
                "params", Map.of("db", dbName, "login", userLogin, "password", apiKey)
        );

        try {
            @SuppressWarnings("rawtypes")
            Map response = restClient.post()
                    .uri(url)
                    .headers(h -> h.setContentType(MediaType.APPLICATION_JSON))
                    .body(body)
                    .retrieve()
                    .body(Map.class);

            if (response == null) return false;
            Object result = response.get("result");
            if (!(result instanceof Map<?, ?> resultMap)) return false;
            Object uid = resultMap.get("uid");
            boolean ok = uid != null && !Boolean.FALSE.equals(uid);
            log.info("Odoo testConnection {} → {}", serverUrl, ok ? "OK" : "FAIL");
            return ok;
        } catch (Exception e) {
            log.warn("Odoo testConnection failed for {}: {}", serverUrl, e.getMessage());
            return false;
        }
    }
}
