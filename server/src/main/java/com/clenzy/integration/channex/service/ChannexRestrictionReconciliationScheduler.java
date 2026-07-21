package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.config.ChannexProperties;
import com.clenzy.integration.channex.dto.RestrictionDivergence;
import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.model.ChannexSyncStatus;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.clenzy.model.BookingRestriction;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.Property;
import com.clenzy.repository.BookingRestrictionRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.NotificationService;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * Réconciliation périodique des restrictions de séjour Clenzy ↔ OTA (Channex) — CLZ Domaine 1.
 *
 * <p>Pendant restrictions du {@link ChannexRatesReconciliationScheduler} (qui ne couvre que les
 * <b>prix</b>). Pour chaque mapping ACTIVE : pull les restrictions Channex sur 30 jours, résout
 * la restriction locale par date, et signale (watchdog + notification admin groupée) toute
 * divergence détectée par {@link RestrictionDivergenceDetector}.</p>
 *
 * <p>Best-effort : un échec sur un mapping n'arrête pas les autres. Skip si l'API Channex n'est
 * pas configurée. Fréquence : 3 h par défaut (les restrictions changent moins souvent que les prix).</p>
 */
@Service
public class ChannexRestrictionReconciliationScheduler {

    private static final Logger log = LoggerFactory.getLogger(ChannexRestrictionReconciliationScheduler.class);
    private static final int RECONCILIATION_DAYS = 30;

    private final ChannexPropertyMappingRepository mappingRepository;
    private final ChannexClient channexClient;
    private final BookingRestrictionRepository bookingRestrictionRepository;
    private final PropertyRepository propertyRepository;
    private final NotificationService notificationService;
    private final ChannexProperties channexProperties;
    private final RestrictionDivergenceDetector divergenceDetector;

    public ChannexRestrictionReconciliationScheduler(ChannexPropertyMappingRepository mappingRepository,
                                                     ChannexClient channexClient,
                                                     BookingRestrictionRepository bookingRestrictionRepository,
                                                     PropertyRepository propertyRepository,
                                                     NotificationService notificationService,
                                                     ChannexProperties channexProperties,
                                                     RestrictionDivergenceDetector divergenceDetector) {
        this.mappingRepository = mappingRepository;
        this.channexClient = channexClient;
        this.bookingRestrictionRepository = bookingRestrictionRepository;
        this.propertyRepository = propertyRepository;
        this.notificationService = notificationService;
        this.channexProperties = channexProperties;
        this.divergenceDetector = divergenceDetector;
    }

    @Scheduled(fixedRateString = "#{${clenzy.channex.restriction-reconciliation.interval-minutes:180} * 60000}",
               initialDelayString = "${clenzy.channex.restriction-reconciliation.initial-delay-ms:180000}")
    @SchedulerLock(name = "channex-restriction-reconciliation", lockAtMostFor = "PT30M")
    public void scan() {
        if (!channexProperties.isConfigured()) {
            log.debug("ChannexRestrictionReconciliation: scan skip (CHANNEX_API_KEY non configuree)");
            return;
        }
        long start = System.currentTimeMillis();
        try {
            List<ChannexPropertyMapping> mappings = mappingRepository.findAllAcrossOrgs();
            int reconciled = 0;
            int propertiesWithDivergence = 0;
            for (ChannexPropertyMapping mapping : mappings) {
                if (mapping.getSyncStatus() != ChannexSyncStatus.ACTIVE) continue;
                try {
                    if (reconcileMapping(mapping)) propertiesWithDivergence++;
                    reconciled++;
                } catch (Exception e) {
                    log.warn("ChannexRestrictionReconciliation: mapping {} KO: {}",
                        mapping.getId(), e.getMessage());
                }
            }
            log.info("ChannexRestrictionReconciliation: scan termine en {}ms — mappings={} divergents={}",
                System.currentTimeMillis() - start, reconciled, propertiesWithDivergence);
        } catch (Exception e) {
            log.error("ChannexRestrictionReconciliation: scan KO — {}", e.getMessage(), e);
        }
    }

    /** Réconcilie un mapping. Renvoie true si au moins une date diverge (et notifie). */
    boolean reconcileMapping(ChannexPropertyMapping mapping) {
        if (mapping.getChannexDefaultRatePlanId() == null) return false;
        Optional<Property> propertyOpt = propertyRepository.findById(mapping.getClenzyPropertyId());
        if (propertyOpt.isEmpty()) return false;
        Property property = propertyOpt.get();

        LocalDate from = LocalDate.now();
        LocalDate to = from.plusDays(RECONCILIATION_DAYS);

        Optional<List<JsonNode>> opt = channexClient.fetchRatesForRange(
            mapping.getChannexPropertyId(), mapping.getChannexDefaultRatePlanId(), from, to);
        if (opt.isEmpty() || opt.get().isEmpty()) return false;

        List<BookingRestriction> applicable = bookingRestrictionRepository.findApplicable(
            property.getId(), from, to.plusDays(1), property.getOrganizationId());

        int divergentDates = 0;
        for (JsonNode entry : opt.get()) {
            try {
                JsonNode attrs = entry.path("attributes");
                String dateStr = attrs.path("date").asText(null);
                if (dateStr == null) continue;
                LocalDate date = LocalDate.parse(dateStr);
                BookingRestriction local = pickHighestPriorityFor(applicable, date);
                List<RestrictionDivergence> divergences = divergenceDetector.detect(local, attrs);
                if (!divergences.isEmpty()) {
                    divergentDates++;
                    log.debug("ChannexRestrictionReconciliation: divergence property={} date={} -> {}",
                        property.getId(), date, divergences);
                }
            } catch (Exception e) {
                log.warn("ChannexRestrictionReconciliation: entry KO property={}: {}",
                    property.getId(), e.getMessage());
            }
        }

        if (divergentDates > 0) {
            notifyDivergence(property, divergentDates);
            return true;
        }
        return false;
    }

    private void notifyDivergence(Property property, int divergentDates) {
        try {
            String name = property.getName() != null ? property.getName() : "Propriete #" + property.getId();
            notificationService.notifyAdminsAndManagers(
                NotificationKey.CHANNEX_RESTRICTION_DRIFT_DETECTED,
                "Divergence de restrictions avec Channex",
                "« " + name + " » : " + divergentDates + " date" + (divergentDates > 1 ? "s" : "")
                    + " avec des restrictions de sejour (min stay / CTA / CTD) differentes cote OTA. "
                    + "Re-synchroniser depuis le PMS.",
                "/properties?diagnoseChannex=" + property.getId(),
                property.getOrganizationId()
            );
        } catch (Exception e) {
            log.warn("ChannexRestrictionReconciliation: notification KO property={}: {}",
                property.getId(), e.getMessage());
        }
    }

    /**
     * Restriction la plus prioritaire couvrant {@code date} (findApplicable renvoie deja trie par
     * priority DESC). Même logique que {@code ChannexSyncService.pickHighestPriorityFor}.
     */
    private BookingRestriction pickHighestPriorityFor(List<BookingRestriction> applicables, LocalDate date) {
        for (BookingRestriction br : applicables) {
            if (date.isBefore(br.getStartDate()) || date.isAfter(br.getEndDate())) continue;
            Integer[] dow = br.getDaysOfWeek();
            if (dow != null && dow.length > 0) {
                int weekday = date.getDayOfWeek().getValue();
                boolean matches = false;
                for (Integer d : dow) if (d != null && d == weekday) { matches = true; break; }
                if (!matches) continue;
            }
            return br;
        }
        return null;
    }
}
