package com.clenzy.integration.cloudflare;

import com.clenzy.booking.model.SiteDomainStatus;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.Map;
import java.util.Optional;

/**
 * Bridge Cloudflare for SaaS (P1.1 d) — Custom Hostnames API. Provisionne / réconcilie / supprime
 * un domaine custom de site (`reservation.monhotel.com`) : Cloudflare émet le TLS et route vers le
 * fallback origin. Effet externe HORS transaction (audit #2) ; la machine à états du domaine
 * (`SiteDomainStatus`) est mise à jour par l'appelant après l'appel.
 *
 * <p><b>Gated</b> : sans {@code cloudflare.api-token} / {@code cloudflare.zone-id}, {@link #isEnabled()}
 * renvoie {@code false} et la feature est inerte (les sous-domaines `*.clenzy.site` marchent via le
 * wildcard ; seuls les domaines custom nécessitent ce bridge). Pas de secret en dur (audit #12).</p>
 */
@Component
public class CloudflareCustomHostnameService {

    private static final Logger log = LoggerFactory.getLogger(CloudflareCustomHostnameService.class);

    private final RestTemplate restTemplate;
    private final String apiBaseUrl;
    private final String apiToken;
    private final String zoneId;

    public CloudflareCustomHostnameService(
            @Value("${cloudflare.api-base-url:https://api.cloudflare.com/client/v4}") String apiBaseUrl,
            @Value("${cloudflare.api-token:}") String apiToken,
            @Value("${cloudflare.zone-id:}") String zoneId,
            RestTemplate cloudflareRestTemplate) {
        this.apiBaseUrl = apiBaseUrl;
        this.apiToken = apiToken;
        this.zoneId = zoneId;
        this.restTemplate = cloudflareRestTemplate;
    }

    /** Vrai si la feature domaines custom est configurée (token + zone). */
    public boolean isEnabled() {
        return apiToken != null && !apiToken.isBlank() && zoneId != null && !zoneId.isBlank();
    }

    public record HostnameResult(String hostnameId, SiteDomainStatus status) {}

    /** Crée un custom hostname Cloudflare (validation DV via HTTP). Renvoie l'id + statut, ou vide si échec. */
    public Optional<HostnameResult> createCustomHostname(String hostname) {
        if (!isEnabled()) {
            return Optional.empty();
        }
        Map<String, Object> body = Map.of(
            "hostname", hostname,
            "ssl", Map.of("method", "http", "type", "dv", "settings", Map.of("min_tls_version", "1.2"))
        );
        try {
            ResponseEntity<JsonNode> res = restTemplate.exchange(
                apiBaseUrl + "/zones/" + zoneId + "/custom_hostnames",
                HttpMethod.POST, new HttpEntity<>(body, authHeaders()), JsonNode.class);
            JsonNode result = res.getBody() != null ? res.getBody().path("result") : null;
            if (result == null || result.isMissingNode() || result.path("id").asText("").isBlank()) {
                log.error("Cloudflare: création custom hostname {} sans id en réponse", hostname);
                return Optional.empty();
            }
            return Optional.of(new HostnameResult(result.path("id").asText(), mapStatus(result)));
        } catch (Exception e) {
            log.error("Cloudflare: échec création custom hostname {} : {}", hostname, e.getMessage());
            return Optional.empty();
        }
    }

    /** Lit le statut courant d'un custom hostname (réconciliation scheduler). */
    public Optional<SiteDomainStatus> getStatus(String hostnameId) {
        if (!isEnabled() || hostnameId == null || hostnameId.isBlank()) {
            return Optional.empty();
        }
        try {
            ResponseEntity<JsonNode> res = restTemplate.exchange(
                apiBaseUrl + "/zones/" + zoneId + "/custom_hostnames/" + hostnameId,
                HttpMethod.GET, new HttpEntity<>(authHeaders()), JsonNode.class);
            JsonNode result = res.getBody() != null ? res.getBody().path("result") : null;
            if (result == null || result.isMissingNode()) {
                return Optional.empty();
            }
            return Optional.of(mapStatus(result));
        } catch (Exception e) {
            log.warn("Cloudflare: échec lecture statut hostname {} : {}", hostnameId, e.getMessage());
            return Optional.empty();
        }
    }

    /** Supprime un custom hostname (suppression de domaine). Best-effort. */
    public void deleteCustomHostname(String hostnameId) {
        if (!isEnabled() || hostnameId == null || hostnameId.isBlank()) {
            return;
        }
        try {
            restTemplate.exchange(
                apiBaseUrl + "/zones/" + zoneId + "/custom_hostnames/" + hostnameId,
                HttpMethod.DELETE, new HttpEntity<>(authHeaders()), JsonNode.class);
        } catch (Exception e) {
            log.warn("Cloudflare: échec suppression hostname {} : {}", hostnameId, e.getMessage());
        }
    }

    /** ssl.status == active → ACTIVE ; *_error / *_timed_out → FAILED ; sinon PENDING. */
    private SiteDomainStatus mapStatus(JsonNode result) {
        String sslStatus = result.path("ssl").path("status").asText("");
        if ("active".equalsIgnoreCase(sslStatus)) {
            return SiteDomainStatus.ACTIVE;
        }
        if (sslStatus.contains("error") || sslStatus.contains("timed_out")) {
            return SiteDomainStatus.FAILED;
        }
        return SiteDomainStatus.PENDING;
    }

    private HttpHeaders authHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(apiToken);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }
}
