package com.clenzy.integration.compliance.submission.chekin;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.Map;

/**
 * Client bas niveau de l'API publique Chekin v1.
 *
 * <p>Sans état et sans config injectée (mirror de {@code BrevoApiClient}) : toutes
 * les méthodes prennent l'URL de base + la clé API en paramètres, ce qui permet de
 * tester une clé avant persistance et évite tout couplage à la résolution de config.</p>
 *
 * <h2>Faits d'API « grounded » (documentation publique Chekin)</h2>
 * <ul>
 *   <li>API REST, HTTPS only, version v1. Base prod : {@code https://a.chekin.io/public/api/v1}
 *       ; staging : {@code https://api-ng.chekintest.xyz/public/api/v1}. <b>Ici l'URL de base
 *       vient de la connexion ({@code serverUrl}) → configurable, jamais devinée en dur.</b></li>
 *   <li>Authentification : la clé API est <b>échangée</b> contre un JWT temporaire (~1h),
 *       puis les requêtes portent l'en-tête {@code Authorization: JWT &lt;token&gt;}
 *       (et non {@code Bearer}).</li>
 *   <li>Ressources : Reservations, Housing, Rooms, Police, Stats — endpoints
 *       {@code POST /reservations} et {@code POST /guests}.</li>
 * </ul>
 *
 * <h2>Incertitudes (NON devinées en dur)</h2>
 * <p>Le chemin exact de l'endpoint d'échange de token et les <b>noms de champs</b> du
 * payload guest ne sont pas publiés de façon fiable sur la doc publique. Ils sont donc
 * <b>paramétrables</b> ({@link #DEFAULT_TOKEN_PATH}, {@link #DEFAULT_GUEST_PATH}) et la
 * construction du payload est isolée dans {@code ChekinComplianceSubmissionStrategy} pour
 * pouvoir être ajustée sans toucher au transport. Tout non-2xx est <b>propagé</b>
 * (jamais avalé) — l'appelant le matérialise en échec explicite.</p>
 */
@Component
public class ChekinApiClient {

    private static final Logger log = LoggerFactory.getLogger(ChekinApiClient.class);

    /** Base prod publique Chekin (repli si la connexion ne porte pas de serverUrl). */
    public static final String DEFAULT_BASE_URL = "https://a.chekin.io/public/api/v1";

    /** Chemin d'échange clé API → JWT. Configurable côté stratégie si l'API évolue. */
    public static final String DEFAULT_TOKEN_PATH = "/auth/token";

    /** Chemin de création d'un guest (déclaration voyageur). */
    public static final String DEFAULT_GUEST_PATH = "/guests";

    private final RestClient restClient = RestClient.create();

    /**
     * Échange la clé API contre un token JWT temporaire.
     *
     * @param baseUrl   base de l'API (serverUrl de la connexion, ou défaut)
     * @param tokenPath chemin de l'endpoint d'échange
     * @param apiKey    clé API déchiffrée
     * @return le token JWT
     * @throws org.springframework.web.client.RestClientException si l'échange échoue (clé invalide…)
     * @throws IllegalStateException                              si la réponse ne contient pas de token
     */
    @SuppressWarnings("unchecked")
    public String exchangeApiKeyForToken(String baseUrl, String tokenPath, String apiKey) {
        Map<String, Object> resp = restClient.post()
                .uri(base(baseUrl) + tokenPath)
                .header("accept", "application/json")
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("api_key", apiKey))
                .retrieve()
                .body(Map.class);

        if (resp == null) {
            throw new IllegalStateException("Réponse d'authentification Chekin vide");
        }
        Object token = resp.get("token");
        if (token == null) {
            token = resp.get("access_token");
        }
        if (!(token instanceof String s) || s.isBlank()) {
            throw new IllegalStateException("Token JWT absent de la réponse d'authentification Chekin");
        }
        return s;
    }

    /**
     * Crée un guest (déclaration voyageur) chez Chekin.
     *
     * @param baseUrl   base de l'API
     * @param guestPath chemin de création de guest
     * @param token     JWT obtenu via {@link #exchangeApiKeyForToken}
     * @param payload   corps de la requête (construit par la stratégie)
     * @return l'identifiant guest retourné par Chekin (peut être null si l'API ne le renvoie pas)
     * @throws org.springframework.web.client.RestClientException si l'appel échoue (4xx/5xx propagés)
     */
    @SuppressWarnings("unchecked")
    public String createGuest(String baseUrl, String guestPath, String token, Map<String, Object> payload) {
        Map<String, Object> resp = restClient.post()
                .uri(base(baseUrl) + guestPath)
                .header("Authorization", "JWT " + token)
                .header("accept", "application/json")
                .contentType(MediaType.APPLICATION_JSON)
                .body(payload)
                .retrieve()
                .body(Map.class);

        if (resp == null) {
            log.warn("Chekin createGuest: réponse vide (guest probablement créé sans corps de réponse)");
            return null;
        }
        Object id = resp.get("id");
        return id != null ? String.valueOf(id) : null;
    }

    /** Normalise la base d'URL (retire le slash final). */
    private static String base(String baseUrl) {
        String url = (baseUrl == null || baseUrl.isBlank()) ? DEFAULT_BASE_URL : baseUrl.trim();
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}
