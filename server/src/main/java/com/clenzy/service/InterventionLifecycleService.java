package com.clenzy.service;

import com.clenzy.config.KafkaConfig;
import com.clenzy.dto.InterventionResponse;
import com.clenzy.exception.NotFoundException;
import com.clenzy.exception.UnauthorizedException;
import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.UserRole;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.tenant.TenantContext;
import com.clenzy.util.JwtRoleExtractor;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Map;

@Service
@Transactional
public class InterventionLifecycleService {

    private static final Logger log = LoggerFactory.getLogger(InterventionLifecycleService.class);

    /** Max progress on reopen -- below 100% to prevent auto-completion triggers */
    private static final int REOPEN_MAX_PROGRESS = 89;

    private final InterventionRepository interventionRepository;
    private final InterventionMapper interventionMapper;
    private final InterventionAccessPolicy accessPolicy;
    private final NotificationService notificationService;
    private final OutboxPublisher outboxPublisher;
    private final ObjectMapper objectMapper;
    private final TenantContext tenantContext;

    public InterventionLifecycleService(InterventionRepository interventionRepository,
                                        InterventionMapper interventionMapper,
                                        InterventionAccessPolicy accessPolicy,
                                        NotificationService notificationService,
                                        OutboxPublisher outboxPublisher,
                                        ObjectMapper objectMapper,
                                        TenantContext tenantContext) {
        this.interventionRepository = interventionRepository;
        this.interventionMapper = interventionMapper;
        this.accessPolicy = accessPolicy;
        this.notificationService = notificationService;
        this.outboxPublisher = outboxPublisher;
        this.objectMapper = objectMapper;
        this.tenantContext = tenantContext;
    }

    /**
     * Demarrer une intervention (changer le statut en IN_PROGRESS).
     * Accessible aux TECHNICIAN, HOUSEKEEPER et SUPERVISOR pour leurs interventions assignees.
     */
    public InterventionResponse startIntervention(Long id, Jwt jwt) {
        Intervention intervention = interventionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Intervention non trouvee"));

        accessPolicy.assertCanAccess(intervention, jwt);

        InterventionStatus currentStatus = intervention.getStatus();
        if (currentStatus == InterventionStatus.COMPLETED || currentStatus == InterventionStatus.CANCELLED) {
            throw new IllegalStateException("Impossible de demarrer une intervention au statut " + currentStatus.name());
        }
        currentStatus.assertCanTransitionTo(InterventionStatus.IN_PROGRESS);

        // Empecher le demarrage avant la date planifiee
        if (intervention.getScheduledDate() != null
                && LocalDateTime.now().isBefore(intervention.getScheduledDate())) {
            throw new IllegalStateException(
                    "Impossible de demarrer avant la date planifiee (" + intervention.getScheduledDate() + ")");
        }

        intervention.setStatus(InterventionStatus.IN_PROGRESS);
        intervention.setStartTime(LocalDateTime.now());

        if (intervention.getProgressPercentage() == null || intervention.getProgressPercentage() == 0) {
            intervention.setProgressPercentage(0);
        }

        intervention = interventionRepository.save(intervention);
        log.debug("Intervention started: id={}, status={}", intervention.getId(), intervention.getStatus());

        // Notifications
        try {
            String actionUrl = "/interventions/" + intervention.getId();
            String ownerKeycloakId = intervention.getProperty() != null && intervention.getProperty().getOwner() != null
                    ? intervention.getProperty().getOwner().getKeycloakId() : null;
            notificationService.notify(ownerKeycloakId, NotificationKey.INTERVENTION_STARTED,
                    "Intervention demarree",
                    "L'intervention '" + intervention.getTitle() + "' a ete demarree.",
                    actionUrl);
            notificationService.notifyAdminsAndManagers(NotificationKey.INTERVENTION_STARTED,
                    "Intervention demarree",
                    "L'intervention '" + intervention.getTitle() + "' a ete demarree.",
                    actionUrl);
        } catch (Exception e) {
            log.warn("Notification error startIntervention: {}", e.getMessage());
        }

        // Generation automatique du BON_INTERVENTION via outbox (post-commit safe)
        try {
            String emailTo = "";
            if (intervention.getAssignedUser() != null && intervention.getAssignedUser().getEmail() != null) {
                emailTo = intervention.getAssignedUser().getEmail();
            } else if (intervention.getProperty() != null && intervention.getProperty().getOwner() != null) {
                emailTo = intervention.getProperty().getOwner().getEmail();
            }

            String payload = objectMapper.writeValueAsString(Map.of(
                    "documentType", "BON_INTERVENTION",
                    "referenceId", intervention.getId(),
                    "referenceType", "intervention",
                    "emailTo", emailTo != null ? emailTo : "",
                    "organizationId", intervention.getOrganizationId()
            ));
            outboxPublisher.publish(
                    "INTERVENTION", String.valueOf(intervention.getId()),
                    "BON_INTERVENTION",
                    KafkaConfig.TOPIC_DOCUMENT_GENERATE,
                    "bon-intervention-" + intervention.getId(),
                    payload, intervention.getOrganizationId()
            );
            log.debug("Outbox BON_INTERVENTION event persisted for intervention: {}", intervention.getId());
        } catch (Exception e) {
            log.error("Outbox persist error BON_INTERVENTION: {}", e.getMessage(), e);
            try {
                notificationService.notifyAdminsAndManagers(
                    NotificationKey.DOCUMENT_GENERATION_FAILED,
                    "Erreur generation document",
                    "Le document BON_INTERVENTION pour l'intervention #" + intervention.getId() + " n'a pas pu etre genere. Erreur: " + e.getMessage(),
                    "/interventions/" + intervention.getId()
                );
            } catch (Exception ignored) {
                // Best-effort notification
            }
        }

        return interventionMapper.convertToResponse(intervention);
    }

    /**
     * Terminer explicitement une intervention.
     * Chemin principal pour le bouton "Terminer" du frontend.
     */
    public InterventionResponse completeIntervention(Long id, Jwt jwt) {
        Intervention intervention = interventionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Intervention non trouvee"));

        accessPolicy.assertCanAccess(intervention, jwt);

        // Idempotency guard: if already completed, return current state without side effects
        if (intervention.getStatus() == InterventionStatus.COMPLETED) {
            return interventionMapper.convertToResponse(intervention);
        }

        if (!intervention.getStatus().canTransitionTo(InterventionStatus.COMPLETED)) {
            throw new IllegalStateException(
                    "Impossible de terminer une intervention au statut " + intervention.getStatus().name());
        }

        intervention.setStatus(InterventionStatus.COMPLETED);
        intervention.setProgressPercentage(100);
        intervention.setCompletedAt(LocalDateTime.now());
        if (intervention.getEndTime() == null) {
            intervention.setEndTime(LocalDateTime.now());
        }

        intervention = interventionRepository.save(intervention);
        log.debug("Intervention completed: id={}", intervention.getId());

        // Notifications and outbox events AFTER save (entity has ID and state committed to JPA context)
        notifyInterventionCompleted(intervention);
        publishValidationFinMissionDocuments(intervention);

        return interventionMapper.convertToResponse(intervention);
    }

    /**
     * Rouvrir une intervention terminee pour permettre des modifications.
     * Accessible aux TECHNICIAN, HOUSEKEEPER, SUPERVISOR, MANAGER et ADMIN.
     */
    public InterventionResponse reopenIntervention(Long id, Jwt jwt) {
        Intervention intervention = interventionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Intervention non trouvee"));

        accessPolicy.assertCanAccess(intervention, jwt);

        if (!intervention.getStatus().canTransitionTo(InterventionStatus.IN_PROGRESS)) {
            throw new IllegalStateException("Impossible de rouvrir une intervention au statut " + intervention.getStatus().name());
        }

        intervention.setStatus(InterventionStatus.IN_PROGRESS);
        intervention.setCompletedAt(null);
        intervention.setEndTime(null);

        // Retirer "after_photos" des completedSteps pour forcer la re-validation de l'etape 3
        removeStepFromCompletedSteps(intervention, "after_photos");

        // Recalculer la progression : sans after_photos, jamais 100%
        if (intervention.getProgressPercentage() != null && intervention.getProgressPercentage() >= 100) {
            intervention.setProgressPercentage(REOPEN_MAX_PROGRESS);
            log.debug("Progress capped at 89% on reopen (after_photos step removed)");
        }

        intervention = interventionRepository.save(intervention);
        log.debug("Intervention reopened: id={}, status={}, progress={}%", intervention.getId(), intervention.getStatus(), intervention.getProgressPercentage());

        // Notifications
        try {
            String actionUrl = "/interventions/" + intervention.getId();
            String ownerKeycloakId = intervention.getProperty() != null && intervention.getProperty().getOwner() != null
                    ? intervention.getProperty().getOwner().getKeycloakId() : null;
            notificationService.notify(ownerKeycloakId, NotificationKey.INTERVENTION_REOPENED,
                    "Intervention rouverte",
                    "L'intervention '" + intervention.getTitle() + "' a ete rouverte pour modifications.",
                    actionUrl);
            notificationService.notifyAdminsAndManagers(NotificationKey.INTERVENTION_REOPENED,
                    "Intervention rouverte",
                    "L'intervention '" + intervention.getTitle() + "' a ete rouverte.",
                    actionUrl);
        } catch (Exception e) {
            log.warn("Notification error reopenIntervention: {}", e.getMessage());
        }

        return interventionMapper.convertToResponse(intervention);
    }

    public InterventionResponse updateStatus(Long id, String status, Jwt jwt) {
        Intervention intervention = interventionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Intervention non trouvee"));

        accessPolicy.assertCanAccess(intervention, jwt);

        InterventionStatus newStatus = InterventionStatus.fromString(status);

        // Only ADMIN, MANAGER, or SUPER_ADMIN can cancel an intervention
        if (newStatus == InterventionStatus.CANCELLED) {
            UserRole userRole = JwtRoleExtractor.extractUserRole(jwt);
            if (!userRole.isPlatformStaff()) {
                throw new org.springframework.security.access.AccessDeniedException(
                        "Seuls les administrateurs et managers peuvent annuler des interventions");
            }
        }

        // Validate state machine transition
        InterventionStatus currentStatus = intervention.getStatus();
        if (!currentStatus.canTransitionTo(newStatus)) {
            throw new IllegalStateException(
                    "Transition invalide : " + currentStatus.name() + " -> " + newStatus.name()
                    + ". Transitions autorisees depuis " + currentStatus.name() + " : "
                    + java.util.Arrays.toString(
                        java.util.stream.Stream.of(InterventionStatus.values())
                            .filter(currentStatus::canTransitionTo)
                            .map(Enum::name)
                            .toArray()));
        }

        intervention.setStatus(newStatus);
        intervention = interventionRepository.save(intervention);

        // Notifications
        try {
            String actionUrl = "/interventions/" + intervention.getId();
            String ownerKeycloakId = intervention.getProperty() != null && intervention.getProperty().getOwner() != null
                    ? intervention.getProperty().getOwner().getKeycloakId() : null;

            if (newStatus == InterventionStatus.CANCELLED) {
                notificationService.notify(ownerKeycloakId, NotificationKey.INTERVENTION_CANCELLED,
                        "Intervention annulee",
                        "L'intervention '" + intervention.getTitle() + "' a ete annulee.",
                        actionUrl);
                notificationService.notifyAdminsAndManagers(NotificationKey.INTERVENTION_CANCELLED,
                        "Intervention annulee",
                        "L'intervention '" + intervention.getTitle() + "' a ete annulee.",
                        actionUrl);
            } else {
                notificationService.notify(ownerKeycloakId, NotificationKey.INTERVENTION_STATUS_CHANGED,
                        "Statut intervention modifie",
                        "L'intervention '" + intervention.getTitle() + "' est passee au statut " + newStatus.name() + ".",
                        actionUrl);
            }
        } catch (Exception e) {
            log.warn("Notification error updateStatus intervention: {}", e.getMessage());
        }

        return interventionMapper.convertToResponse(intervention);
    }

    /**
     * Valider une intervention et definir le cout estime (Manager uniquement).
     * Change le statut de AWAITING_VALIDATION a AWAITING_PAYMENT.
     */
    public InterventionResponse validateIntervention(Long id, java.math.BigDecimal estimatedCost, Jwt jwt) {
        Intervention intervention = interventionRepository.findById(id)
            .orElseThrow(() -> new NotFoundException("Intervention non trouvee"));

        // Verifier que seul un manager peut valider
        UserRole userRole = JwtRoleExtractor.extractUserRole(jwt);
        if (!userRole.isPlatformStaff()) {
            throw new UnauthorizedException("Seuls les administrateurs et managers peuvent valider des interventions");
        }

        // Verifier que l'intervention peut passer en AWAITING_PAYMENT
        intervention.getStatus().assertCanTransitionTo(InterventionStatus.AWAITING_PAYMENT);

        if (estimatedCost == null || estimatedCost.compareTo(java.math.BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Le cout estime doit etre un montant positif");
        }

        intervention.setEstimatedCost(estimatedCost);
        intervention.setStatus(InterventionStatus.AWAITING_PAYMENT);
        intervention = interventionRepository.save(intervention);

        // Notifications
        try {
            String actionUrl = "/interventions/" + intervention.getId();
            String ownerKeycloakId = intervention.getProperty() != null && intervention.getProperty().getOwner() != null
                    ? intervention.getProperty().getOwner().getKeycloakId() : null;
            notificationService.notify(ownerKeycloakId, NotificationKey.INTERVENTION_VALIDATED,
                    "Intervention validee",
                    "L'intervention '" + intervention.getTitle() + "' a ete validee. Cout estime: " + estimatedCost + " EUR.",
                    actionUrl);
            notificationService.notify(ownerKeycloakId, NotificationKey.INTERVENTION_AWAITING_PAYMENT,
                    "Paiement requis",
                    "Un paiement est requis pour l'intervention '" + intervention.getTitle() + "'. Montant: " + estimatedCost + " EUR.",
                    actionUrl);
        } catch (Exception e) {
            log.warn("Notification error validateIntervention: {}", e.getMessage());
        }

        return interventionMapper.convertToResponse(intervention);
    }

    // ── Private helpers ─────────────────────────────────────────────────────

    /**
     * Retire un step de la liste JSON completedSteps.
     * En cas de JSON malformed, reset a liste vide plutot que de laisser des donnees corrompues.
     */
    private void removeStepFromCompletedSteps(Intervention intervention, String stepToRemove) {
        String json = intervention.getCompletedSteps();
        if (json == null || json.isBlank()) return;

        try {
            java.util.List<String> steps = objectMapper.readValue(json,
                    new com.fasterxml.jackson.core.type.TypeReference<java.util.List<String>>() {});
            if (steps.remove(stepToRemove)) {
                intervention.setCompletedSteps(objectMapper.writeValueAsString(steps));
                log.debug("Removed '{}' from completedSteps, remaining: {}", stepToRemove, steps);
            }
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            log.error("Malformed completedSteps JSON for intervention={}: {}", intervention.getId(), e.getMessage());
            intervention.setCompletedSteps("[]");
        }
    }

    /**
     * Persist outbox events for VALIDATION_FIN_MISSION documents (host + technician).
     * The OutboxRelay will send them to Kafka after the transaction commits.
     */
    private void publishValidationFinMissionDocuments(Intervention intervention) {
        try {
            String emailToHost = (intervention.getProperty() != null && intervention.getProperty().getOwner() != null)
                    ? intervention.getProperty().getOwner().getEmail() : "";
            String emailToTech = (intervention.getAssignedUser() != null)
                    ? intervention.getAssignedUser().getEmail() : "";

            String payloadHost = objectMapper.writeValueAsString(Map.of(
                    "documentType", "VALIDATION_FIN_MISSION",
                    "referenceId", intervention.getId(),
                    "referenceType", "intervention",
                    "emailTo", emailToHost != null ? emailToHost : "",
                    "organizationId", intervention.getOrganizationId()
            ));
            outboxPublisher.publish(
                    "INTERVENTION", String.valueOf(intervention.getId()),
                    "VALIDATION_FIN_MISSION_HOST",
                    KafkaConfig.TOPIC_DOCUMENT_GENERATE,
                    "validation-fin-mission-host-" + intervention.getId(),
                    payloadHost, intervention.getOrganizationId()
            );

            if (emailToTech != null && !emailToTech.isEmpty() && !emailToTech.equals(emailToHost)) {
                String payloadTech = objectMapper.writeValueAsString(Map.of(
                        "documentType", "VALIDATION_FIN_MISSION",
                        "referenceId", intervention.getId(),
                        "referenceType", "intervention",
                        "emailTo", emailToTech,
                        "organizationId", intervention.getOrganizationId()
                ));
                outboxPublisher.publish(
                        "INTERVENTION", String.valueOf(intervention.getId()),
                        "VALIDATION_FIN_MISSION_TECH",
                        KafkaConfig.TOPIC_DOCUMENT_GENERATE,
                        "validation-fin-mission-tech-" + intervention.getId(),
                        payloadTech, intervention.getOrganizationId()
                );
            }
            log.debug("Outbox VALIDATION_FIN_MISSION event(s) persisted for intervention: {}", intervention.getId());
        } catch (Exception e) {
            log.error("Outbox persist error VALIDATION_FIN_MISSION: {}", e.getMessage(), e);
            try {
                notificationService.notifyAdminsAndManagers(
                    NotificationKey.DOCUMENT_GENERATION_FAILED,
                    "Erreur generation document",
                    "Le document VALIDATION_FIN_MISSION pour l'intervention #" + intervention.getId() + " n'a pas pu etre genere. Erreur: " + e.getMessage(),
                    "/interventions/" + intervention.getId()
                );
            } catch (Exception ignored) {
                // Best-effort notification
            }
        }
    }

    /**
     * Notifier les parties concernees qu'une intervention est terminee.
     */
    private void notifyInterventionCompleted(Intervention intervention) {
        try {
            String actionUrl = "/interventions/" + intervention.getId();
            String propertyName = intervention.getProperty() != null ? intervention.getProperty().getName() : "";

            notificationService.notifyAdminsAndManagers(
                    NotificationKey.INTERVENTION_COMPLETED,
                    "Intervention terminee",
                    "L'intervention '" + intervention.getTitle() + "' sur " + propertyName + " est terminee.",
                    actionUrl);

            if (intervention.getProperty() != null && intervention.getProperty().getOwner() != null) {
                String ownerKeycloakId = intervention.getProperty().getOwner().getKeycloakId();
                notificationService.notify(ownerKeycloakId, NotificationKey.INTERVENTION_COMPLETED,
                        "Intervention terminee",
                        "L'intervention '" + intervention.getTitle() + "' sur votre propriete " + propertyName + " est terminee.",
                        actionUrl);
            }
        } catch (Exception e) {
            log.warn("Notification error interventionCompleted: {}", e.getMessage());
        }
    }
}
