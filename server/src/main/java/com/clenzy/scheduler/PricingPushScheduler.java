package com.clenzy.scheduler;

import com.clenzy.integration.airbnb.model.AirbnbListingMapping;
import com.clenzy.integration.airbnb.repository.AirbnbListingMappingRepository;
import com.clenzy.model.MessagingAutomationConfig;
import com.clenzy.repository.MessagingAutomationConfigRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Tache planifiee pour le push automatique des prix vers Airbnb.
 * Verifie le toggle global (MessagingAutomationConfig.autoPushPricingEnabled)
 * et le toggle par propriete (AirbnbListingMapping.autoPushPricing).
 */
@Service
public class PricingPushScheduler {

    private static final Logger log = LoggerFactory.getLogger(PricingPushScheduler.class);

    private final AirbnbListingMappingRepository listingRepository;
    private final MessagingAutomationConfigRepository configRepository;

    public PricingPushScheduler(
            AirbnbListingMappingRepository listingRepository,
            MessagingAutomationConfigRepository configRepository
    ) {
        this.listingRepository = listingRepository;
        this.configRepository = configRepository;
    }

    /**
     * Toutes les heures a :30. Pousse les prix vers Airbnb
     * pour les listings qui ont autoPushPricing=true.
     */
    @Scheduled(cron = "0 30 * * * *")
    public void pushPricingToAirbnb() {
        List<AirbnbListingMapping> mappings = listingRepository.findBySyncEnabledTrueAndAutoPushPricingTrue();

        if (mappings.isEmpty()) return;

        // Grouper par org pour isolation d'erreurs
        Map<Long, List<AirbnbListingMapping>> byOrg = mappings.stream()
            .filter(m -> m.getOrganizationId() != null)
            .collect(Collectors.groupingBy(AirbnbListingMapping::getOrganizationId));

        int totalPushed = 0;

        for (Map.Entry<Long, List<AirbnbListingMapping>> entry : byOrg.entrySet()) {
            Long orgId = entry.getKey();

            // Verifier le toggle global de l'org
            boolean globalEnabled = configRepository.findByOrganizationId(orgId)
                .map(MessagingAutomationConfig::isAutoPushPricingEnabled)
                .orElse(false);

            if (!globalEnabled) continue;

            for (AirbnbListingMapping mapping : entry.getValue()) {
                try {
                    // TODO: Appeler l'API Airbnb pour pousser les prix resolus
                    // PriceEngine.resolvePriceRange() pour les 365 prochains jours
                    // AirbnbApiClient.updatePricing(mapping.getAirbnbListingId(), prices)
                    log.debug("Auto-push prix pour listing {} (property={})",
                        mapping.getAirbnbListingId(), mapping.getPropertyId());
                    totalPushed++;
                } catch (Exception e) {
                    log.error("Erreur push prix pour listing {} (org={}): {}",
                        mapping.getAirbnbListingId(), orgId, e.getMessage());
                }
            }
        }

        if (totalPushed > 0) {
            log.info("PricingPushScheduler: {} listings mis a jour", totalPushed);
        }
    }
}
