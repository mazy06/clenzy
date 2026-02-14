package com.clenzy.scheduler;

import com.clenzy.service.ICalImportService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Scheduler pour la synchronisation automatique des feeds iCal.
 * Execute toutes les 3 heures pour re-importer les reservations
 * avec dedoublonnage automatique par UID.
 */
@Component
public class ICalSyncScheduler {

    private static final Logger log = LoggerFactory.getLogger(ICalSyncScheduler.class);

    private final ICalImportService iCalImportService;

    public ICalSyncScheduler(ICalImportService iCalImportService) {
        this.iCalImportService = iCalImportService;
    }

    /**
     * Synchronise tous les feeds iCal actifs toutes les 3 heures.
     * Ne synchronise que les feeds dont syncEnabled = true
     * et dont le proprietaire a un forfait Confort ou Premium.
     */
    @Scheduled(fixedRate = 3 * 60 * 60 * 1000, initialDelay = 60 * 1000)
    public void syncActiveFeeds() {
        log.info("Demarrage synchro iCal planifiee...");
        try {
            iCalImportService.syncAllActiveFeeds();
            log.info("Synchro iCal planifiee terminee avec succes");
        } catch (Exception e) {
            log.error("Erreur lors de la synchro iCal planifiee: {}", e.getMessage(), e);
        }
    }
}
