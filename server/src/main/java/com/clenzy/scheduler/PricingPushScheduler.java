package com.clenzy.scheduler;

import com.clenzy.integration.airbnb.model.AirbnbListingMapping;
import com.clenzy.integration.airbnb.repository.AirbnbListingMappingRepository;
import com.clenzy.integration.channel.AirbnbChannelAdapter;
import com.clenzy.integration.channel.SyncResult;
import com.clenzy.model.MessagingAutomationConfig;
import com.clenzy.repository.MessagingAutomationConfigRepository;
import com.clenzy.service.agent.supervision.SupervisionActivityService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Tache planifiee pour le push automatique des prix vers Airbnb.
 * Verifie le toggle global (MessagingAutomationConfig.autoPushPricingEnabled)
 * et le toggle par propriete (AirbnbListingMapping.autoPushPricing).
 *
 * Utilise AirbnbChannelAdapter.pushCalendarUpdate() pour pousser les prix
 * resolus par PriceEngine vers l'API Airbnb Calendar.
 */
@Service
public class PricingPushScheduler {

    private static final Logger log = LoggerFactory.getLogger(PricingPushScheduler.class);
    private static final int PUSH_HORIZON_DAYS = 90;

    private final AirbnbListingMappingRepository listingRepository;
    private final MessagingAutomationConfigRepository configRepository;
    private final AirbnbChannelAdapter airbnbChannelAdapter;
    private final SupervisionActivityService supervisionActivityService;

    public PricingPushScheduler(
            AirbnbListingMappingRepository listingRepository,
            MessagingAutomationConfigRepository configRepository,
            AirbnbChannelAdapter airbnbChannelAdapter,
            SupervisionActivityService supervisionActivityService
    ) {
        this.listingRepository = listingRepository;
        this.configRepository = configRepository;
        this.airbnbChannelAdapter = airbnbChannelAdapter;
        this.supervisionActivityService = supervisionActivityService;
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
        int totalFailed = 0;

        for (Map.Entry<Long, List<AirbnbListingMapping>> entry : byOrg.entrySet()) {
            Long orgId = entry.getKey();

            // Verifier le toggle global de l'org
            boolean globalEnabled = configRepository.findByOrganizationId(orgId)
                .map(MessagingAutomationConfig::isAutoPushPricingEnabled)
                .orElse(false);

            if (!globalEnabled) continue;

            LocalDate from = LocalDate.now();
            LocalDate to = from.plusDays(PUSH_HORIZON_DAYS);

            for (AirbnbListingMapping mapping : entry.getValue()) {
                try {
                    SyncResult result = airbnbChannelAdapter.pushCalendarUpdate(
                            mapping.getPropertyId(), from, to, orgId);

                    if (result.getStatus() == SyncResult.Status.SUCCESS) {
                        totalPushed++;
                        log.debug("Auto-push prix OK pour listing {} (property={}, {} jours)",
                            mapping.getAirbnbListingId(), mapping.getPropertyId(), result.getItemsProcessed());
                        recordConstellationActivity(orgId, mapping, result);
                    } else if (result.getStatus() == SyncResult.Status.FAILED) {
                        totalFailed++;
                        log.warn("Auto-push prix FAILED pour listing {} (property={}): {}",
                            mapping.getAirbnbListingId(), mapping.getPropertyId(), result.getMessage());
                    }
                    // SKIPPED = no mapping or no prices, normal case
                } catch (Exception e) {
                    totalFailed++;
                    log.error("Erreur push prix pour listing {} (org={}): {}",
                        mapping.getAirbnbListingId(), orgId, e.getMessage());
                }
            }
        }

        if (totalPushed > 0 || totalFailed > 0) {
            log.info("PricingPushScheduler: {} listings mis a jour, {} echecs", totalPushed, totalFailed);
        }
    }

    /**
     * Fait remonter le push des prix dans le feed « En direct » de la CONSTELLATION du logement
     * (agent Revenue « rev »). Le propertyId est celui du mapping de CETTE occurrence, l'org est
     * déjà isolée dans la boucle. Best-effort : le record est lui-même best-effort côté service et
     * un échec ne doit jamais casser le scheduler.
     */
    private void recordConstellationActivity(Long orgId, AirbnbListingMapping mapping, SyncResult result) {
        try {
            Long propertyId = mapping.getPropertyId();
            if (propertyId == null) {
                return; // listing sans logement rattachable → rien à afficher dans une constellation
            }
            String summary = "Prix poussés vers les canaux sur ce logement ("
                + result.getItemsProcessed() + " jours mis à jour)";
            supervisionActivityService.recordModuleAct(orgId, propertyId, "rev", "pricing_pushed", summary);
        } catch (Exception e) {
            log.debug("Push prix: activite constellation non enregistree (listing {}): {}",
                mapping.getAirbnbListingId(), e.getMessage());
        }
    }
}
