package com.clenzy.scheduler;

import com.clenzy.repository.OrganizationRepository;
import com.clenzy.service.dashboard.ActionItemReconciler;
import com.clenzy.tenant.TenantScopedExecutor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Remet la file « à traiter » en accord avec la réalité, organisation par
 * organisation.
 *
 * <p>C'est ce balayage qui porte tout le coût de découverte — les vingt-cinq
 * requêtes qui partaient auparavant à <b>chaque affichage</b> du tableau de
 * bord. Elles partent désormais une fois toutes les cinq minutes, hors du
 * chemin de l'utilisateur, et l'écran ne fait plus qu'une lecture indexée.</p>
 *
 * <p><b>Contexte tenant explicite</b> : hors requête HTTP, {@code TenantFilter}
 * ne s'exécute pas et le filtre Hibernate d'isolation reste inactif. Sans
 * {@link TenantScopedExecutor}, une source lisant une entité filtrée verrait
 * <b>toutes les organisations</b> et écrirait les actions des unes dans la file
 * des autres.</p>
 */
@Service
public class ActionItemSweepScheduler {

    private static final Logger log = LoggerFactory.getLogger(ActionItemSweepScheduler.class);

    private final OrganizationRepository organizationRepository;
    private final ActionItemReconciler reconciler;
    private final TenantScopedExecutor tenantScopedExecutor;

    public ActionItemSweepScheduler(OrganizationRepository organizationRepository,
                                    ActionItemReconciler reconciler,
                                    TenantScopedExecutor tenantScopedExecutor) {
        this.organizationRepository = organizationRepository;
        this.reconciler = reconciler;
        this.tenantScopedExecutor = tenantScopedExecutor;
    }

    /**
     * Toutes les cinq minutes.
     *
     * <p>Le délai borne la fraîcheur : une anomalie née d'un changement de
     * données met au plus cinq minutes à apparaître. Les actions apprises par
     * webhook, elles, sont écrites immédiatement — elles ne dépendent pas de ce
     * balayage.</p>
     */
    @Scheduled(fixedDelay = 300_000)
    @SchedulerLock(name = "action-item-sweep", lockAtMostFor = "PT15M")
    public void sweep() {
        final List<Long> orgIds = organizationRepository.findAllIds();
        if (orgIds.isEmpty()) return;

        int swept = 0;
        for (Long orgId : orgIds) {
            try {
                // Une organisation dont le balayage échoue ne doit pas empêcher
                // les suivantes : leur file resterait figée sur un état ancien.
                tenantScopedExecutor.runAsOrganization(orgId, () -> reconciler.reconcile(orgId));
                swept++;
            } catch (RuntimeException e) {
                log.error("Balayage des actions en echec pour org={}", orgId, e);
            }
        }
        log.debug("Balayage des actions termine : {}/{} organisation(s)", swept, orgIds.size());
    }
}
