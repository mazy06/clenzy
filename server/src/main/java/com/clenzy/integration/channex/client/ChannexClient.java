package com.clenzy.integration.channex.client;

import com.clenzy.integration.channex.config.ChannexMetrics;
import com.clenzy.integration.channex.config.ChannexProperties;
import com.clenzy.integration.channex.dto.ChannexAvailabilityUpdate;
import com.clenzy.integration.channex.dto.ChannexCreatePropertyRequest;
import com.clenzy.integration.channex.dto.ChannexPropertyDto;
import com.clenzy.integration.channex.dto.ChannexRateUpdate;
import com.clenzy.integration.channex.exception.ChannexException;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Client HTTP REST pour l'API Channex (v1).
 *
 * <p><b>Auth :</b> Bearer token (API key) dans le header {@code Authorization}.</p>
 *
 * <p><b>Retry :</b> {@link ChannexProperties#getMaxRetries()} tentatives en
 * backoff exponentiel (200ms, 400ms, 800ms) sur les erreurs retryables
 * (rate limit 429, 5xx, timeout). Les 4xx (sauf 429) ne sont pas retries.</p>
 *
 * <p><b>Limites Channex (selon docs.channex.io) :</b></p>
 * <ul>
 *   <li>Rate limit : 100 req/min par API key</li>
 *   <li>Batch availability : max 500 updates par appel</li>
 *   <li>Batch rates : max 500 updates par appel</li>
 * </ul>
 *
 * <p>Tous les payloads sont au format JSON:API (wrapper {@code data}). Le
 * client gere la transformation.</p>
 */
@Component
public class ChannexClient {

    private static final Logger log = LoggerFactory.getLogger(ChannexClient.class);

    private final RestTemplate restTemplate;
    private final ChannexProperties props;
    private final ChannexMetrics metrics;

    public ChannexClient(@Qualifier("channexRestTemplate") RestTemplate restTemplate,
                          ChannexProperties props,
                          ChannexMetrics metrics) {
        this.restTemplate = restTemplate;
        this.props = props;
        this.metrics = metrics;
    }

    // ─── Properties ─────────────────────────────────────────────────────────

    /**
     * Cree une nouvelle property cote Channex et retourne ses identifiants.
     * Doit etre suivi de la creation d'un room_type et d'un rate_plan.
     */
    public ChannexPropertyDto createProperty(ChannexCreatePropertyRequest req) {
        String url = props.getBaseUrl() + "/properties";
        ChannexPropertyDto created = exchange(HttpMethod.POST, url, req.toApiPayload(), ChannexPropertyDto.class);
        log.info("Channex: property created id={} title={}", created.id(), created.title());
        return created;
    }

    /** Recupere une property Channex par ID. */
    public ChannexPropertyDto getProperty(String channexPropertyId) {
        String url = props.getBaseUrl() + "/properties/" + channexPropertyId;
        return exchange(HttpMethod.GET, url, null, ChannexPropertyDto.class);
    }

    /** Supprime une property Channex (utilise quand un mapping est supprime cote Clenzy). */
    public void deleteProperty(String channexPropertyId) {
        String url = props.getBaseUrl() + "/properties/" + channexPropertyId;
        exchange(HttpMethod.DELETE, url, null, Void.class);
        log.info("Channex: property deleted id={}", channexPropertyId);
    }

    // ─── Availability ───────────────────────────────────────────────────────

    /**
     * Push d'un batch d'updates de disponibilite vers Channex.
     * Split automatique en chunks de 500 si la liste depasse la limite.
     */
    public void pushAvailability(List<ChannexAvailabilityUpdate> updates) {
        if (updates == null || updates.isEmpty()) return;

        for (List<ChannexAvailabilityUpdate> chunk : chunked(updates, 500)) {
            String url = props.getBaseUrl() + "/availability";
            Map<String, Object> body = Map.of(
                "values", chunk.stream().map(u -> Map.<String, Object>of(
                    "property_id", u.channexPropertyId(),
                    "room_type_id", u.channexRoomTypeId(),
                    "date", u.date().toString(),
                    "availability", u.availability()
                )).toList()
            );
            exchange(HttpMethod.POST, url, body, Map.class);
        }
        log.info("Channex: pushed {} availability updates", updates.size());
    }

    // ─── Rates ──────────────────────────────────────────────────────────────

    /**
     * Push d'un batch d'updates de tarifs vers Channex.
     * Inclut optionnellement les restrictions (min stay, closed-to-arrival/departure).
     */
    public void pushRates(List<ChannexRateUpdate> updates) {
        if (updates == null || updates.isEmpty()) return;

        for (List<ChannexRateUpdate> chunk : chunked(updates, 500)) {
            String url = props.getBaseUrl() + "/restrictions";
            Map<String, Object> body = Map.of(
                "values", chunk.stream().map(u -> {
                    Map<String, Object> entry = new LinkedHashMap<>();
                    entry.put("property_id", u.channexPropertyId());
                    entry.put("rate_plan_id", u.channexRatePlanId());
                    entry.put("date", u.date().toString());
                    entry.put("rate", normalize(u.rate()));
                    if (u.minStayThrough() != null) entry.put("min_stay_through", u.minStayThrough());
                    if (u.minStayArrival() != null) entry.put("min_stay_arrival", u.minStayArrival());
                    if (u.closedToArrival() != null) entry.put("closed_to_arrival", u.closedToArrival());
                    if (u.closedToDeparture() != null) entry.put("closed_to_departure", u.closedToDeparture());
                    return entry;
                }).toList()
            );
            exchange(HttpMethod.POST, url, body, Map.class);
        }
        log.info("Channex: pushed {} rate updates", updates.size());
    }

    // ─── Bookings ───────────────────────────────────────────────────────────

    /** Recupere une booking specifique (utile pour reconciliation post-webhook). */
    public JsonNode getBooking(String bookingId) {
        String url = props.getBaseUrl() + "/bookings/" + bookingId;
        return exchange(HttpMethod.GET, url, null, JsonNode.class);
    }

    // ─── HTTP helpers ───────────────────────────────────────────────────────

    /**
     * Wrapper unique pour tous les appels HTTP avec retry + mapping d'erreur.
     * Visible package-private pour les tests.
     *
     * <p>Instrumente avec ChannexMetrics : compteurs success/error/retry
     * + histogramme latence avec tag operation (deduit du path URL).</p>
     */
    <T> T exchange(HttpMethod method, String url, Object body, Class<T> responseType) {
        if (!props.isConfigured()) {
            throw new ChannexException(ChannexException.Kind.UNAUTHORIZED,
                "Channex API key not configured (clenzy.channex.api-key)");
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(props.getApiKey());
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));
        headers.set("User-Agent", "Clenzy-PMS/1.0 (channex-client)");

        HttpEntity<Object> entity = new HttpEntity<>(body, headers);
        String operation = deriveOperationTag(method, url);
        long startMs = System.currentTimeMillis();

        int attempt = 0;
        ChannexException lastError = null;
        while (attempt < Math.max(1, props.getMaxRetries())) {
            attempt++;
            try {
                ResponseEntity<T> response = restTemplate.exchange(url, method, entity, responseType);
                metrics.recordClientSuccess(operation, System.currentTimeMillis() - startMs);
                return response.getBody();
            } catch (HttpStatusCodeException e) {
                lastError = mapHttpError(e.getStatusCode(), e.getResponseBodyAsString());
                if (!lastError.isRetryable()) {
                    metrics.recordClientError(operation, lastError.getKind().name(),
                        System.currentTimeMillis() - startMs);
                    throw lastError;
                }
                metrics.recordClientRetry(operation);
                backoff(attempt);
            } catch (ResourceAccessException e) {
                lastError = new ChannexException(ChannexException.Kind.TRANSPORT,
                    "Network error calling Channex " + url + ": " + e.getMessage(), e);
                metrics.recordClientRetry(operation);
                backoff(attempt);
            }
        }
        // Retries exhausted
        metrics.recordClientError(operation,
            lastError != null ? lastError.getKind().name() : "TRANSPORT",
            System.currentTimeMillis() - startMs);
        throw lastError != null ? lastError
            : new ChannexException(ChannexException.Kind.TRANSPORT, "All retries failed for " + url);
    }

    /**
     * Derive un tag d'operation simple a partir du verbe HTTP + path.
     * Exemples : POST /properties → "create_property", POST /availability → "push_availability".
     * On garde une enumeration courte pour eviter l'explosion cardinalite Prometheus.
     */
    private static String deriveOperationTag(HttpMethod method, String url) {
        String path = url.replaceAll("^https?://[^/]+(/[^?]*).*$", "$1").toLowerCase();
        if (path.endsWith("/properties") && method == HttpMethod.POST) return "create_property";
        if (path.contains("/properties/") && method == HttpMethod.GET) return "get_property";
        if (path.contains("/properties/") && method == HttpMethod.DELETE) return "delete_property";
        if (path.endsWith("/availability")) return "push_availability";
        if (path.endsWith("/restrictions")) return "push_rates";
        if (path.contains("/bookings/")) return "get_booking";
        return "other";
    }

    private ChannexException mapHttpError(HttpStatusCode status, String body) {
        int code = status.value();
        if (code == 401 || code == 403) {
            return new ChannexException(ChannexException.Kind.UNAUTHORIZED, code,
                "Channex auth failed: " + truncate(body));
        }
        if (code == 404) {
            return new ChannexException(ChannexException.Kind.NOT_FOUND, code,
                "Channex resource not found: " + truncate(body));
        }
        if (code == 429) {
            return new ChannexException(ChannexException.Kind.RATE_LIMITED, code,
                "Channex rate limit exceeded");
        }
        if (code >= 500) {
            return new ChannexException(ChannexException.Kind.SERVER_ERROR, code,
                "Channex server error: " + truncate(body));
        }
        return new ChannexException(ChannexException.Kind.BAD_REQUEST, code,
            "Channex bad request: " + truncate(body));
    }

    private void backoff(int attempt) {
        long delayMs = (long) (200 * Math.pow(2, attempt - 1));
        try {
            Thread.sleep(Math.min(delayMs, Duration.ofSeconds(5).toMillis()));
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new ChannexException(ChannexException.Kind.TRANSPORT, "Interrupted during retry backoff", ie);
        }
    }

    private static String truncate(String s) {
        if (s == null) return "";
        return s.length() > 200 ? s.substring(0, 200) + "..." : s;
    }

    private static String normalize(BigDecimal value) {
        // Channex attend les decimals en string pour eviter les pertes de precision.
        return value.toPlainString();
    }

    /** Split d'une liste en chunks de taille max chunkSize. */
    private static <T> List<List<T>> chunked(List<T> list, int chunkSize) {
        List<List<T>> result = new ArrayList<>();
        for (int i = 0; i < list.size(); i += chunkSize) {
            result.add(list.subList(i, Math.min(i + chunkSize, list.size())));
        }
        return result;
    }
}
