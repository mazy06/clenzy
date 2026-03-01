package com.clenzy.service;

import com.clenzy.dto.ExternalPriceRecommendation;
import com.clenzy.model.ExternalPricingConfig;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * PriceLabs external pricing integration.
 *
 * Calls the PriceLabs REST API to fetch dynamic pricing recommendations
 * and push listing data for market analysis.
 *
 * API Reference: https://developer.pricelabs.co
 * - POST /v1/getpricing   -> fetch pricing recommendations
 * - POST /v1/listings/{id} -> push listing data for analysis
 * - GET  /v1/listings/{id}/market-data -> market comparables
 *
 * Protected by CircuitBreaker for resilience against API failures.
 */
@Service
public class PriceLabsService implements ExternalPricingService {

    private static final Logger log = LoggerFactory.getLogger(PriceLabsService.class);
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ISO_LOCAL_DATE;
    private static final String DEFAULT_API_URL = "https://api.pricelabs.co";
    private static final String DEFAULT_CURRENCY = "EUR";

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public PriceLabsService(RestTemplate restTemplate, ObjectMapper objectMapper) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
    }

    @Override
    @CircuitBreaker(name = "pricelabs", fallbackMethod = "fetchRecommendationsFallback")
    public List<ExternalPriceRecommendation> fetchRecommendations(ExternalPricingConfig config,
                                                                    Long propertyId,
                                                                    LocalDate from, LocalDate to) {
        log.info("Fetching PriceLabs recommendations for property {} [{}, {}]", propertyId, from, to);

        String externalListingId = resolveExternalId(config, propertyId);
        if (externalListingId == null) {
            log.warn("No PriceLabs mapping found for property {}", propertyId);
            return List.of();
        }

        String apiUrl = resolveApiUrl(config);
        String url = apiUrl + "/v1/getpricing";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-API-Key", config.getApiKey());

        // Build PriceLabs request body — use configured currency or fallback to DEFAULT
        String currency = config.getCurrency() != null ? config.getCurrency() : DEFAULT_CURRENCY;
        Map<String, Object> requestBody = Map.of(
            "listing_id", externalListingId,
            "start_date", from.format(DATE_FMT),
            "end_date", to.format(DATE_FMT),
            "currency", currency
        );

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);

        try {
            ResponseEntity<String> response = restTemplate.exchange(
                url, HttpMethod.POST, request, String.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                return parsePricingResponse(response.getBody(), propertyId);
            }

            log.error("PriceLabs API returned non-2xx status: {}", response.getStatusCode());
            return List.of();

        } catch (RestClientException e) {
            log.error("PriceLabs API communication error for property {}: {}", propertyId, e.getMessage());
            throw e; // Will be caught by circuit breaker
        }
    }

    @Override
    @CircuitBreaker(name = "pricelabs", fallbackMethod = "pushListingDataFallback")
    public void pushListingData(ExternalPricingConfig config, Long propertyId) {
        log.info("Pushing listing data to PriceLabs for property {}", propertyId);

        String externalListingId = resolveExternalId(config, propertyId);
        if (externalListingId == null) {
            log.warn("No PriceLabs mapping found for property {}", propertyId);
            return;
        }

        String apiUrl = resolveApiUrl(config);
        String url = apiUrl + "/v1/listings/" + externalListingId;

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-API-Key", config.getApiKey());

        // Push minimal listing data for PriceLabs analysis
        Map<String, Object> listingData = Map.of(
            "listing_id", externalListingId,
            "pms", "clenzy",
            "last_sync", LocalDate.now().format(DATE_FMT)
        );

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(listingData, headers);

        try {
            ResponseEntity<String> response = restTemplate.exchange(
                url, HttpMethod.POST, request, String.class
            );

            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("Successfully pushed listing data to PriceLabs for property {}", propertyId);
            } else {
                log.error("PriceLabs push returned non-2xx status: {}", response.getStatusCode());
            }
        } catch (RestClientException e) {
            log.error("PriceLabs push error for property {}: {}", propertyId, e.getMessage());
            throw e;
        }
    }

    // ================================================================
    // Response parsing
    // ================================================================

    /**
     * Parse PriceLabs pricing response JSON into ExternalPriceRecommendation list.
     *
     * PriceLabs response format:
     * {
     *   "status": "success",
     *   "data": {
     *     "prices": [
     *       { "date": "2025-01-15", "price": 120.00, "currency": "EUR",
     *         "confidence": 0.85, "min_price": 95.00, "max_price": 180.00 }
     *     ]
     *   }
     * }
     */
    private List<ExternalPriceRecommendation> parsePricingResponse(String responseBody, Long propertyId) {
        List<ExternalPriceRecommendation> recommendations = new ArrayList<>();

        try {
            PriceLabsResponse response = objectMapper.readValue(responseBody, PriceLabsResponse.class);

            if (response.data == null || response.data.prices == null) {
                log.warn("PriceLabs response contains no pricing data for property {}", propertyId);
                return recommendations;
            }

            for (PriceLabsPriceEntry entry : response.data.prices) {
                try {
                    LocalDate date = LocalDate.parse(entry.date, DATE_FMT);
                    BigDecimal price = entry.price != null ? entry.price : BigDecimal.ZERO;
                    double confidence = entry.confidence != null ? entry.confidence : 0.5;
                    String currency = entry.currency != null ? entry.currency : DEFAULT_CURRENCY;

                    recommendations.add(new ExternalPriceRecommendation(
                        propertyId, date, price, currency, confidence, "PRICELABS"
                    ));
                } catch (Exception e) {
                    log.warn("Skipping invalid PriceLabs price entry: {}", e.getMessage());
                }
            }

            log.info("Parsed {} PriceLabs recommendations for property {}", recommendations.size(), propertyId);

        } catch (Exception e) {
            log.error("Failed to parse PriceLabs response for property {}: {}", propertyId, e.getMessage());
        }

        return recommendations;
    }

    // ================================================================
    // Circuit breaker fallbacks
    // ================================================================

    private List<ExternalPriceRecommendation> fetchRecommendationsFallback(ExternalPricingConfig config,
                                                                            Long propertyId,
                                                                            LocalDate from, LocalDate to,
                                                                            Throwable t) {
        log.error("PriceLabs circuit breaker open for property {}: {}", propertyId, t.getMessage());
        return List.of();
    }

    @SuppressWarnings("unused")
    private void pushListingDataFallback(ExternalPricingConfig config, Long propertyId, Throwable t) {
        log.error("PriceLabs push circuit breaker open for property {}: {}", propertyId, t.getMessage());
    }

    // ================================================================
    // Helpers
    // ================================================================

    private String resolveExternalId(ExternalPricingConfig config, Long propertyId) {
        if (config.getPropertyMappings() == null) return null;
        return config.getPropertyMappings().get(String.valueOf(propertyId));
    }

    private String resolveApiUrl(ExternalPricingConfig config) {
        return config.getApiUrl() != null && !config.getApiUrl().isBlank()
            ? config.getApiUrl() : DEFAULT_API_URL;
    }

    // ================================================================
    // PriceLabs response DTOs (internal)
    // ================================================================

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class PriceLabsResponse {
        @JsonProperty("status")
        public String status;
        @JsonProperty("data")
        public PriceLabsData data;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class PriceLabsData {
        @JsonProperty("prices")
        public List<PriceLabsPriceEntry> prices;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class PriceLabsPriceEntry {
        @JsonProperty("date")
        public String date;
        @JsonProperty("price")
        public BigDecimal price;
        @JsonProperty("currency")
        public String currency;
        @JsonProperty("confidence")
        public Double confidence;
        @JsonProperty("min_price")
        public BigDecimal minPrice;
        @JsonProperty("max_price")
        public BigDecimal maxPrice;
    }
}
