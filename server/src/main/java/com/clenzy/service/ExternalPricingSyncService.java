package com.clenzy.service;

import com.clenzy.dto.ExternalPriceRecommendation;
import com.clenzy.model.ExternalPricingConfig;
import com.clenzy.model.PricingProvider;
import com.clenzy.model.Property;
import com.clenzy.model.RateOverride;
import com.clenzy.repository.ExternalPricingConfigRepository;
import com.clenzy.repository.RateOverrideRepository;
import com.clenzy.repository.PropertyRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Service
public class ExternalPricingSyncService {

    private static final Logger log = LoggerFactory.getLogger(ExternalPricingSyncService.class);
    private static final String SOURCE_EXTERNAL_PRICING = "EXTERNAL_PRICING";

    private final ExternalPricingConfigRepository configRepository;
    private final PriceLabsService priceLabsService;
    private final RateOverrideRepository rateOverrideRepository;
    private final PropertyRepository propertyRepository;

    public ExternalPricingSyncService(ExternalPricingConfigRepository configRepository,
                                      PriceLabsService priceLabsService,
                                      RateOverrideRepository rateOverrideRepository,
                                      PropertyRepository propertyRepository) {
        this.configRepository = configRepository;
        this.priceLabsService = priceLabsService;
        this.rateOverrideRepository = rateOverrideRepository;
        this.propertyRepository = propertyRepository;
    }

    @Transactional
    public int syncPricesForOrg(Long orgId) {
        List<ExternalPricingConfig> configs = configRepository.findByOrganizationId(orgId);
        int totalSynced = 0;

        for (ExternalPricingConfig config : configs) {
            if (!config.getEnabled()) continue;

            try {
                ExternalPricingService provider = resolveProvider(config.getProvider());
                int synced = syncForConfig(config, provider);
                config.setLastSyncAt(Instant.now());
                configRepository.save(config);
                totalSynced += synced;
            } catch (Exception e) {
                log.error("Failed to sync external pricing for org {} provider {}: {}",
                    orgId, config.getProvider(), e.getMessage());
            }
        }

        if (totalSynced > 0) {
            log.info("Synced {} external price recommendations for org {}", totalSynced, orgId);
        }
        return totalSynced;
    }

    private int syncForConfig(ExternalPricingConfig config, ExternalPricingService provider) {
        int synced = 0;
        LocalDate from = LocalDate.now();
        LocalDate to = from.plusMonths(6);

        if (config.getPropertyMappings() == null || config.getPropertyMappings().isEmpty()) {
            return 0;
        }

        for (String propertyIdStr : config.getPropertyMappings().keySet()) {
            Long propertyId = Long.parseLong(propertyIdStr);
            List<ExternalPriceRecommendation> recommendations =
                provider.fetchRecommendations(config, propertyId, from, to);

            for (ExternalPriceRecommendation rec : recommendations) {
                applyRecommendation(rec, config.getOrganizationId());
                synced++;
            }
        }
        return synced;
    }

    private void applyRecommendation(ExternalPriceRecommendation rec, Long orgId) {
        Optional<Property> propertyOpt = propertyRepository.findById(rec.propertyId());
        if (propertyOpt.isEmpty()) {
            log.warn("Property {} not found, skipping price recommendation", rec.propertyId());
            return;
        }

        Property property = propertyOpt.get();
        Optional<RateOverride> existing = rateOverrideRepository.findByPropertyIdAndDate(
            rec.propertyId(), rec.date(), orgId);

        if (existing.isPresent()) {
            RateOverride override = existing.get();
            if (SOURCE_EXTERNAL_PRICING.equals(override.getSource())) {
                override.setNightlyPrice(rec.recommendedPrice());
                rateOverrideRepository.save(override);
            }
        } else {
            RateOverride override = new RateOverride(property, rec.date(),
                rec.recommendedPrice(), SOURCE_EXTERNAL_PRICING, orgId);
            rateOverrideRepository.save(override);
        }
    }

    public ExternalPricingConfig getConfig(Long orgId, PricingProvider provider) {
        return configRepository.findByProvider(provider, orgId)
            .orElseThrow(() -> new IllegalArgumentException(
                "No external pricing config found for provider: " + provider));
    }

    public List<ExternalPricingConfig> getAllConfigs(Long orgId) {
        return configRepository.findByOrganizationId(orgId);
    }

    @Transactional
    public ExternalPricingConfig saveConfig(ExternalPricingConfig config) {
        return configRepository.save(config);
    }

    public List<ExternalPriceRecommendation> getRecommendations(Long propertyId, Long orgId, PricingProvider provider) {
        ExternalPricingConfig config = getConfig(orgId, provider);
        ExternalPricingService providerService = resolveProvider(provider);
        return providerService.fetchRecommendations(config, propertyId, LocalDate.now(), LocalDate.now().plusMonths(3));
    }

    private ExternalPricingService resolveProvider(PricingProvider provider) {
        // MVP: Only PriceLabs implemented. Others will follow same pattern.
        return priceLabsService;
    }
}
