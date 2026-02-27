package com.clenzy.service;

import com.clenzy.dto.ExternalPriceRecommendation;
import com.clenzy.model.ExternalPricingConfig;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * PriceLabs external pricing integration.
 * Uses CircuitBreaker for resilience against API failures.
 *
 * MVP: Returns empty recommendations (API integration placeholder).
 * Production: Will call PriceLabs REST API with the configured API key.
 */
@Service
public class PriceLabsService implements ExternalPricingService {

    private static final Logger log = LoggerFactory.getLogger(PriceLabsService.class);

    @Override
    @CircuitBreaker(name = "pricelabs", fallbackMethod = "fetchRecommendationsFallback")
    public List<ExternalPriceRecommendation> fetchRecommendations(ExternalPricingConfig config,
                                                                    Long propertyId,
                                                                    LocalDate from, LocalDate to) {
        log.info("Fetching PriceLabs recommendations for property {} from {} to {}", propertyId, from, to);

        String externalListingId = resolveExternalId(config, propertyId);
        if (externalListingId == null) {
            log.warn("No PriceLabs mapping found for property {}", propertyId);
            return List.of();
        }

        // MVP: Placeholder for PriceLabs API call
        // Production implementation will use WebClient/RestTemplate to call:
        // POST {config.apiUrl}/v1/getpricing
        // Headers: X-API-Key: {config.apiKey}
        // Body: { "listing_id": externalListingId, "start_date": from, "end_date": to }

        log.debug("PriceLabs API call placeholder for listing {}", externalListingId);
        return List.of();
    }

    @Override
    public void pushListingData(ExternalPricingConfig config, Long propertyId) {
        log.info("Pushing listing data to PriceLabs for property {}", propertyId);

        String externalListingId = resolveExternalId(config, propertyId);
        if (externalListingId == null) {
            log.warn("No PriceLabs mapping found for property {}", propertyId);
            return;
        }

        // MVP: Placeholder for PriceLabs API call
        // Production: POST {config.apiUrl}/v1/listings/{externalListingId}
        log.debug("PriceLabs push placeholder for listing {}", externalListingId);
    }

    private List<ExternalPriceRecommendation> fetchRecommendationsFallback(ExternalPricingConfig config,
                                                                            Long propertyId,
                                                                            LocalDate from, LocalDate to,
                                                                            Throwable t) {
        log.error("PriceLabs circuit breaker open for property {}: {}", propertyId, t.getMessage());
        return List.of();
    }

    private String resolveExternalId(ExternalPricingConfig config, Long propertyId) {
        if (config.getPropertyMappings() == null) return null;
        return config.getPropertyMappings().get(String.valueOf(propertyId));
    }
}
