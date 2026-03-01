package com.clenzy.service;

import com.clenzy.dto.ExternalPriceRecommendation;
import com.clenzy.model.ExternalPricingConfig;

import java.time.LocalDate;
import java.util.List;

/**
 * Interface for external pricing providers (PriceLabs, Beyond Pricing, Wheelhouse).
 */
public interface ExternalPricingService {

    /**
     * Fetch price recommendations from the external provider.
     */
    List<ExternalPriceRecommendation> fetchRecommendations(ExternalPricingConfig config,
                                                            Long propertyId,
                                                            LocalDate from, LocalDate to);

    /**
     * Push listing data to the external provider for analysis.
     */
    void pushListingData(ExternalPricingConfig config, Long propertyId);
}
