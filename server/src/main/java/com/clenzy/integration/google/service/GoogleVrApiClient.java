package com.clenzy.integration.google.service;

import com.clenzy.integration.google.config.GoogleVacationRentalsConfig;
import com.clenzy.integration.google.dto.GoogleVrAvailabilityDto;
import com.clenzy.integration.google.dto.GoogleVrBookingDto;
import com.clenzy.integration.google.dto.GoogleVrListingDto;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;

/**
 * Client HTTP pour l'API Google Travel Partner (Vacation Rentals).
 *
 * Google utilise un modele push pour les listings et ARI (Availability, Rates, Inventory) :
 * - Le PMS pousse les donnees de disponibilite/prix vers Google Hotel Center
 * - Les reservations sont recuperees via polling ou notifications
 *
 * L'authentification se fait via un service account Google Cloud (OAuth2 server-to-server).
 */
@Service
public class GoogleVrApiClient {

    private static final Logger log = LoggerFactory.getLogger(GoogleVrApiClient.class);
    private static final String CIRCUIT_BREAKER_NAME = "googleVr";

    private final GoogleVacationRentalsConfig config;
    private final RestClient restClient;

    public GoogleVrApiClient(GoogleVacationRentalsConfig config,
                             RestClient.Builder restClientBuilder) {
        this.config = config;
        this.restClient = restClientBuilder
                .baseUrl(config.getApiBaseUrl())
                .build();
    }

    /**
     * Pousse les donnees de disponibilite (ARI feed) vers Google Hotel Center.
     *
     * @param partnerId     partner ID Google
     * @param availability  liste des disponibilites a pousser
     */
    @CircuitBreaker(name = CIRCUIT_BREAKER_NAME, fallbackMethod = "pushAvailabilityFallback")
    public void pushAvailability(String partnerId, List<GoogleVrAvailabilityDto> availability) {
        if (!config.isConfigured()) {
            log.warn("Google VR non configure, push availability ignore");
            return;
        }

        log.info("Push {} jours de disponibilite vers Google VR (partner={})",
                availability.size(), partnerId);

        // TODO : Implementer l'appel API Travel Partner
        // POST /v3/accounts/{partnerId}/hotelViews:push avec le ARI feed
        // Requiert un access token obtenu via le service account
        log.debug("Google VR pushAvailability sera implemente avec l'API Travel Partner v3");
    }

    /**
     * Pousse les tarifs vers Google Hotel Center.
     *
     * @param partnerId    partner ID Google
     * @param availability liste des disponibilites avec prix
     */
    @CircuitBreaker(name = CIRCUIT_BREAKER_NAME, fallbackMethod = "pushRatesFallback")
    public void pushRates(String partnerId, List<GoogleVrAvailabilityDto> availability) {
        if (!config.isConfigured()) {
            log.warn("Google VR non configure, push rates ignore");
            return;
        }

        log.info("Push {} tarifs vers Google VR (partner={})",
                availability.size(), partnerId);

        // TODO : Implementer l'appel API Travel Partner
        // Les tarifs sont inclus dans le ARI feed avec les disponibilites
        log.debug("Google VR pushRates sera implemente avec l'API Travel Partner v3");
    }

    /**
     * Recupere les reservations depuis Google.
     *
     * @param partnerId partner ID Google
     * @return liste des reservations
     */
    @CircuitBreaker(name = CIRCUIT_BREAKER_NAME, fallbackMethod = "getBookingsFallback")
    public List<GoogleVrBookingDto> getBookings(String partnerId) {
        if (!config.isConfigured()) {
            log.warn("Google VR non configure, get bookings ignore");
            return List.of();
        }

        log.info("Recuperation des reservations Google VR (partner={})", partnerId);

        // TODO : Implementer l'appel API Travel Partner
        // GET /v3/accounts/{partnerId}/reservations
        log.debug("Google VR getBookings sera implemente avec l'API Travel Partner v3");
        return List.of();
    }

    /**
     * Pousse les donnees de listing vers Google Hotel Center.
     *
     * @param partnerId partner ID Google
     * @param listing   donnees du listing
     */
    @CircuitBreaker(name = CIRCUIT_BREAKER_NAME, fallbackMethod = "pushListingDataFallback")
    public void pushListingData(String partnerId, GoogleVrListingDto listing) {
        if (!config.isConfigured()) {
            log.warn("Google VR non configure, push listing ignore");
            return;
        }

        log.info("Push listing {} vers Google VR (partner={})",
                listing.partnerListingId(), partnerId);

        // TODO : Implementer l'appel API Travel Partner
        // Le listing feed est pousse via l'API Hotel Center
        log.debug("Google VR pushListingData sera implemente avec l'API Travel Partner v3");
    }

    // ---- Circuit breaker fallbacks ----

    @SuppressWarnings("unused")
    private void pushAvailabilityFallback(String partnerId,
                                           List<GoogleVrAvailabilityDto> availability,
                                           Throwable t) {
        log.error("Circuit breaker ouvert pour Google VR pushAvailability (partner={}): {}",
                partnerId, t.getMessage());
    }

    @SuppressWarnings("unused")
    private void pushRatesFallback(String partnerId,
                                    List<GoogleVrAvailabilityDto> availability,
                                    Throwable t) {
        log.error("Circuit breaker ouvert pour Google VR pushRates (partner={}): {}",
                partnerId, t.getMessage());
    }

    @SuppressWarnings("unused")
    private List<GoogleVrBookingDto> getBookingsFallback(String partnerId, Throwable t) {
        log.error("Circuit breaker ouvert pour Google VR getBookings (partner={}): {}",
                partnerId, t.getMessage());
        return List.of();
    }

    @SuppressWarnings("unused")
    private void pushListingDataFallback(String partnerId,
                                          GoogleVrListingDto listing,
                                          Throwable t) {
        log.error("Circuit breaker ouvert pour Google VR pushListingData (partner={}): {}",
                partnerId, t.getMessage());
    }
}
