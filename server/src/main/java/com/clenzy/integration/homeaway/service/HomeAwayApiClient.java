package com.clenzy.integration.homeaway.service;

import com.clenzy.integration.homeaway.config.HomeAwayConfig;
import com.clenzy.integration.homeaway.dto.HomeAwayAvailabilityDto;
import com.clenzy.integration.homeaway.dto.HomeAwayListingDto;
import com.clenzy.integration.homeaway.dto.HomeAwayReservationDto;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Client REST pour l'API HomeAway/Abritel.
 *
 * Authentification via Bearer token OAuth 2.0.
 * Toutes les methodes sont protegees par un circuit breaker.
 */
@Service
public class HomeAwayApiClient {

    private static final Logger log = LoggerFactory.getLogger(HomeAwayApiClient.class);

    private final HomeAwayConfig config;
    private final RestTemplate restTemplate;

    public HomeAwayApiClient(HomeAwayConfig config, RestTemplate restTemplate) {
        this.config = config;
        this.restTemplate = restTemplate;
    }

    /**
     * Recupere les details d'un listing.
     */
    @CircuitBreaker(name = "homeaway-api")
    public HomeAwayListingDto getListing(String listingId, String accessToken) {
        log.debug("HomeAway getListing: listingId={}", listingId);

        String url = config.getApiBaseUrl() + "/listings/" + listingId;

        ResponseEntity<HomeAwayListingDto> response = restTemplate.exchange(
                url,
                HttpMethod.GET,
                new HttpEntity<>(buildAuthHeaders(accessToken)),
                HomeAwayListingDto.class
        );

        return response.getBody();
    }

    /**
     * Recupere la disponibilite d'un listing pour une plage de dates.
     */
    @CircuitBreaker(name = "homeaway-api")
    public List<HomeAwayAvailabilityDto> getAvailability(String listingId, LocalDate from,
                                                          LocalDate to, String accessToken) {
        log.debug("HomeAway getAvailability: listingId={}, from={}, to={}", listingId, from, to);

        String url = config.getApiBaseUrl() + "/listings/" + listingId
                + "/availability?startDate=" + from + "&endDate=" + to;

        ResponseEntity<List<HomeAwayAvailabilityDto>> response = restTemplate.exchange(
                url,
                HttpMethod.GET,
                new HttpEntity<>(buildAuthHeaders(accessToken)),
                new ParameterizedTypeReference<>() {}
        );

        return response.getBody() != null ? response.getBody() : List.of();
    }

    /**
     * Met a jour la disponibilite d'un listing.
     */
    @CircuitBreaker(name = "homeaway-api")
    public void updateAvailability(String listingId, List<HomeAwayAvailabilityDto> availability,
                                    String accessToken) {
        log.debug("HomeAway updateAvailability: listingId={}, days={}", listingId, availability.size());

        String url = config.getApiBaseUrl() + "/listings/" + listingId + "/availability";

        restTemplate.exchange(
                url,
                HttpMethod.PUT,
                new HttpEntity<>(availability, buildAuthHeaders(accessToken)),
                Void.class
        );
    }

    /**
     * Recupere les reservations d'un listing.
     */
    @CircuitBreaker(name = "homeaway-api")
    public List<HomeAwayReservationDto> getReservations(String listingId, LocalDate from,
                                                         LocalDate to, String accessToken) {
        log.debug("HomeAway getReservations: listingId={}, from={}, to={}", listingId, from, to);

        String url = config.getApiBaseUrl() + "/listings/" + listingId
                + "/reservations?startDate=" + from + "&endDate=" + to;

        ResponseEntity<List<HomeAwayReservationDto>> response = restTemplate.exchange(
                url,
                HttpMethod.GET,
                new HttpEntity<>(buildAuthHeaders(accessToken)),
                new ParameterizedTypeReference<>() {}
        );

        return response.getBody() != null ? response.getBody() : List.of();
    }

    /**
     * Confirme une reservation.
     */
    @CircuitBreaker(name = "homeaway-api")
    public void confirmReservation(String listingId, String reservationId, String accessToken) {
        log.debug("HomeAway confirmReservation: listingId={}, reservationId={}", listingId, reservationId);

        String url = config.getApiBaseUrl() + "/listings/" + listingId
                + "/reservations/" + reservationId + "/confirm";

        restTemplate.exchange(
                url,
                HttpMethod.POST,
                new HttpEntity<>(buildAuthHeaders(accessToken)),
                Void.class
        );
    }

    /**
     * Construit les headers d'authentification HomeAway.
     * Utilise Bearer token OAuth 2.0.
     */
    private HttpHeaders buildAuthHeaders(String accessToken) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(accessToken);
        return headers;
    }
}
