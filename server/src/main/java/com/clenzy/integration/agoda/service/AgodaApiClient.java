package com.clenzy.integration.agoda.service;

import com.clenzy.integration.agoda.config.AgodaConfig;
import com.clenzy.integration.agoda.dto.AgodaAvailabilityDto;
import com.clenzy.integration.agoda.dto.AgodaReservationDto;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Client REST pour l'API Supply Agoda (v3).
 *
 * Authentification via API key dans le header Authorization.
 * Toutes les methodes sont protegees par un circuit breaker.
 */
@Service
public class AgodaApiClient {

    private static final Logger log = LoggerFactory.getLogger(AgodaApiClient.class);

    private final AgodaConfig config;
    private final RestTemplate restTemplate;

    public AgodaApiClient(AgodaConfig config, RestTemplate restTemplate) {
        this.config = config;
        this.restTemplate = restTemplate;
    }

    /**
     * Recupere la disponibilite d'une propriete pour une plage de dates.
     */
    @CircuitBreaker(name = "agoda-api")
    public List<AgodaAvailabilityDto> getAvailability(String propertyId, LocalDate from, LocalDate to) {
        log.debug("Agoda getAvailability: propertyId={}, from={}, to={}", propertyId, from, to);

        String url = config.getApiBaseUrl() + "/properties/" + propertyId
                + "/availability?from=" + from + "&to=" + to;

        ResponseEntity<List<AgodaAvailabilityDto>> response = restTemplate.exchange(
                url,
                HttpMethod.GET,
                new HttpEntity<>(buildAuthHeaders()),
                new ParameterizedTypeReference<>() {}
        );

        return response.getBody() != null ? response.getBody() : List.of();
    }

    /**
     * Met a jour la disponibilite d'une propriete.
     */
    @CircuitBreaker(name = "agoda-api")
    public void updateAvailability(String propertyId, List<AgodaAvailabilityDto> availability) {
        log.debug("Agoda updateAvailability: propertyId={}, days={}", propertyId, availability.size());

        String url = config.getApiBaseUrl() + "/properties/" + propertyId + "/availability";

        restTemplate.exchange(
                url,
                HttpMethod.PUT,
                new HttpEntity<>(availability, buildAuthHeaders()),
                Void.class
        );
    }

    /**
     * Met a jour les tarifs d'une propriete.
     */
    @CircuitBreaker(name = "agoda-api")
    public void updateRates(String propertyId, String roomTypeId,
                            LocalDate from, LocalDate to, BigDecimal rate, String currency) {
        log.debug("Agoda updateRates: propertyId={}, roomTypeId={}, rate={} {}",
                propertyId, roomTypeId, rate, currency);

        String url = config.getApiBaseUrl() + "/properties/" + propertyId + "/rates";

        Map<String, Object> body = Map.of(
                "room_type_id", roomTypeId,
                "from", from.toString(),
                "to", to.toString(),
                "rate", rate,
                "currency", currency
        );

        restTemplate.exchange(
                url,
                HttpMethod.PUT,
                new HttpEntity<>(body, buildAuthHeaders()),
                Void.class
        );
    }

    /**
     * Recupere les reservations d'une propriete.
     */
    @CircuitBreaker(name = "agoda-api")
    public List<AgodaReservationDto> getReservations(String propertyId, LocalDate from, LocalDate to) {
        log.debug("Agoda getReservations: propertyId={}, from={}, to={}", propertyId, from, to);

        String url = config.getApiBaseUrl() + "/properties/" + propertyId
                + "/reservations?from=" + from + "&to=" + to;

        ResponseEntity<List<AgodaReservationDto>> response = restTemplate.exchange(
                url,
                HttpMethod.GET,
                new HttpEntity<>(buildAuthHeaders()),
                new ParameterizedTypeReference<>() {}
        );

        return response.getBody() != null ? response.getBody() : List.of();
    }

    /**
     * Construit les headers d'authentification Agoda.
     * L'API Supply utilise API key + secret dans les headers.
     */
    private HttpHeaders buildAuthHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "apikey " + config.getApiKey());
        headers.set("X-Api-Secret", config.getApiSecret());
        return headers;
    }
}
