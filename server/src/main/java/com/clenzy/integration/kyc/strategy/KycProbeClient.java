package com.clenzy.integration.kyc.strategy;

import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.Map;

/**
 * Client HTTP minimal pour les probes de credentials KYC.
 *
 * <p>Sans état et sans config injectée (mirror de {@code ChekinApiClient}) : URL et
 * en-têtes sont fournis par la stratégie appelante. Retourne le <b>statut HTTP</b>
 * de la réponse — y compris les 4xx (jamais levés en exception), car c'est le code
 * lui-même qui porte le verdict du test (401 = credentials refusées, 404 = auth
 * acceptée sur une ressource-probe inconnue, etc.).</p>
 *
 * <p>Seules les erreurs de transport (DNS, timeout, TLS) se propagent en
 * {@link org.springframework.web.client.RestClientException} — l'appelant les
 * matérialise en échec explicite.</p>
 */
@Component
public class KycProbeClient {

    private final RestClient restClient = RestClient.create();

    /**
     * Exécute une requête sans corps et retourne le statut HTTP de la réponse.
     *
     * @param method  méthode HTTP
     * @param url     URL absolue
     * @param headers en-têtes (auth incluse)
     * @return le code HTTP (2xx à 5xx)
     */
    public int probe(HttpMethod method, String url, Map<String, String> headers) {
        try {
            ResponseEntity<Void> response = restClient.method(method)
                    .uri(url)
                    .headers(h -> headers.forEach(h::set))
                    .retrieve()
                    .toBodilessEntity();
            return response.getStatusCode().value();
        } catch (RestClientResponseException e) {
            return e.getStatusCode().value();
        }
    }
}
