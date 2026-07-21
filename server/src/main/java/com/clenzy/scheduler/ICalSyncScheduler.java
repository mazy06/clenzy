package com.clenzy.scheduler;

import com.clenzy.model.ICalFeed;
import com.clenzy.repository.ICalFeedRepository;
import com.clenzy.service.ICalImportService;
import com.clenzy.tenant.TenantScopedExecutor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Scheduler pour la synchronisation automatique des feeds iCal.
 * Execute toutes les 3 heures pour re-importer les reservations
 * avec dedoublonnage automatique par UID.
 *
 * Multi-tenant : s'execute HORS contexte HTTP (pas de TenantFilter), donc le
 * filtre Hibernate {@code organizationFilter} n'est jamais active par la
 * security chain. Chaque iteration par org est deleguee a
 * {@link TenantScopedExecutor} qui pose le TenantContext, active le filtre
 * Hibernate sur la Session liee au thread et nettoie TOUT en finally
 * (contrat de securite ThreadLocal — le thread sched-* est partage par tous
 * les @Scheduled). On cree aussi un RequestAttributes synthetique pour les
 * eventuels beans @RequestScope.
 * Le traitement est groupe par organization_id pour isoler les erreurs.
 */
@Component
public class ICalSyncScheduler {

    private static final Logger log = LoggerFactory.getLogger(ICalSyncScheduler.class);

    private final ICalImportService iCalImportService;
    private final ICalFeedRepository iCalFeedRepository;
    private final TenantScopedExecutor tenantScopedExecutor;

    public ICalSyncScheduler(ICalImportService iCalImportService,
                             ICalFeedRepository iCalFeedRepository,
                             TenantScopedExecutor tenantScopedExecutor) {
        this.iCalImportService = iCalImportService;
        this.iCalFeedRepository = iCalFeedRepository;
        this.tenantScopedExecutor = tenantScopedExecutor;
    }

    /**
     * Synchronise tous les feeds iCal actifs toutes les 3 heures.
     * Ne synchronise que les feeds dont syncEnabled = true
     * et dont le proprietaire a un forfait Confort ou Premium.
     *
     * Groupement par organisation pour isoler les erreurs entre tenants.
     */
    @Scheduled(fixedRate = 3 * 60 * 60 * 1000, initialDelay = 60 * 1000)
    @SchedulerLock(name = "ical-sync-feeds", lockAtMostFor = "PT30M")
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
                // Request scope synthetique pour les eventuels beans @RequestScope
                RequestContextHolder.setRequestAttributes(new SchedulerRequestAttributes());

                log.info("Synchro iCal org={} : {} feeds", orgId, orgFeeds.size());
                // Z2-EFFETS-02 : execution tenant-scoped — TenantContext pose +
                // filtre Hibernate organizationFilter actif sur la Session liee
                // au thread (aligne l'isolation sur celle des requetes HTTP),
                // nettoyage TenantContext + EntityManager en finally cote executor.
                tenantScopedExecutor.runAsOrganization(orgId,
                        () -> iCalImportService.syncFeeds(orgFeeds));
                successOrgs++;
            } catch (Exception e) {
                failedOrgs++;
                log.error("Erreur synchro iCal pour org={} ({} feeds): {}",
                        orgId, orgFeeds.size(), e.getMessage());
            } finally {
                // RequestAttributes synthetique (le TenantContext, lui, est purge
                // par TenantScopedExecutor dans son propre finally).
                RequestContextHolder.resetRequestAttributes();
            }
        }

        log.info("Synchro iCal terminee : {}/{} orgs OK, {} erreurs",
                successOrgs, totalOrgs, failedOrgs);
    }

    /**
     * Implementation minimale de RequestAttributes pour les schedulers.
     * Permet aux beans @RequestScope d'etre crees hors contexte HTTP.
     */
    private static class SchedulerRequestAttributes implements RequestAttributes {
        private final Map<String, Object> attributes = new HashMap<>();

        @Override
        public Object getAttribute(String name, int scope) {
            return attributes.get(name);
        }

        @Override
        public void setAttribute(String name, Object value, int scope) {
            attributes.put(name, value);
        }

        @Override
        public void removeAttribute(String name, int scope) {
            attributes.remove(name);
        }

        @Override
        public String[] getAttributeNames(int scope) {
            return attributes.keySet().toArray(new String[0]);
        }

        @Override
        public void registerDestructionCallback(String name, Runnable callback, int scope) {
            // No-op for scheduler context
        }

        @Override
        public Object resolveReference(String key) {
            return null;
        }

        @Override
        public String getSessionId() {
            return "ical-sync-scheduler";
        }

        @Override
        public Object getSessionMutex() {
            return this;
        }
    }
}
