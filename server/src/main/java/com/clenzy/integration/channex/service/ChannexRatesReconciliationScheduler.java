package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.model.ChannexPriceDrift;
import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.model.ChannexSyncStatus;
import com.clenzy.integration.channex.repository.ChannexPriceDriftRepository;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.PriceSourceOfTruth;
import com.clenzy.model.Property;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.NotificationService;
import com.clenzy.service.PriceEngine;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Reconciliation periodique des prix Clenzy ↔ OTA — Phase 3 OTA pricing.
 *
 * <p>Pour chaque mapping Channex ACTIVE de toutes les orgs :</p>
 * <ol>
 *   <li>Pull les rates Channex sur les 30 prochains jours</li>
 *   <li>Resout le prix Clenzy par date via {@link PriceEngine}</li>
 *   <li>Si ecart > {@link #DRIFT_THRESHOLD} → persiste un
 *       {@link ChannexPriceDrift} actif (idempotent par (property, date)) +
 *       notifie les admins/managers de l'org</li>
 * </ol>
 *
 * <p><b>Strategie de notification</b> : on notifie 1x par scan ou il y a au
 * moins 1 drift detecte (groupage). Pas de notification si tout est OK.</p>
 *
 * <p><b>Default off pour les properties en mode {@link PriceSourceOfTruth#OTA}</b> :
 * dans ce mode, l'OTA est la verite — on ne flag pas les ecarts (on est
 * suppose suivre l'OTA, pas pusher).</p>
 *
 * <p>Frequence : 1 heure par defaut. Override via
 * {@code clenzy.channex.reconciliation.interval-minutes}.</p>
 */
@Service
public class ChannexRatesReconciliationScheduler {

    private static final Logger log = LoggerFactory.getLogger(ChannexRatesReconciliationScheduler.class);

    /** Seuil d'ecart en euros au-dessus duquel on signale un drift. */
    private static final BigDecimal DRIFT_THRESHOLD = new BigDecimal("0.50");

    /** Fenetre de reconciliation. */
    private static final int RECONCILIATION_DAYS = 30;

    private final ChannexPropertyMappingRepository mappingRepository;
    private final ChannexPriceDriftRepository driftRepository;
    private final ChannexClient channexClient;
    private final PriceEngine priceEngine;
    private final PropertyRepository propertyRepository;
    private final NotificationService notificationService;

    public ChannexRatesReconciliationScheduler(ChannexPropertyMappingRepository mappingRepository,
                                                 ChannexPriceDriftRepository driftRepository,
                                                 ChannexClient channexClient,
                                                 PriceEngine priceEngine,
                                                 PropertyRepository propertyRepository,
                                                 NotificationService notificationService) {
        this.mappingRepository = mappingRepository;
        this.driftRepository = driftRepository;
        this.channexClient = channexClient;
        this.priceEngine = priceEngine;
        this.propertyRepository = propertyRepository;
        this.notificationService = notificationService;
    }

    /**
     * Scan periodique de tous les mappings ACTIVE. Best-effort : un echec sur
     * un mapping n'arrete pas les autres.
     */
    @Scheduled(fixedRateString = "#{${clenzy.channex.reconciliation.interval-minutes:60} * 60000}",
               initialDelayString = "${clenzy.channex.reconciliation.initial-delay-ms:120000}")
    public void scan() {
        long start = System.currentTimeMillis();
        try {
            List<ChannexPropertyMapping> mappings = mappingRepository.findAllAcrossOrgs();
            int reconciled = 0;
            int driftsCreated = 0;
            for (ChannexPropertyMapping mapping : mappings) {
                if (mapping.getSyncStatus() != ChannexSyncStatus.ACTIVE) continue;
                try {
                    int n = reconcileMapping(mapping);
                    driftsCreated += n;
                    reconciled++;
                } catch (Exception e) {
                    log.warn("ChannexReconciliation: mapping {} KO: {}",
                        mapping.getId(), e.getMessage());
                }
            }
            log.info("ChannexReconciliation: scan termine en {}ms — mappings={} drifts_created={}",
                System.currentTimeMillis() - start, reconciled, driftsCreated);
        } catch (Exception e) {
            log.error("ChannexReconciliation: scan KO — {}", e.getMessage(), e);
        }
    }

    /**
     * Reconcilie un mapping unique. Retourne le nb de drifts crees/updates
     * pour ce mapping.
     */
    private int reconcileMapping(ChannexPropertyMapping mapping) {
        Optional<Property> propertyOpt = propertyRepository.findById(mapping.getClenzyPropertyId());
        if (propertyOpt.isEmpty()) return 0;
        Property property = propertyOpt.get();

        // Skip si la property est en mode OTA (l'OTA est la verite, on ne
        // flag pas les ecarts → on est suppose suivre)
        if (property.getPriceSourceOfTruth() == PriceSourceOfTruth.OTA) {
            log.debug("ChannexReconciliation: skip property={} (mode OTA, pas de drift)",
                property.getId());
            return 0;
        }

        if (mapping.getChannexDefaultRatePlanId() == null) return 0;

        LocalDate from = LocalDate.now();
        LocalDate to = from.plusDays(RECONCILIATION_DAYS);

        // Pull OTA
        Optional<List<JsonNode>> opt = channexClient.fetchRatesForRange(
            mapping.getChannexPropertyId(), mapping.getChannexDefaultRatePlanId(), from, to);
        if (opt.isEmpty() || opt.get().isEmpty()) {
            log.debug("ChannexReconciliation: pas de rates Channex disponibles property={}",
                property.getId());
            return 0;
        }

        // Resolution Clenzy en batch (1 query)
        Map<LocalDate, BigDecimal> clenzyPrices = priceEngine.resolvePriceRange(
            property.getId(), from, to.plusDays(1), property.getOrganizationId());

        int driftsCreated = 0;
        boolean propertyHasDrifts = false;

        for (JsonNode entry : opt.get()) {
            try {
                JsonNode attrs = entry.path("attributes");
                String dateStr = attrs.path("date").asText(null);
                String rateStr = attrs.path("rate").asText(null);
                if (dateStr == null || rateStr == null || rateStr.isBlank()) continue;

                LocalDate date = LocalDate.parse(dateStr);
                BigDecimal otaPrice = new BigDecimal(rateStr);
                BigDecimal clenzyPrice = clenzyPrices.get(date);
                if (clenzyPrice == null) continue; // PriceEngine retourne null si rien

                BigDecimal diff = clenzyPrice.subtract(otaPrice).abs();
                if (diff.compareTo(DRIFT_THRESHOLD) <= 0) continue; // sous le seuil, OK

                // Upsert drift (idempotent par property, date)
                ChannexPriceDrift drift = driftRepository
                    .findActiveByPropertyAndDate(property.getId(), date)
                    .orElseGet(ChannexPriceDrift::new);
                drift.setOrganizationId(property.getOrganizationId());
                drift.setClenzyPropertyId(property.getId());
                drift.setMappingId(mapping.getId());
                drift.setDriftDate(date);
                drift.setClenzyPrice(clenzyPrice);
                drift.setOtaPrice(otaPrice);
                drift.setCurrency(property.getDefaultCurrency() != null
                    ? property.getDefaultCurrency() : "EUR");
                drift.setDetectedAt(Instant.now());
                drift.setResolution(null);
                drift.setResolvedAt(null);
                driftRepository.save(drift);
                driftsCreated++;
                propertyHasDrifts = true;
            } catch (Exception e) {
                log.warn("ChannexReconciliation: erreur sur entry property={}: {}",
                    property.getId(), e.getMessage());
            }
        }

        if (propertyHasDrifts) {
            notifyDriftDetected(property, driftsCreated);
        }
        return driftsCreated;
    }

    /**
     * Notifie les admins/managers d'une org qu'un ou plusieurs drifts ont ete
     * detectes sur une property. Un drift = une (property, date) avec un ecart
     * de prix Clenzy ↔ OTA. Groupage en 1 notification par scan pour eviter
     * le spam.
     */
    private void notifyDriftDetected(Property property, int newOrUpdatedDrifts) {
        try {
            String propertyName = property.getName() != null
                ? property.getName() : "Propriete #" + property.getId();
            notificationService.notifyAdminsAndManagers(
                NotificationKey.CHANNEX_PRICE_DRIFT_DETECTED,
                "Ecart de prix detecte avec Channex",
                "« " + propertyName + " » : " + newOrUpdatedDrifts + " date"
                    + (newOrUpdatedDrifts > 1 ? "s" : "")
                    + " avec un prix Clenzy different du prix OTA. "
                    + "Verifier le tableau de conflits pour resoudre.",
                "/properties/" + property.getId() + "?tab=pricing-drifts",
                property.getOrganizationId()
            );
        } catch (Exception e) {
            log.warn("ChannexReconciliation: notification drift KO property={}: {}",
                property.getId(), e.getMessage());
        }
    }
}
