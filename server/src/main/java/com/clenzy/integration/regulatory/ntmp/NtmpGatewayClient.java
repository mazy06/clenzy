package com.clenzy.integration.regulatory.ntmp;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Appels bruts a la passerelle du ministere du Tourisme saoudien.
 *
 * <p>Ne connait ni la base, ni le chiffrement, ni le cache : il recoit des
 * valeurs deja resolues et rend ce que la passerelle repond. Le raccordement
 * (chargement de la connexion, dechiffrement du secret, mise en cache du jeton)
 * vit dans {@link NtmpConnectionService}.</p>
 *
 * <p><b>Journalisation</b> : chaque reponse porte un {@code X-Request-Id}
 * IRRECUPERABLE apres coup, et c'est le seul champ qui permet au support du
 * ministere de retrouver notre appel. Il est donc trace a chaque fois, succes
 * compris.</p>
 *
 * <p><b>Non verifie</b> : le nom des champs de la REPONSE d'echange
 * ({@code access_token} / {@code expires_in}) est deduit de la documentation
 * publique, qui ne montre que le corps de la REQUETE. Les deux graphies usuelles
 * sont acceptees, et un corps inattendu echoue explicitement plutot que de
 * rendre un jeton vide. A confirmer des le premier appel reel.</p>
 */
@Component
public class NtmpGatewayClient {

    private static final Logger log = LoggerFactory.getLogger(NtmpGatewayClient.class);

    static final String TOKEN_PATH = "/api/facility-portal/developer/booking/token";

    private final RestClient restClient = RestClient.create();

    /**
     * Echange les identifiants contre un jeton de scope {@code BookingService}.
     *
     * @param externalLicenseId licence visee ; requis avec un identifiant
     *                          d'AGENCE, qui couvre toute l'organisation et ne
     *                          designe donc aucun etablissement a lui seul
     */
    public NtmpAccessToken exchangeToken(String gatewayUrl,
                                         String facilityId,
                                         String facilitySecret,
                                         String externalLicenseId) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("facilityId", facilityId);
        body.put("facilitySecret", facilitySecret);
        if (externalLicenseId != null && !externalLicenseId.isBlank()) {
            body.put("externalLicenseId", externalLicenseId);
        }

        Instant sentAt = Instant.now();
        var response = restClient.post()
                .uri(root(gatewayUrl) + TOKEN_PATH)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .exchange((request, clientResponse) -> {
                    traceRequestId(clientResponse.getHeaders(), TOKEN_PATH);
                    if (clientResponse.getStatusCode().value() == 429) {
                        throw rateLimited(clientResponse.getHeaders(), TOKEN_PATH);
                    }
                    if (clientResponse.getStatusCode().isError()) {
                        throw new IllegalStateException(
                                "Echange de jeton NTMP refuse : " + clientResponse.getStatusCode());
                    }
                    return clientResponse.bodyTo(Map.class);
                });

        return toToken(response, sentAt);
    }

    /** Racine sans slash final : la passerelle refuse le double slash. */
    private String root(String gatewayUrl) {
        String trimmed = gatewayUrl == null ? "" : gatewayUrl.trim();
        return trimmed.endsWith("/") ? trimmed.substring(0, trimmed.length() - 1) : trimmed;
    }

    @SuppressWarnings("rawtypes")
    private NtmpAccessToken toToken(Map response, Instant sentAt) {
        if (response == null) {
            throw new IllegalStateException("Echange de jeton NTMP : reponse vide");
        }
        Object token = firstOf(response, "access_token", "accessToken");
        Object ttl = firstOf(response, "expires_in", "expiresIn");
        if (!(token instanceof String value) || value.isBlank()) {
            throw new IllegalStateException(
                    "Echange de jeton NTMP : aucun jeton dans la reponse (champs " + response.keySet() + ")");
        }
        // Sans duree annoncee, on ne garde le jeton que le temps de l'appel en
        // cours : mieux vaut un echange de trop qu'un jeton servi apres coup.
        long seconds = ttl instanceof Number number ? number.longValue() : 0L;
        return new NtmpAccessToken(value, sentAt.plusSeconds(seconds));
    }

    @SuppressWarnings("rawtypes")
    private Object firstOf(Map response, String... keys) {
        for (String key : keys) {
            Object value = response.get(key);
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    private void traceRequestId(HttpHeaders headers, String path) {
        String requestId = headers.getFirst("X-Request-Id");
        if (requestId != null) {
            log.info("NTMP {} — X-Request-Id={}", path, requestId);
        } else {
            log.warn("NTMP {} — aucun X-Request-Id dans la reponse", path);
        }
    }

    private NtmpRateLimitedException rateLimited(HttpHeaders headers, String path) {
        String retryAfter = headers.getFirst("Retry-After");
        Duration delay = null;
        if (retryAfter != null) {
            try {
                delay = Duration.ofSeconds(Long.parseLong(retryAfter.trim()));
            } catch (NumberFormatException ignored) {
                // `Retry-After` peut etre une DATE HTTP. On ne la parse pas : sans
                // delai exploitable, l'appelant appliquera son propre recul.
                log.warn("NTMP {} — Retry-After non numerique : {}", path, retryAfter);
            }
        }
        return new NtmpRateLimitedException("Quota NTMP atteint sur " + path, delay);
    }
}
