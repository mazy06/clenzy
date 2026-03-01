package com.clenzy.integration.hotelscom.service;

import com.clenzy.integration.hotelscom.config.HotelsComConfig;
import com.clenzy.integration.hotelscom.dto.HotelsComAvailabilityDto;
import com.clenzy.integration.hotelscom.dto.HotelsComReservationDto;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.Base64;
import java.util.List;
import java.util.Map;

/**
 * Client REST pour l'API Expedia Partner Central (EPC).
 *
 * Hotels.com utilise l'infrastructure API d'Expedia Group.
 * Authentification via HTTP Basic Auth (API key:secret en Base64).
 * Toutes les methodes sont protegees par un circuit breaker.
 */
@Service
public class HotelsComApiClient {

    private static final Logger log = LoggerFactory.getLogger(HotelsComApiClient.class);

    private final HotelsComConfig config;
    private final RestTemplate restTemplate;

    public HotelsComApiClient(HotelsComConfig config, RestTemplate restTemplate) {
        this.config = config;
        this.restTemplate = restTemplate;
    }

    /**
     * Recupere la disponibilite d'une propriete pour une plage de dates.
     */
    @CircuitBreaker(name = "hotelscom-api")
    public List<HotelsComAvailabilityDto> getAvailability(String propertyId, LocalDate from, LocalDate to) {
        log.debug("Hotels.com getAvailability: propertyId={}, from={}, to={}", propertyId, from, to);

        String url = config.getApiBaseUrl() + "/properties/" + propertyId
                + "/availability?startDate=" + from + "&endDate=" + to;

        ResponseEntity<List<HotelsComAvailabilityDto>> response = restTemplate.exchange(
                url,
                HttpMethod.GET,
                new HttpEntity<>(buildAuthHeaders()),
                new ParameterizedTypeReference<>() {}
        );

        return response.getBody() != null ? response.getBody() : List.of();
    }

    /**
     * Met a jour la disponibilite et les tarifs d'une propriete.
     */
    @CircuitBreaker(name = "hotelscom-api")
    public void updateAvailability(String propertyId, List<HotelsComAvailabilityDto> availability) {
        log.debug("Hotels.com updateAvailability: propertyId={}, days={}", propertyId, availability.size());

        String url = config.getApiBaseUrl() + "/properties/" + propertyId + "/availability";

        restTemplate.exchange(
                url,
                HttpMethod.PUT,
                new HttpEntity<>(availability, buildAuthHeaders()),
                Void.class
        );
    }

    /**
     * Recupere les reservations d'une propriete.
     */
    @CircuitBreaker(name = "hotelscom-api")
    public List<HotelsComReservationDto> getReservations(String propertyId, LocalDate from, LocalDate to) {
        log.debug("Hotels.com getReservations: propertyId={}, from={}, to={}", propertyId, from, to);

        String url = config.getApiBaseUrl() + "/properties/" + propertyId
                + "/reservations?startDate=" + from + "&endDate=" + to;

        ResponseEntity<List<HotelsComReservationDto>> response = restTemplate.exchange(
                url,
                HttpMethod.GET,
                new HttpEntity<>(buildAuthHeaders()),
                new ParameterizedTypeReference<>() {}
        );

        return response.getBody() != null ? response.getBody() : List.of();
    }

    /**
     * Confirme une reservation.
     */
    @CircuitBreaker(name = "hotelscom-api")
    public void confirmReservation(String propertyId, String confirmationNumber) {
        log.debug("Hotels.com confirmReservation: propertyId={}, confirmation={}",
                propertyId, confirmationNumber);

        String url = config.getApiBaseUrl() + "/properties/" + propertyId
                + "/reservations/" + confirmationNumber + "/confirm";

        restTemplate.exchange(
                url,
                HttpMethod.POST,
                new HttpEntity<>(buildAuthHeaders()),
                Void.class
        );
    }

    /**
     * Construit les headers d'authentification Hotels.com/Expedia.
     * Utilise HTTP Basic Auth : Base64(apiKey:apiSecret).
     */
    private HttpHeaders buildAuthHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        String credentials = config.getApiKey() + ":" + config.getApiSecret();
        String encoded = Base64.getEncoder().encodeToString(credentials.getBytes(StandardCharsets.UTF_8));
        headers.set("Authorization", "Basic " + encoded);
        return headers;
    }
}
