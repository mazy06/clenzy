package com.clenzy.integration.tripadvisor.service;

import com.clenzy.integration.tripadvisor.config.TripAdvisorConfig;
import com.clenzy.integration.tripadvisor.dto.TripAdvisorAvailabilityDto;
import com.clenzy.integration.tripadvisor.dto.TripAdvisorBookingDto;
import com.clenzy.integration.tripadvisor.dto.TripAdvisorListingDto;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;

/**
 * Client HTTP pour l'API TripAdvisor Vacation Rentals.
 *
 * TripAdvisor utilise une API REST classique avec authentification par API key.
 * Les headers requis :
 * - X-TripAdvisor-API-Key
 * - X-TripAdvisor-Signature (HMAC du body avec le secret)
 *
 * Les disponibilites sont poussees vers TripAdvisor et les reservations
 * sont recuperees par polling ou recues par webhook.
 */
@Service
public class TripAdvisorApiClient {

    private static final Logger log = LoggerFactory.getLogger(TripAdvisorApiClient.class);
    private static final String CIRCUIT_BREAKER_NAME = "tripAdvisor";

    private final TripAdvisorConfig config;
    private final RestClient restClient;

    public TripAdvisorApiClient(TripAdvisorConfig config,
                                 RestClient.Builder restClientBuilder) {
        this.config = config;
        this.restClient = restClientBuilder
                .baseUrl(config.getApiBaseUrl())
                .build();
    }

    /**
     * Pousse les disponibilites vers TripAdvisor.
     *
     * @param partnerId    partner ID TripAdvisor
     * @param availability liste des disponibilites a pousser
     */
    @CircuitBreaker(name = CIRCUIT_BREAKER_NAME, fallbackMethod = "pushAvailabilityFallback")
    public void pushAvailability(String partnerId, List<TripAdvisorAvailabilityDto> availability) {
        if (!config.isConfigured()) {
            log.warn("TripAdvisor non configure, push availability ignore");
            return;
        }

        log.info("Push {} jours de disponibilite vers TripAdvisor (partner={})",
                availability.size(), partnerId);

        // TODO : Implementer l'appel API TripAdvisor
        // PUT /v1/partners/{partnerId}/availability avec les headers d'authentification
        log.debug("TripAdvisor pushAvailability sera implemente avec l'API Vacation Rentals v1");
    }

    /**
     * Recupere les reservations depuis TripAdvisor.
     *
     * @param partnerId partner ID TripAdvisor
     * @return liste des reservations
     */
    @CircuitBreaker(name = CIRCUIT_BREAKER_NAME, fallbackMethod = "getBookingsFallback")
    public List<TripAdvisorBookingDto> getBookings(String partnerId) {
        if (!config.isConfigured()) {
            log.warn("TripAdvisor non configure, get bookings ignore");
            return List.of();
        }

        log.info("Recuperation des reservations TripAdvisor (partner={})", partnerId);

        // TODO : Implementer l'appel API TripAdvisor
        // GET /v1/partners/{partnerId}/bookings
        log.debug("TripAdvisor getBookings sera implemente avec l'API Vacation Rentals v1");
        return List.of();
    }

    /**
     * Pousse les donnees de listing vers TripAdvisor.
     *
     * @param partnerId partner ID TripAdvisor
     * @param listing   donnees du listing
     */
    @CircuitBreaker(name = CIRCUIT_BREAKER_NAME, fallbackMethod = "pushListingDataFallback")
    public void pushListingData(String partnerId, TripAdvisorListingDto listing) {
        if (!config.isConfigured()) {
            log.warn("TripAdvisor non configure, push listing ignore");
            return;
        }

        log.info("Push listing {} vers TripAdvisor (partner={})",
                listing.partnerListingId(), partnerId);

        // TODO : Implementer l'appel API TripAdvisor
        // PUT /v1/partners/{partnerId}/listings/{listingId}
        log.debug("TripAdvisor pushListingData sera implemente avec l'API Vacation Rentals v1");
    }

    /**
     * Met a jour le statut d'une reservation sur TripAdvisor.
     *
     * @param partnerId partner ID TripAdvisor
     * @param bookingId identifiant de la reservation
     * @param newStatus nouveau statut (CONFIRMED, CANCELLED, etc.)
     */
    @CircuitBreaker(name = CIRCUIT_BREAKER_NAME, fallbackMethod = "updateBookingStatusFallback")
    public void updateBookingStatus(String partnerId, String bookingId, String newStatus) {
        if (!config.isConfigured()) {
            log.warn("TripAdvisor non configure, update booking status ignore");
            return;
        }

        log.info("Update booking {} status={} sur TripAdvisor (partner={})",
                bookingId, newStatus, partnerId);

        // TODO : Implementer l'appel API TripAdvisor
        // PATCH /v1/partners/{partnerId}/bookings/{bookingId}
        log.debug("TripAdvisor updateBookingStatus sera implemente avec l'API Vacation Rentals v1");
    }

    // ---- Circuit breaker fallbacks ----

    @SuppressWarnings("unused")
    private void pushAvailabilityFallback(String partnerId,
                                           List<TripAdvisorAvailabilityDto> availability,
                                           Throwable t) {
        log.error("Circuit breaker ouvert pour TripAdvisor pushAvailability (partner={}): {}",
                partnerId, t.getMessage());
    }

    @SuppressWarnings("unused")
    private List<TripAdvisorBookingDto> getBookingsFallback(String partnerId, Throwable t) {
        log.error("Circuit breaker ouvert pour TripAdvisor getBookings (partner={}): {}",
                partnerId, t.getMessage());
        return List.of();
    }

    @SuppressWarnings("unused")
    private void pushListingDataFallback(String partnerId,
                                          TripAdvisorListingDto listing,
                                          Throwable t) {
        log.error("Circuit breaker ouvert pour TripAdvisor pushListingData (partner={}): {}",
                partnerId, t.getMessage());
    }

    @SuppressWarnings("unused")
    private void updateBookingStatusFallback(String partnerId, String bookingId,
                                              String newStatus, Throwable t) {
        log.error("Circuit breaker ouvert pour TripAdvisor updateBookingStatus (partner={}, booking={}): {}",
                partnerId, bookingId, t.getMessage());
    }
}
