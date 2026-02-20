package com.clenzy.scheduler;

import com.clenzy.model.ICalFeed;
import com.clenzy.repository.ICalFeedRepository;
import com.clenzy.service.ICalImportService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Scheduler pour la synchronisation automatique des feeds iCal.
 * Execute toutes les 3 heures pour re-importer les reservations
 * avec dedoublonnage automatique par UID.
 *
 * Multi-tenant : s'execute HORS contexte HTTP (pas de TenantFilter/TenantContext).
 * Le Hibernate @Filter n'est pas actif — les queries retournent les feeds de toutes les orgs.
 * Le traitement est groupe par organization_id pour :
 * - Isoler les erreurs (un echec sur une org ne bloque pas les autres)
 * - Permettre la tracabilite par tenant dans les logs
 */
@Component
public class ICalSyncScheduler {

    private static final Logger log = LoggerFactory.getLogger(ICalSyncScheduler.class);

    private final ICalImportService iCalImportService;
    private final ICalFeedRepository iCalFeedRepository;

    public ICalSyncScheduler(ICalImportService iCalImportService,
                             ICalFeedRepository iCalFeedRepository) {
        this.iCalImportService = iCalImportService;
        this.iCalFeedRepository = iCalFeedRepository;
    }

    /**
     * Synchronise tous les feeds iCal actifs toutes les 3 heures.
     * Ne synchronise que les feeds dont syncEnabled = true
     * et dont le proprietaire a un forfait Confort ou Premium.
     *
     * Groupement par organisation pour isoler les erreurs entre tenants.
     */
    @Scheduled(fixedRate = 3 * 60 * 60 * 1000, initialDelay = 60 * 1000)
    public void syncActiveFeeds() {
        log.info("Demarrage synchro iCal planifiee...");

        List<ICalFeed> activeFeeds = iCalFeedRepository.findBySyncEnabledTrue();
        if (activeFeeds.isEmpty()) {
            log.info("Aucun feed iCal actif a synchroniser");
            return;
        }

        // Grouper par organization_id pour isoler les traitements par tenant
        Map<Long, List<ICalFeed>> feedsByOrg = activeFeeds.stream()
                .filter(f -> f.getProperty() != null && f.getProperty().getOrganizationId() != null)
                .collect(Collectors.groupingBy(f -> f.getProperty().getOrganizationId()));

        int totalOrgs = feedsByOrg.size();
        int successOrgs = 0;
        int failedOrgs = 0;

        for (Map.Entry<Long, List<ICalFeed>> entry : feedsByOrg.entrySet()) {
            Long orgId = entry.getKey();
            List<ICalFeed> orgFeeds = entry.getValue();

            try {
                log.info("Synchro iCal org={} : {} feeds", orgId, orgFeeds.size());
                iCalImportService.syncFeeds(orgFeeds);
                successOrgs++;
            } catch (Exception e) {
                failedOrgs++;
                log.error("Erreur synchro iCal pour org={} ({} feeds): {}",
                        orgId, orgFeeds.size(), e.getMessage());
            }
        }

        log.info("Synchro iCal terminee : {}/{} orgs OK, {} erreurs",
                successOrgs, totalOrgs, failedOrgs);
    }
}
