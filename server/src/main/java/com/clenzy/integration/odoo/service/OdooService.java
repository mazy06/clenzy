package com.clenzy.integration.odoo.service;

import com.clenzy.integration.odoo.model.OdooConnection;
import com.clenzy.integration.odoo.repository.OdooConnectionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;

/**
 * Service principal pour l'integration Odoo.
 *
 * <h2>Authentification</h2>
 * Odoo s'authentifie en API via :
 *   - URL serveur (ex: https://mycompany.odoo.com)
 *   - Nom de base (ex: 'mycompany')
 *   - Login utilisateur (email/identifiant Odoo)
 *   - API key (generee dans Odoo > Preferences > Securite)
 *
 * <h2>Test de connexion</h2>
 * On utilise le endpoint JSON-RPC /web/session/authenticate avec ces credentials.
 * Reponse OK → connexion valide. C'est leger et non-destructif.
 *
 * <h2>Signature electronique</h2>
 * Stub pour l'instant. Odoo a un module "Sign" (Odoo Enterprise) qui expose
 * une API pour creer/gerer les demandes de signature. A implementer quand
 * l'organisation aura activement besoin de la feature.
 */
@Service
public class OdooService {

    private static final Logger log = LoggerFactory.getLogger(OdooService.class);

    private final OdooConnectionRepository connectionRepository;
    private final OdooApiKeyEncryptionService encryptionService;
    private final RestClient restClient;

    public OdooService(OdooConnectionRepository connectionRepository,
                       OdooApiKeyEncryptionService encryptionService) {
        this.connectionRepository = connectionRepository;
        this.encryptionService = encryptionService;
        this.restClient = RestClient.builder().build();
    }

    /**
     * Teste la connexion a une instance Odoo avec les credentials fournis.
     * Appel JSON-RPC /web/session/authenticate.
     *
     * @return true si la connexion est valide, false sinon (log le detail)
     */
    public boolean testConnection(String serverUrl, String databaseName,
                                   String userLogin, String apiKey) {
        if (serverUrl == null || databaseName == null || userLogin == null || apiKey == null) {
            return false;
        }

        String normalizedUrl = serverUrl.endsWith("/")
                ? serverUrl.substring(0, serverUrl.length() - 1)
                : serverUrl;
        String endpoint = normalizedUrl + "/web/session/authenticate";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        // Format JSON-RPC standard Odoo
        Map<String, Object> body = Map.of(
                "jsonrpc", "2.0",
                "params", Map.of(
                        "db", databaseName,
                        "login", userLogin,
                        "password", apiKey
                )
        );

        try {
            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
            @SuppressWarnings("rawtypes")
            Map response = restClient.post()
                    .uri(endpoint)
                    .headers(h -> h.addAll(headers))
                    .body(body)
                    .retrieve()
                    .body(Map.class);

            if (response == null) {
                log.warn("Odoo testConnection: response is null for {}", serverUrl);
                return false;
            }

            // Odoo retourne { result: { uid: <int>, ... } } si OK, sinon { result: { ... } } avec uid=false
            Object result = response.get("result");
            if (!(result instanceof Map<?, ?> resultMap)) {
                log.warn("Odoo testConnection: unexpected response shape for {}", serverUrl);
                return false;
            }
            Object uid = resultMap.get("uid");
            boolean ok = uid != null && !Boolean.FALSE.equals(uid);
            log.info("Odoo testConnection {} → {}", serverUrl, ok ? "OK" : "FAIL");
            return ok;
        } catch (Exception e) {
            log.warn("Odoo testConnection failed for {}: {}", serverUrl, e.getMessage());
            return false;
        }
    }

    /**
     * Sauvegarde une nouvelle connexion Odoo apres test reussi.
     * Si une connexion existait deja pour l'organisation, elle est ecrasee.
     */
    @Transactional
    public OdooConnection saveConnection(Long organizationId, Long userId,
                                          String serverUrl, String databaseName,
                                          String userLogin, String apiKey) {
        OdooConnection conn = connectionRepository
                .findByOrganizationId(organizationId)
                .orElseGet(OdooConnection::new);

        conn.setOrganizationId(organizationId);
        conn.setUserId(userId);
        conn.setServerUrl(serverUrl);
        conn.setDatabaseName(databaseName);
        conn.setUserLogin(userLogin);
        conn.setApiKeyEncrypted(encryptionService.encrypt(apiKey));
        conn.setStatus(OdooConnection.Status.ACTIVE);
        conn.setErrorMessage(null);
        conn.setLastTestedAt(Instant.now());
        if (conn.getId() == null) {
            conn.setCreatedAt(Instant.now());
        }
        conn.setUpdatedAt(Instant.now());

        return connectionRepository.save(conn);
    }

    /**
     * Supprime la connexion Odoo de l'organisation (et invalide donc le
     * SignatureProvider pour cette org).
     */
    @Transactional
    public boolean disconnect(Long organizationId) {
        Optional<OdooConnection> existing = connectionRepository.findByOrganizationId(organizationId);
        if (existing.isEmpty()) {
            return false;
        }
        connectionRepository.delete(existing.get());
        log.info("Odoo connection deleted for org {}", organizationId);
        return true;
    }

    /** @return true si l'organisation a une connexion Odoo ACTIVE. */
    @Transactional(readOnly = true)
    public boolean isConnected(Long organizationId) {
        return connectionRepository.findByOrganizationId(organizationId)
                .map(c -> c.getStatus() == OdooConnection.Status.ACTIVE)
                .orElse(false);
    }

    @Transactional(readOnly = true)
    public Optional<OdooConnection> getConnection(Long organizationId) {
        return connectionRepository.findByOrganizationId(organizationId);
    }
}
