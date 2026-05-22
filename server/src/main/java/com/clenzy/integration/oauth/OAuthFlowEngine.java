package com.clenzy.integration.oauth;

import com.clenzy.service.TokenEncryptionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;

/**
 * Moteur OAuth2 generique — UNIQUE source de verite pour le flow OAuth dans
 * Clenzy. Utilise par {@code PennylaneOAuthService}, {@code DocuSignOAuthService}
 * et tout futur provider OAuth.
 *
 * <h2>Responsabilites (SRP)</h2>
 * <ul>
 *   <li>Construire l'URL d'autorisation avec un state CSRF</li>
 *   <li>Echanger un code contre des tokens (grant_type=authorization_code)</li>
 *   <li>Rafraichir un access token expire (grant_type=refresh_token)</li>
 *   <li>Revoquer un token (best effort, supprime cote local meme si l'API echoue)</li>
 *   <li>Resoudre un access token valide a la demande (auto-refresh si proche d'expiration)</li>
 * </ul>
 *
 * <h2>Ce que le moteur NE FAIT PAS</h2>
 * <ul>
 *   <li>Stockage : delegue a {@link OAuthConnectionPersistence}</li>
 *   <li>Chiffrement : delegue a {@link TokenEncryptionService}</li>
 *   <li>State CSRF : delegue a {@link OAuthStateService}</li>
 *   <li>Logique metier (sync invoices, create envelope) : reste dans les services provider</li>
 * </ul>
 *
 * <h2>Pourquoi un seul service pour tous les providers</h2>
 * Le flow OAuth2 (RFC 6749) est standardise. Sans cette mutualisation, chaque
 * nouveau provider duplique ~150 lignes (build URL, exchange, refresh, revoke,
 * gestion de la date d'expiration, etc.). Avec ce moteur, ajouter un provider
 * OAuth = creer une {@link OAuthProviderConfig} + une {@link OAuthConnectionPersistence}.
 *
 * <h2>SOLID</h2>
 * <ul>
 *   <li>S — Une raison de changer : faire evoluer la mecanique OAuth.</li>
 *   <li>O — Ferme a la modification, ouvert a l'extension : un nouveau provider
 *       n'oblige pas a modifier cette classe.</li>
 *   <li>L — Toutes les entites OAuthConnectionLike sont substituables.</li>
 *   <li>I — Interfaces minimales (Config, Persistence, ConnectionLike).</li>
 *   <li>D — Depend uniquement d'abstractions, pas d'entites concretes.</li>
 * </ul>
 */
@Service
public class OAuthFlowEngine {

    private static final Logger log = LoggerFactory.getLogger(OAuthFlowEngine.class);
    private static final long DEFAULT_EXPIRES_IN_SECONDS = 86400L; // 24h

    private final OAuthStateService stateService;
    private final TokenEncryptionService encryptionService;
    private final RestTemplate restTemplate;

    public OAuthFlowEngine(OAuthStateService stateService,
                          TokenEncryptionService encryptionService) {
        this.stateService = stateService;
        this.encryptionService = encryptionService;
        this.restTemplate = new RestTemplate();
    }

    // ─── 1. Authorization URL ────────────────────────────────────────────────

    /**
     * Construit l'URL d'autorisation OAuth a laquelle rediriger l'utilisateur.
     * Genere un state CSRF lie au couple (userId, orgId) — single-use, TTL 10 min.
     */
    public String buildAuthorizationUrl(OAuthProviderConfig config, Long userId, Long orgId) {
        String state = stateService.generate(config.getProviderKey(), userId, orgId);

        return config.getAuthorizationUrl()
            + "?client_id=" + urlEncode(config.getClientId())
            + "&redirect_uri=" + urlEncode(config.getRedirectUri())
            + "&response_type=code"
            + "&scope=" + urlEncode(config.getScopes())
            + "&state=" + state;
    }

    // ─── 2. Code exchange ────────────────────────────────────────────────────

    /**
     * Echange un code d'autorisation contre des tokens, et persiste la
     * connexion via la strategie fournie.
     *
     * <p>Si la connexion existe deja (re-connexion), on met a jour la meme
     * row. Sinon on cree une nouvelle entite via {@link OAuthConnectionPersistence#newConnection()}.</p>
     */
    public <C extends OAuthConnectionLike> C exchangeCodeForToken(
            OAuthProviderConfig config,
            OAuthConnectionPersistence<C> persistence,
            String code,
            Long userId,
            Long orgId
    ) {
        log.info("OAuth — echange code, provider={} org={}", config.getProviderKey(), orgId);

        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("code", code);
        body.add("redirect_uri", config.getRedirectUri());
        body.add("grant_type", "authorization_code");
        addClientCredentials(body, config);

        OAuthTokenResponse tokens = postForToken(config, body);

        C connection = persistence.findByOrganizationId(orgId).orElseGet(persistence::newConnection);
        Instant now = Instant.now();
        long expiresInSeconds = tokens.expiresIn() != null ? tokens.expiresIn() : DEFAULT_EXPIRES_IN_SECONDS;

        connection.setOrganizationId(orgId);
        connection.setUserId(userId);
        connection.setAccessTokenEncrypted(encryptionService.encrypt(tokens.accessToken()));
        if (tokens.refreshToken() != null) {
            connection.setRefreshTokenEncrypted(encryptionService.encrypt(tokens.refreshToken()));
            connection.setRefreshTokenExpiresAt(now.plus(Duration.ofDays(config.getRefreshTokenValidityDays())));
        }
        connection.setTokenExpiresAt(now.plusSeconds(expiresInSeconds));
        connection.setScopes(tokens.scope() != null ? tokens.scope() : config.getScopes());
        connection.setOAuthStatus(OAuthConnectionStatus.ACTIVE);
        connection.setErrorMessage(null);
        if (connection.getConnectedAt() == null) {
            connection.setConnectedAt(now);
        }

        C saved = persistence.save(connection);
        log.info("OAuth — connexion etablie, provider={} org={}", config.getProviderKey(), orgId);
        return saved;
    }

    // ─── 3. Refresh ──────────────────────────────────────────────────────────

    /**
     * Rafraichit l'access token via le refresh token. Met a jour la row en place.
     *
     * <p>Important : certains providers (Pennylane) emettent un nouveau refresh
     * token a chaque refresh (single-use). On accepte les deux comportements :
     * si le provider renvoie un nouveau refresh, on l'enregistre, sinon on
     * garde l'ancien.</p>
     */
    public <C extends OAuthConnectionLike> C refreshToken(
            OAuthProviderConfig config,
            OAuthConnectionPersistence<C> persistence,
            Long orgId
    ) {
        C connection = persistence.findActiveByOrganizationId(orgId)
            .orElseThrow(() -> new IllegalStateException(
                "Pas de connexion OAuth active — provider=" + config.getProviderKey() + " org=" + orgId));

        String refreshToken = encryptionService.decrypt(connection.getRefreshTokenEncrypted());

        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("refresh_token", refreshToken);
        body.add("grant_type", "refresh_token");
        addClientCredentials(body, config);

        try {
            OAuthTokenResponse tokens = postForToken(config, body);
            Instant now = Instant.now();
            long expiresInSeconds = tokens.expiresIn() != null ? tokens.expiresIn() : DEFAULT_EXPIRES_IN_SECONDS;

            connection.setAccessTokenEncrypted(encryptionService.encrypt(tokens.accessToken()));
            if (tokens.refreshToken() != null) {
                connection.setRefreshTokenEncrypted(encryptionService.encrypt(tokens.refreshToken()));
                connection.setRefreshTokenExpiresAt(now.plus(Duration.ofDays(config.getRefreshTokenValidityDays())));
            }
            connection.setTokenExpiresAt(now.plusSeconds(expiresInSeconds));
            connection.setOAuthStatus(OAuthConnectionStatus.ACTIVE);
            connection.setErrorMessage(null);

            log.info("OAuth — token rafraichi, provider={} org={}", config.getProviderKey(), orgId);
            return persistence.save(connection);
        } catch (Exception e) {
            connection.setOAuthStatus(OAuthConnectionStatus.ERROR);
            connection.setErrorMessage("Refresh failed: " + e.getMessage());
            persistence.save(connection);
            throw e;
        }
    }

    // ─── 4. Revoke ───────────────────────────────────────────────────────────

    /**
     * Revoque le token cote provider (best effort) et marque la connexion comme
     * REVOKED en local. Les tokens chiffres sont vides pour eviter d'exposer
     * un token revoque en cas de fuite DB future.
     */
    public <C extends OAuthConnectionLike> void revokeToken(
            OAuthProviderConfig config,
            OAuthConnectionPersistence<C> persistence,
            Long orgId
    ) {
        C connection = persistence.findByOrganizationId(orgId)
            .orElseThrow(() -> new IllegalStateException(
                "Pas de connexion OAuth — provider=" + config.getProviderKey() + " org=" + orgId));

        String revokeUrl = config.getRevokeUrl();
        if (revokeUrl != null && !revokeUrl.isBlank()
                && connection.getAccessTokenEncrypted() != null) {
            try {
                String accessToken = encryptionService.decrypt(connection.getAccessTokenEncrypted());

                MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
                body.add("token", accessToken);
                addClientCredentials(body, config);

                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
                applyBasicAuthIfNeeded(headers, config);

                restTemplate.exchange(revokeUrl, HttpMethod.POST,
                    new HttpEntity<>(body, headers), Void.class);
                log.info("OAuth — token revoque cote provider={} org={}", config.getProviderKey(), orgId);
            } catch (Exception e) {
                log.warn("OAuth — revocation provider={} org={} echouee (non bloquant): {}",
                    config.getProviderKey(), orgId, e.getMessage());
            }
        }

        connection.setOAuthStatus(OAuthConnectionStatus.REVOKED);
        connection.setAccessTokenEncrypted(null);
        connection.setRefreshTokenEncrypted(null);
        persistence.save(connection);
    }

    // ─── 5. Valid access token resolver ──────────────────────────────────────

    /**
     * Retourne un access token en clair, en rafraichissant automatiquement
     * s'il expire dans moins de 5 minutes. Utilise par les API clients
     * provider-specific (PennylaneAccountingClient, DocuSignApiClient, ...).
     */
    public <C extends OAuthConnectionLike> String getValidAccessToken(
            OAuthProviderConfig config,
            OAuthConnectionPersistence<C> persistence,
            Long orgId
    ) {
        C connection = persistence.findActiveByOrganizationId(orgId)
            .orElseThrow(() -> new IllegalStateException(
                "Pas de connexion OAuth active — provider=" + config.getProviderKey() + " org=" + orgId));

        if (connection.isTokenExpiringSoon()) {
            log.debug("OAuth — token proche expiration, refresh — provider={} org={}",
                config.getProviderKey(), orgId);
            connection = refreshToken(config, persistence, orgId);
        }

        return encryptionService.decrypt(connection.getAccessTokenEncrypted());
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private OAuthTokenResponse postForToken(OAuthProviderConfig config,
                                             MultiValueMap<String, String> body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        applyBasicAuthIfNeeded(headers, config);

        @SuppressWarnings("unchecked")
        Map<String, Object> response = restTemplate.exchange(
            config.getTokenUrl(),
            HttpMethod.POST,
            new HttpEntity<>(body, headers),
            Map.class
        ).getBody();

        if (response == null || response.get("access_token") == null) {
            throw new IllegalStateException("OAuth — reponse token vide ou sans access_token");
        }

        return new OAuthTokenResponse(
            (String) response.get("access_token"),
            (String) response.get("refresh_token"),
            response.get("expires_in") instanceof Number n ? n.longValue() : null,
            (String) response.get("token_type"),
            (String) response.get("scope")
        );
    }

    private void addClientCredentials(MultiValueMap<String, String> body, OAuthProviderConfig config) {
        if (!config.useHttpBasicAuth()) {
            body.add("client_id", config.getClientId());
            body.add("client_secret", config.getClientSecret());
        }
    }

    private void applyBasicAuthIfNeeded(HttpHeaders headers, OAuthProviderConfig config) {
        if (config.useHttpBasicAuth()) {
            String creds = config.getClientId() + ":" + config.getClientSecret();
            String encoded = Base64.getEncoder().encodeToString(creds.getBytes(StandardCharsets.UTF_8));
            headers.set(HttpHeaders.AUTHORIZATION, "Basic " + encoded);
        }
    }

    private static String urlEncode(String value) {
        return value == null ? "" : URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
