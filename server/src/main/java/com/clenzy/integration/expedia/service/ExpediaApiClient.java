package com.clenzy.integration.expedia.service;

import com.clenzy.integration.expedia.config.ExpediaConfig;
import com.clenzy.integration.expedia.dto.ExpediaAvailabilityDto;
import com.clenzy.integration.expedia.dto.ExpediaReservationDto;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

/**
 * Client HTTP pour l'API Expedia Partner Central (Rapid API).
 *
 * Authentification : API key + signature basee sur le secret.
 * L'en-tete Authorization utilise le format EAN (Expedia Affiliate Network) :
 * Authorization: EAN apikey={key},signature={sha512(key+secret+timestamp)},timestamp={ts}
 *
 * Toutes les methodes utilisent un CircuitBreaker pour proteger
 * le systeme en cas de degradation de l'API Expedia.
 */
@Service
public class ExpediaApiClient {

    private static final Logger log = LoggerFactory.getLogger(ExpediaApiClient.class);
    private static final String CIRCUIT_BREAKER_NAME = "expedia-api";

    private final ExpediaConfig config;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public ExpediaApiClient(ExpediaConfig config, ObjectMapper objectMapper) {
        this.config = config;
        this.restTemplate = new RestTemplate();
        this.objectMapper = objectMapper;
    }

    /**
     * Recupere les disponibilites pour une propriete sur une plage de dates.
     */
    @CircuitBreaker(name = CIRCUIT_BREAKER_NAME, fallbackMethod = "getAvailabilityFallback")
    public List<ExpediaAvailabilityDto> getAvailability(String propertyId,
                                                         LocalDate from, LocalDate to) {
        String url = config.getApiBaseUrl()
                + "/v3/properties/" + propertyId
                + "/availability?startDate=" + from + "&endDate=" + to;

        log.debug("GET availability Expedia: propertyId={}, [{}, {})", propertyId, from, to);

        ResponseEntity<String> response = restTemplate.exchange(
                url, HttpMethod.GET, buildAuthEntity(null), String.class);

        return parseAvailabilityResponse(response.getBody(), propertyId);
    }

    /**
     * Met a jour les disponibilites (inventaire) pour une propriete.
     */
    @CircuitBreaker(name = CIRCUIT_BREAKER_NAME, fallbackMethod = "updateAvailabilityFallback")
    public boolean updateAvailability(String propertyId,
                                       List<ExpediaAvailabilityDto> availabilities) {
        String url = config.getApiBaseUrl()
                + "/v3/properties/" + propertyId + "/availability";

        log.debug("PUT availability Expedia: propertyId={}, {} dates", propertyId, availabilities.size());

        Map<String, Object> body = buildAvailabilityUpdateBody(availabilities);
        ResponseEntity<String> response = restTemplate.exchange(
                url, HttpMethod.PUT, buildAuthEntity(body), String.class);

        boolean success = response.getStatusCode().is2xxSuccessful();
        if (!success) {
            log.warn("Echec mise a jour disponibilite Expedia: propertyId={}, status={}",
                    propertyId, response.getStatusCode());
        }
        return success;
    }

    /**
     * Met a jour les tarifs pour une propriete.
     */
    @CircuitBreaker(name = CIRCUIT_BREAKER_NAME, fallbackMethod = "updateRatesFallback")
    public boolean updateRates(String propertyId, String ratePlanId,
                                List<Map<String, Object>> rateUpdates) {
        String url = config.getApiBaseUrl()
                + "/v3/properties/" + propertyId + "/ratePlans/" + ratePlanId + "/rates";

        log.debug("PUT rates Expedia: propertyId={}, ratePlan={}, {} updates",
                propertyId, ratePlanId, rateUpdates.size());

        Map<String, Object> body = Map.of("rates", rateUpdates);
        ResponseEntity<String> response = restTemplate.exchange(
                url, HttpMethod.PUT, buildAuthEntity(body), String.class);

        boolean success = response.getStatusCode().is2xxSuccessful();
        if (!success) {
            log.warn("Echec mise a jour tarifs Expedia: propertyId={}, status={}",
                    propertyId, response.getStatusCode());
        }
        return success;
    }

    /**
     * Recupere les reservations recentes pour une propriete.
     */
    @CircuitBreaker(name = CIRCUIT_BREAKER_NAME, fallbackMethod = "getReservationsFallback")
    public List<ExpediaReservationDto> getReservations(String propertyId,
                                                        LocalDate from, LocalDate to) {
        String url = config.getApiBaseUrl()
                + "/v3/properties/" + propertyId
                + "/reservations?startDate=" + from + "&endDate=" + to;

        log.debug("GET reservations Expedia: propertyId={}, [{}, {})", propertyId, from, to);

        ResponseEntity<String> response = restTemplate.exchange(
                url, HttpMethod.GET, buildAuthEntity(null), String.class);

        return parseReservationsResponse(response.getBody());
    }

    /**
     * Confirme une reservation cote Expedia.
     */
    @CircuitBreaker(name = CIRCUIT_BREAKER_NAME, fallbackMethod = "confirmReservationFallback")
    public boolean confirmReservation(String propertyId, String reservationId) {
        String url = config.getApiBaseUrl()
                + "/v3/properties/" + propertyId
                + "/reservations/" + reservationId + "/confirm";

        log.debug("POST confirm reservation Expedia: propertyId={}, reservationId={}",
                propertyId, reservationId);

        ResponseEntity<String> response = restTemplate.exchange(
                url, HttpMethod.POST, buildAuthEntity(null), String.class);

        boolean success = response.getStatusCode().is2xxSuccessful();
        if (!success) {
            log.warn("Echec confirmation reservation Expedia: reservationId={}, status={}",
                    reservationId, response.getStatusCode());
        }
        return success;
    }

    // ================================================================
    // Auth helpers
    // ================================================================

    /**
     * Construit le HttpEntity avec les headers d'authentification Expedia.
     * Format EAN : apikey + signature SHA-512 + timestamp.
     */
    private HttpEntity<Object> buildAuthEntity(Object body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));

        String apiKey = config.getApiKey();
        String apiSecret = config.getApiSecret();
        long timestamp = Instant.now().getEpochSecond();

        String signature = computeSignature(apiKey, apiSecret, timestamp);
        String authHeader = String.format(
                "EAN apikey=%s,signature=%s,timestamp=%d",
                apiKey, signature, timestamp);
        headers.set(HttpHeaders.AUTHORIZATION, authHeader);

        return body != null ? new HttpEntity<>(body, headers) : new HttpEntity<>(headers);
    }

    /**
     * Calcule la signature SHA-512 pour l'authentification Expedia.
     * signature = SHA-512(apiKey + apiSecret + timestamp)
     */
    private String computeSignature(String apiKey, String apiSecret, long timestamp) {
        try {
            String toSign = apiKey + apiSecret + timestamp;
            MessageDigest digest = MessageDigest.getInstance("SHA-512");
            byte[] hash = digest.digest(toSign.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            log.error("Erreur calcul signature Expedia: {}", e.getMessage());
            throw new IllegalStateException("Impossible de calculer la signature Expedia", e);
        }
    }

    // ================================================================
    // Response parsers
    // ================================================================

    private List<ExpediaAvailabilityDto> parseAvailabilityResponse(String responseBody,
                                                                     String propertyId) {
        if (responseBody == null || responseBody.isEmpty()) {
            return List.of();
        }
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            JsonNode availabilities = root.path("availabilities");
            if (!availabilities.isArray()) {
                return List.of();
            }

            List<ExpediaAvailabilityDto> result = new ArrayList<>();
            for (JsonNode node : availabilities) {
                result.add(new ExpediaAvailabilityDto(
                        propertyId,
                        node.path("roomTypeId").asText(null),
                        LocalDate.parse(node.path("date").asText()),
                        node.path("totalInventoryAvailable").asInt(0),
                        node.path("ratePlanId").asText(null),
                        node.has("pricePerNight")
                                ? new BigDecimal(node.path("pricePerNight").asText("0"))
                                : BigDecimal.ZERO,
                        node.path("currency").asText("EUR"),
                        node.path("minLOS").asInt(1),
                        node.path("maxLOS").asInt(365),
                        node.path("closedToArrival").asBoolean(false),
                        node.path("closedToDeparture").asBoolean(false)
                ));
            }
            return result;
        } catch (Exception e) {
            log.error("Erreur parsing reponse availability Expedia: {}", e.getMessage());
            return List.of();
        }
    }

    private List<ExpediaReservationDto> parseReservationsResponse(String responseBody) {
        if (responseBody == null || responseBody.isEmpty()) {
            return List.of();
        }
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            JsonNode reservations = root.path("reservations");
            if (!reservations.isArray()) {
                return List.of();
            }

            List<ExpediaReservationDto> result = new ArrayList<>();
            for (JsonNode node : reservations) {
                result.add(new ExpediaReservationDto(
                        node.path("reservationId").asText(),
                        node.path("propertyId").asText(),
                        node.path("roomId").asText(null),
                        node.path("guestFirstName").asText(null),
                        node.path("guestLastName").asText(null),
                        node.path("guestEmail").asText(null),
                        LocalDate.parse(node.path("checkIn").asText()),
                        LocalDate.parse(node.path("checkOut").asText()),
                        node.path("status").asText("CONFIRMED"),
                        node.has("totalAmount")
                                ? new BigDecimal(node.path("totalAmount").asText("0"))
                                : BigDecimal.ZERO,
                        node.path("currency").asText("EUR"),
                        node.path("numberOfAdults").asInt(1),
                        node.path("numberOfChildren").asInt(0),
                        node.path("specialRequests").asText(null),
                        node.path("source").asText("EXPEDIA")
                ));
            }
            return result;
        } catch (Exception e) {
            log.error("Erreur parsing reponse reservations Expedia: {}", e.getMessage());
            return List.of();
        }
    }

    private Map<String, Object> buildAvailabilityUpdateBody(
            List<ExpediaAvailabilityDto> availabilities) {
        List<Map<String, Object>> updates = availabilities.stream()
                .map(a -> {
                    Map<String, Object> entry = new LinkedHashMap<>();
                    entry.put("date", a.date().toString());
                    entry.put("roomTypeId", a.roomTypeId());
                    entry.put("totalInventoryAvailable", a.totalInventoryAvailable());
                    entry.put("closedToArrival", a.closedToArrival());
                    entry.put("closedToDeparture", a.closedToDeparture());
                    if (a.minLOS() > 0) {
                        entry.put("minLOS", a.minLOS());
                    }
                    if (a.maxLOS() > 0) {
                        entry.put("maxLOS", a.maxLOS());
                    }
                    return entry;
                })
                .toList();

        return Map.of("availabilities", updates);
    }

    // ================================================================
    // CircuitBreaker fallbacks
    // ================================================================

    @SuppressWarnings("unused")
    private List<ExpediaAvailabilityDto> getAvailabilityFallback(String propertyId,
                                                                   LocalDate from, LocalDate to,
                                                                   Throwable t) {
        log.error("CircuitBreaker: getAvailability fallback pour propertyId={}: {}",
                propertyId, t.getMessage());
        return List.of();
    }

    @SuppressWarnings("unused")
    private boolean updateAvailabilityFallback(String propertyId,
                                                List<ExpediaAvailabilityDto> availabilities,
                                                Throwable t) {
        log.error("CircuitBreaker: updateAvailability fallback pour propertyId={}: {}",
                propertyId, t.getMessage());
        return false;
    }

    @SuppressWarnings("unused")
    private boolean updateRatesFallback(String propertyId, String ratePlanId,
                                         List<Map<String, Object>> rateUpdates,
                                         Throwable t) {
        log.error("CircuitBreaker: updateRates fallback pour propertyId={}: {}",
                propertyId, t.getMessage());
        return false;
    }

    @SuppressWarnings("unused")
    private List<ExpediaReservationDto> getReservationsFallback(String propertyId,
                                                                  LocalDate from, LocalDate to,
                                                                  Throwable t) {
        log.error("CircuitBreaker: getReservations fallback pour propertyId={}: {}",
                propertyId, t.getMessage());
        return List.of();
    }

    @SuppressWarnings("unused")
    private boolean confirmReservationFallback(String propertyId, String reservationId,
                                                Throwable t) {
        log.error("CircuitBreaker: confirmReservation fallback pour propertyId={}: {}",
                propertyId, t.getMessage());
        return false;
    }
}
