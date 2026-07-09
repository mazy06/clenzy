package com.clenzy.scheduler;

import com.clenzy.model.ServiceRequest;
import com.clenzy.model.WorkflowSettings;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.repository.WorkflowSettingsRepository;
import com.clenzy.service.ServiceRequestService;
import com.clenzy.service.agent.supervision.SupervisionActivityService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Job planifie pour re-tenter l'auto-assignation des SR PENDING non-assignees.
 *
 * Suit le pattern des schedulers par organisation (ex. ICalSyncScheduler) :
 * itere par organizationId, pas de TenantContext (hors web request).
 *
 * Frequence : toutes les 15 minutes.
 */
@Service
public class AutoAssignScheduler {

    private static final Logger log = LoggerFactory.getLogger(AutoAssignScheduler.class);

    private final ServiceRequestRepository serviceRequestRepository;
    private final WorkflowSettingsRepository workflowSettingsRepository;
    private final ServiceRequestService serviceRequestService;
    private final SupervisionActivityService supervisionActivityService;

    public AutoAssignScheduler(ServiceRequestRepository serviceRequestRepository,
                               WorkflowSettingsRepository workflowSettingsRepository,
                               ServiceRequestService serviceRequestService,
                               SupervisionActivityService supervisionActivityService) {
        this.serviceRequestRepository = serviceRequestRepository;
        this.workflowSettingsRepository = workflowSettingsRepository;
        this.serviceRequestService = serviceRequestService;
        this.supervisionActivityService = supervisionActivityService;
    }

    /**
     * Toutes les 15 minutes, cherche les SR PENDING non-assignees et retente
     * l'auto-assignation pour chaque organisation concernee.
     */
    @Scheduled(fixedDelay = 900_000) // 15 min
    @Transactional
    public void retryPendingAutoAssignment() {
        List<Long> orgIds = serviceRequestRepository
            .findOrganizationIdsWithPendingUnassigned(ServiceRequestService.MAX_AUTO_ASSIGN_RETRIES);

        if (orgIds.isEmpty()) return;

        int totalAssigned = 0;
        int totalFailed = 0;

        for (Long orgId : orgIds) {
            try {
                // Verifier si l'auto-assignation est activee pour cette org
                WorkflowSettings ws = workflowSettingsRepository.findByOrganizationId(orgId).orElse(null);
                if (ws != null && !ws.isAutoAssignInterventions()) {
                    log.debug("AutoAssignScheduler: auto-assignation desactivee pour org={}", orgId);
                    continue;
                }

                List<ServiceRequest> pendingSRs = serviceRequestRepository
                    .findPendingUnassignedForRetry(ServiceRequestService.MAX_AUTO_ASSIGN_RETRIES, orgId);

                for (ServiceRequest sr : pendingSRs) {
                    try {
                        boolean assigned = serviceRequestService.attemptAutoAssignByOrgId(sr, orgId);
                        if (assigned) {
                            totalAssigned++;
                            recordConstellationActivity(sr, orgId);
                        } else {
                            totalFailed++;
                        }
                    } catch (Exception e) {
                        totalFailed++;
                        log.error("AutoAssignScheduler: erreur pour SR {} (org={}): {}",
                            sr.getId(), orgId, e.getMessage());
                    }
                }
            } catch (Exception e) {
                log.error("AutoAssignScheduler: erreur pour org={}: {}", orgId, e.getMessage());
            }
        }

        if (totalAssigned > 0 || totalFailed > 0) {
            log.info("AutoAssignScheduler: {} assignees, {} echecs sur {} organisations",
                totalAssigned, totalFailed, orgIds.size());
        }
    }

    /**
     * Fait remonter l'auto-assignation reussie dans le feed « En direct » de la CONSTELLATION du
     * logement concerne (agent Operations « ops »). Le logement est celui de la demande — non-null
     * des lors que l'assignation a reussi (l'auto-assignation exige {@code sr.getProperty() != null}).
     * Best-effort : un echec ne doit JAMAIS casser le scheduler ({@code recordModuleAct} est
     * lui-meme best-effort et {@code @Transactional} cote service).
     */
    private void recordConstellationActivity(ServiceRequest sr, Long orgId) {
        try {
            Long propertyId = sr.getProperty() != null ? sr.getProperty().getId() : null;
            if (propertyId == null) {
                return; // demande sans logement rattachable → rien a afficher dans une constellation
            }
            String label = sr.getTitle() != null && !sr.getTitle().isBlank() ? sr.getTitle() : "intervention";
            supervisionActivityService.recordModuleAct(orgId, propertyId, "ops", "intervention_assigned",
                "Intervenant assigne automatiquement a l'intervention « " + label + " » sur ce logement");
        } catch (Exception e) {
            log.debug("AutoAssignScheduler: activite constellation non enregistree (SR {}): {}",
                sr.getId(), e.getMessage());
        }
    }
}
