package com.clenzy.service;

import com.clenzy.config.KafkaConfig;
import com.clenzy.dto.InterventionResponse;
import com.clenzy.exception.NotFoundException;
import com.clenzy.exception.UnauthorizedException;
import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionAssignmentResponse;
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
    private final com.clenzy.service.payout.HousekeeperPayoutService housekeeperPayoutService;
    private final PropertyStockService propertyStockService;

    public InterventionLifecycleService(InterventionRepository interventionRepository,
                                        InterventionMapper interventionMapper,
                                        InterventionAccessPolicy accessPolicy,
                                        NotificationService notificationService,
                                        OutboxPublisher outboxPublisher,
                                        ObjectMapper objectMapper,
                                        TenantContext tenantContext,
                                        com.clenzy.service.payout.HousekeeperPayoutService housekeeperPayoutService,
                                        PropertyStockService propertyStockService) {
        this.interventionRepository = interventionRepository;
        this.interventionMapper = interventionMapper;
        this.accessPolicy = accessPolicy;
        this.notificationService = notificationService;
        this.outboxPublisher = outboxPublisher;
        this.objectMapper = objectMapper;
        this.tenantContext = tenantContext;
        this.housekeeperPayoutService = housekeeperPayoutService;
        this.propertyStockService = propertyStockService;
    }

    /**
     * Accepter une mission proposee.
     *
     * <p>Geste strictement personnel : {@code requireAssignee} refuse un
     * gestionnaire qui repondrait a la place de l'intervenant.</p>
     */
    public InterventionResponse acceptAssignment(Long id, Jwt jwt) {
        Intervention intervention = loadRespondable(id, jwt);

        intervention.setAssignmentResponse(InterventionAssignmentResponse.ACCEPTED);
        intervention.setAssignmentRespondedAt(LocalDateTime.now());
        intervention.setAssignmentDeclineReason(null);
        intervention = interventionRepository.save(intervention);

        notifyManagers(intervention, "Mission acceptee",
                "La mission '" + intervention.getTitle() + "' a ete acceptee.");
        return interventionMapper.convertToResponse(intervention);
    }

    /**
     * Refuser une mission proposee.
     *
     * <p>Le refus DESASSIGNE : sans cela la mission resterait sur la liste de
     * quelqu'un qui a dit qu'il ne viendrait pas, et le gestionnaire n'aurait
     * aucun signal pour la replacer. Le motif est conserve — c'est ce qui
     * permet de ne pas reproposer la meme chose au meme moment.</p>
     */
    public InterventionResponse declineAssignment(Long id, String reason, Jwt jwt) {
        Intervention intervention = loadRespondable(id, jwt);

        String assigneeName = intervention.getAssignedUser() != null
                ? intervention.getAssignedUser().getFullName()
                : "L'equipe assignee";

        intervention.setAssignmentResponse(InterventionAssignmentResponse.DECLINED);
        intervention.setAssignmentRespondedAt(LocalDateTime.now());
        intervention.setAssignmentDeclineReason(reason != null && !reason.isBlank() ? reason.trim() : null);
        intervention.setAssignedUser(null);
        intervention.setTeamId(null);
        intervention = interventionRepository.save(intervention);

        String motif = intervention.getAssignmentDeclineReason() != null
                ? " Motif : " + intervention.getAssignmentDeclineReason()
                : "";
        notifyManagers(intervention, "Mission refusee",
                assigneeName + " a refuse la mission '" + intervention.getTitle() + "'."
                        + motif + " Elle est a reassigner.");
        return interventionMapper.convertToResponse(intervention);
    }

    /**
     * Charge une intervention sur laquelle l'appelant peut encore se prononcer.
     *
     * <p>Une mission deja commencee ou terminee n'est plus negociable : la
     * refuser apres coup effacerait une affectation sur laquelle du travail a
     * deja eu lieu.</p>
     */
    private Intervention loadRespondable(Long id, Jwt jwt) {
        Intervention intervention = interventionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Intervention non trouvee"));

        accessPolicy.assertCanAccess(intervention, jwt);
        accessPolicy.requireAssignee(intervention, jwt);

        InterventionStatus status = intervention.getStatus();
        if (status != InterventionStatus.PENDING) {
            throw new IllegalStateException(
                    "Impossible de repondre a une mission au statut " + status.name());
        }
        return intervention;
    }

    /** Le gestionnaire doit savoir, surtout en cas de refus : la mission lui revient. */
    private void notifyManagers(Intervention intervention, String title, String message) {
        try {
            notificationService.notifyAdminsAndManagers(NotificationKey.INTERVENTION_ASSIGNED_TO_USER,
                    title, message, "/interventions/" + intervention.getId());
        } catch (Exception e) {
            log.warn("Notification error assignment response: {}", e.getMessage());
        }
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

        // Se mettre au travail vaut acceptation : personne ne doit confirmer une
        // mission qu'il est en train de commencer.
        if (intervention.getAssignmentResponse() == InterventionAssignmentResponse.PENDING) {
            intervention.setAssignmentResponse(InterventionAssignmentResponse.ACCEPTED);
            intervention.setAssignmentRespondedAt(LocalDateTime.now());
        }

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

        // Moteur Ménage 3B (P9) : payout du prestataire à la complétion validée par la
        // preuve photo. Le service gère ses propres transactions + transfert post-commit ;
        // il ne bloque JAMAIS la complétion (gate KO → record BLOCKED motivé).
        housekeeperPayoutService.processPayoutForIntervention(intervention);

        // Stock consommable (M5) : un ménage terminé consomme le linge/produits
        // configurés. Best-effort en transaction indépendante — ne bloque jamais.
        if (intervention.getType() != null && intervention.getType().contains("CLEANING")
                && intervention.getProperty() != null) {
            propertyStockService.consumeForStay(
                    intervention.getProperty().getId(), intervention.getOrganizationId());
        }

        return interventionMapper.convertToResponse(intervention);
    }

    /**
     * Replanifie une intervention à une nouvelle date.
     *
     * <p>Le seul chemin existant passait par {@code update} et son DTO complet :
     * pour déplacer une date, on remappait tout l'objet, au risque d'écraser
     * des champs absents du formulaire appelant. Cette méthode ne touche qu'à
     * la date et à sa fenêtre horaire.</p>
     *
     * <p>Le statut n'est pas modifié : une intervention en retard qu'on
     * replanifie reste à faire, elle est simplement attendue plus tard.</p>
     */
    @Transactional
    public InterventionResponse reschedule(Long id, LocalDateTime newDate, Jwt jwt) {
        Intervention intervention = interventionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Intervention non trouvee"));

        accessPolicy.assertCanAccess(intervention, jwt);

        if (newDate == null) {
            throw new IllegalArgumentException("Aucune date de replanification fournie");
        }
        if (intervention.getStatus() == InterventionStatus.COMPLETED
                || intervention.getStatus() == InterventionStatus.CANCELLED) {
            throw new IllegalStateException(
                    "Une intervention " + intervention.getStatus().name() + " ne se replanifie pas");
        }

        // La fenetre horaire suit la date, en conservant sa duree : la deplacer
        // sans elle laisserait un creneau incoherent avec la nouvelle date.
        final LocalDateTime oldStart = intervention.getStartTime();
        final LocalDateTime oldEnd = intervention.getEndTime();
        intervention.setScheduledDate(newDate);
        if (oldStart != null) {
            final long minutes = oldEnd == null ? 0
                    : java.time.Duration.between(oldStart, oldEnd).toMinutes();
            intervention.setStartTime(newDate);
            intervention.setEndTime(minutes > 0 ? newDate.plusMinutes(minutes) : null);
        }

        intervention = interventionRepository.save(intervention);
        log.info("Intervention {} replanifiee au {}", id, newDate);
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
    /**
     * Édite le montant d'une intervention à tout moment : nouveau montant (SET),
     * remise en euros (DISCOUNT_AMOUNT) ou en pourcentage (DISCOUNT_PERCENT). Le
     * montant final (actualCost) est recalculé côté SERVEUR à partir de la
     * référence (estimatedCost) — jamais de confiance au montant client. Autorisé
     * au staff plateforme et au propriétaire du logement.
     */
    @org.springframework.transaction.annotation.Transactional
    public InterventionResponse updateAmount(Long id, String mode, java.math.BigDecimal value, Jwt jwt) {
        Intervention intervention = interventionRepository.findById(id)
            .orElseThrow(() -> new NotFoundException("Intervention non trouvee"));

        UserRole userRole = JwtRoleExtractor.extractUserRole(jwt);
        String ownerKc = intervention.getProperty() != null && intervention.getProperty().getOwner() != null
                ? intervention.getProperty().getOwner().getKeycloakId() : null;
        if (!userRole.isPlatformStaff() && (ownerKc == null || !ownerKc.equals(jwt.getSubject()))) {
            throw new UnauthorizedException("Non autorise a modifier le montant de cette intervention");
        }

        if (value == null || value.compareTo(java.math.BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Le montant / la remise doit etre positif");
        }

        java.math.BigDecimal base = intervention.getEstimatedCost() != null
                ? intervention.getEstimatedCost() : java.math.BigDecimal.ZERO;
        java.math.BigDecimal finalAmount;
        switch (mode == null ? "" : mode.toUpperCase()) {
            case "SET" -> {
                finalAmount = value;
                intervention.setEstimatedCost(value); // nouvelle reference
            }
            case "DISCOUNT_AMOUNT" -> finalAmount = base.subtract(value).max(java.math.BigDecimal.ZERO);
            case "DISCOUNT_PERCENT" -> {
                if (value.compareTo(java.math.BigDecimal.valueOf(100)) > 0) {
                    throw new IllegalArgumentException("La remise en pourcentage ne peut pas depasser 100");
                }
                finalAmount = base.multiply(java.math.BigDecimal.ONE
                        .subtract(value.divide(java.math.BigDecimal.valueOf(100)))).max(java.math.BigDecimal.ZERO);
            }
            default -> throw new IllegalArgumentException("Mode invalide: " + mode);
        }
        intervention.setActualCost(finalAmount.setScale(2, java.math.RoundingMode.HALF_UP));
        intervention = interventionRepository.save(intervention);
        return interventionMapper.convertToResponse(intervention);
    }

    /**
     * L'intervenant SOUMET son travail au contrôle.
     *
     * <p>Il ne pouvait que clore lui-même ({@code IN_PROGRESS → COMPLETED}), ce
     * qui court-circuitait toute vérification : ni photos examinées, ni durée
     * confrontée à l'estimation, ni retard constaté. Le solde devenait dû sans
     * que personne n'ait rien regardé.</p>
     *
     * <p>Réservé à l'intervenant assigné : soumettre le travail d'un autre n'a
     * pas de sens, et l'ouvrir à tous ferait de ce contrôle une formalité.</p>
     */
    @Transactional
    public InterventionResponse submitForValidation(Long id, Integer actualDurationMinutes, Jwt jwt) {
        final Intervention intervention = interventionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Intervention non trouvee"));
        accessPolicy.assertCanAccess(intervention, jwt);
        // Couvre l'intervenant ET les membres de l'equipe assignee : une mission
        // confiee a une equipe se soumet par n'importe lequel de ses membres.
        if (!JwtRoleExtractor.extractUserRole(jwt).isPlatformStaff()) {
            accessPolicy.requireAssignee(intervention, jwt);
        }

        intervention.getStatus().assertCanTransitionTo(InterventionStatus.AWAITING_VALIDATION);
        if (actualDurationMinutes != null && actualDurationMinutes > 0) {
            intervention.setActualDurationMinutes(actualDurationMinutes);
        }
        intervention.setCompletedAt(java.time.LocalDateTime.now());
        intervention.setStatus(InterventionStatus.AWAITING_VALIDATION);
        final Intervention saved = interventionRepository.save(intervention);

        try {
            notificationService.notifyAdminsAndManagersByOrgId(
                    intervention.getOrganizationId(),
                    NotificationKey.INTERVENTION_COMPLETED,
                    "Travail a controler",
                    "« " + intervention.getTitle() + " » est termine et attend votre controle :"
                            + " photos, duree reelle, respect du creneau.",
                    "/interventions/" + intervention.getId());
        } catch (Exception e) {
            log.warn("Notification soumission intervention {}: {}", id, e.getMessage());
        }
        return interventionMapper.convertToResponse(saved);
    }

    /**
     * Le gestionnaire REFUSE le travail rendu : reprise.
     *
     * <p>Retour en {@code IN_PROGRESS} — le travail est à reprendre, pas à
     * recommencer depuis rien. Le motif est tracé dans les notes : sans lui,
     * l'intervenant apprend qu'on refuse sans savoir quoi corriger.</p>
     */
    @Transactional
    public InterventionResponse rejectWork(Long id, String reason, Jwt jwt) {
        final Intervention intervention = interventionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Intervention non trouvee"));
        accessPolicy.assertCanAccess(intervention, jwt);

        if (!JwtRoleExtractor.extractUserRole(jwt).isPlatformStaff()) {
            throw new UnauthorizedException(
                    "Seuls les administrateurs et managers peuvent refuser un travail");
        }
        if (reason == null || reason.isBlank()) {
            throw new IllegalArgumentException(
                    "Un motif est requis : l'intervenant doit savoir quoi reprendre");
        }
        intervention.getStatus().assertCanTransitionTo(InterventionStatus.IN_PROGRESS);
        intervention.setStatus(InterventionStatus.IN_PROGRESS);
        intervention.setCompletedAt(null);
        intervention.setFollowUpNotes(reason.strip());
        intervention.setRequiresFollowUp(true);
        final Intervention saved = interventionRepository.save(intervention);

        try {
            if (intervention.getAssignedUser() != null
                    && intervention.getAssignedUser().getKeycloakId() != null) {
                notificationService.notify(intervention.getAssignedUser().getKeycloakId(),
                        NotificationKey.INTERVENTION_ASSIGNED_TO_USER,
                        "Travail a reprendre",
                        "« " + intervention.getTitle() + " » : " + reason.strip(),
                        "/interventions/" + intervention.getId());
            }
        } catch (Exception e) {
            log.warn("Notification refus intervention {}: {}", id, e.getMessage());
        }
        return interventionMapper.convertToResponse(saved);
    }

    /**
     * Validation depuis la constellation (carte « Travail à contrôler »).
     *
     * <p>Méthode distincte, et non un {@code jwt} nul qui vaudrait passe-droit :
     * ce chemin n'a pas de porteur, sa légitimité vient de la carte qu'un humain
     * a appliquée après avoir vu les photos et la durée.</p>
     *
     * <p>Le coût n'est pas ressaisi : c'est celui déjà porté par l'intervention,
     * issu du devis approuvé. Le redemander ici inviterait à le modifier sans
     * que le prestataire en sache rien.</p>
     */
    @Transactional
    public void validateFromSupervision(Long id, Long orgId) {
        final Intervention intervention = interventionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Intervention non trouvee : " + id));
        if (intervention.getOrganizationId() == null
                || !intervention.getOrganizationId().equals(orgId)) {
            throw new IllegalStateException("Intervention hors de l'organisation " + orgId);
        }
        intervention.getStatus().assertCanTransitionTo(InterventionStatus.AWAITING_PAYMENT);
        intervention.setStatus(InterventionStatus.AWAITING_PAYMENT);
        interventionRepository.save(intervention);

        // La demande de service suit : c'est elle qui porte la carte de paiement,
        // et son statut est ce qui rend le solde exigible.
        if (intervention.getServiceRequest() != null) {
            intervention.getServiceRequest().setStatus(
                    com.clenzy.model.RequestStatus.AWAITING_PAYMENT);
        }
    }

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
