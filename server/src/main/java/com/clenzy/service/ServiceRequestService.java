package com.clenzy.service;

import com.clenzy.dto.ServiceRequestDto;
import com.clenzy.dto.InterventionDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.exception.UnauthorizedException;
import com.clenzy.model.CleaningFrequency;
import com.clenzy.model.Priority;
import com.clenzy.model.Property;
import com.clenzy.model.ServiceRequest;
import com.clenzy.model.ServiceType;
import com.clenzy.model.User;
import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionType;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.RequestStatus;
import com.clenzy.model.UserRole;
import com.clenzy.model.Reservation;
import com.clenzy.model.AssignmentEvent;
import com.clenzy.model.WorkflowSettings;
import com.clenzy.repository.AssignmentEventRepository;
import com.clenzy.repository.WorkflowSettingsRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.util.JwtRoleExtractor;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.TeamRepository;
import com.clenzy.model.Team;
import com.clenzy.model.NotificationKey;
import com.clenzy.service.pricing.CleaningPricingEngine;
import com.clenzy.service.pricing.CleaningPricingEngine.ResolvedCleaningPrice;
import com.clenzy.tenant.TenantContext;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.PageImpl;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
@Transactional
public class ServiceRequestService {

    private static final Logger log = LoggerFactory.getLogger(ServiceRequestService.class);
    public static final int MAX_AUTO_ASSIGN_RETRIES = 10;
    public static final String MANUAL_ASSIGNMENT_HOLD = "manual_hold";

    /** Prefixe de la cle d'idempotence des menages auto post-checkout (fiche 08, F1a). */
    public static final String AUTO_CLEANING_KEY_PREFIX = "AUTO_CLEANING";
    private static final LocalTime DEFAULT_CLEANING_START = LocalTime.of(11, 0);

    private final ServiceRequestRepository serviceRequestRepository;
    private final UserRepository userRepository;
    private final PropertyRepository propertyRepository;
    private final InterventionRepository interventionRepository;
    private final ReservationRepository reservationRepository;
    private final TeamRepository teamRepository;
    private final NotificationService notificationService;
    private final PropertyTeamService propertyTeamService;
    private final DocumentGenerationOutbox documentOutbox;
    private final TenantContext tenantContext;
    private final ServiceRequestMapper serviceRequestMapper;
    private final AssignmentEventRepository assignmentEventRepository;
    private final WorkflowSettingsRepository workflowSettingsRepository;
    private final CleaningPricingEngine cleaningPricingEngine;
    private final com.clenzy.service.pricing.HousekeeperScoreService housekeeperScoreService;
    // @Lazy : la chaîne supervision dépend (transitivement, via SuggestionActionExecutor)
    // de ce service → sans lazy, cycle de constructeurs au boot Spring.
    private final com.clenzy.service.agent.supervision.SupervisionSuggestionService supervisionSuggestionService;
    private final com.clenzy.service.agent.supervision.SupervisionAutoApplyService supervisionAutoApplyService;
    private final com.clenzy.service.agent.supervision.AutoApplyGate autoApplyGate;
    private final com.clenzy.service.access.OrganizationAccessGuard organizationAccessGuard;

    private final com.clenzy.service.InterventionAllocationGuard allocationGuard;
    private final ServiceRequestCancellationCoordination cancellationCoordination;
    private final com.clenzy.service.assignment.ServiceAssignmentService assignments;

    public ServiceRequestService(ServiceRequestRepository serviceRequestRepository,
                                  UserRepository userRepository,
                                  PropertyRepository propertyRepository,
                                  InterventionRepository interventionRepository,
                                  ReservationRepository reservationRepository,
                                  TeamRepository teamRepository,
                                  NotificationService notificationService,
                                  PropertyTeamService propertyTeamService,
                                  DocumentGenerationOutbox documentOutbox,
                                  TenantContext tenantContext,
                                  ServiceRequestMapper serviceRequestMapper,
                                  AssignmentEventRepository assignmentEventRepository,
                                  WorkflowSettingsRepository workflowSettingsRepository,
                                  CleaningPricingEngine cleaningPricingEngine,
                                  com.clenzy.service.pricing.HousekeeperScoreService housekeeperScoreService,
                                  @org.springframework.context.annotation.Lazy
                                  com.clenzy.service.agent.supervision.SupervisionSuggestionService supervisionSuggestionService,
                                  @org.springframework.context.annotation.Lazy
                                  com.clenzy.service.agent.supervision.SupervisionAutoApplyService supervisionAutoApplyService,
                                  com.clenzy.service.agent.supervision.AutoApplyGate autoApplyGate,
                                  com.clenzy.service.access.OrganizationAccessGuard organizationAccessGuard, com.clenzy.service.InterventionAllocationGuard allocationGuard,
                                  ServiceRequestCancellationCoordination cancellationCoordination,
                                  com.clenzy.service.assignment.ServiceAssignmentService assignments) {
        this.assignments = assignments;
        this.cancellationCoordination = cancellationCoordination;
        this.allocationGuard = allocationGuard;
        this.serviceRequestRepository = serviceRequestRepository;
        this.userRepository = userRepository;
        this.propertyRepository = propertyRepository;
        this.interventionRepository = interventionRepository;
        this.reservationRepository = reservationRepository;
        this.teamRepository = teamRepository;
        this.notificationService = notificationService;
        this.propertyTeamService = propertyTeamService;
        this.documentOutbox = documentOutbox;
        this.tenantContext = tenantContext;
        this.serviceRequestMapper = serviceRequestMapper;
        this.assignmentEventRepository = assignmentEventRepository;
        this.workflowSettingsRepository = workflowSettingsRepository;
        this.cleaningPricingEngine = cleaningPricingEngine;
        this.housekeeperScoreService = housekeeperScoreService;
        this.supervisionSuggestionService = supervisionSuggestionService;
        this.supervisionAutoApplyService = supervisionAutoApplyService;
        this.autoApplyGate = autoApplyGate;
        this.organizationAccessGuard = organizationAccessGuard;
    }

    /**
     * Garde d'ownership fail-closed (audit 2026-07 F1-05/06/07) : {@code findById}
     * contourne le filtre org (inerte en HTTP) — toute demande chargée par id dans
     * un flux utilisateur doit valider l'appartenance à l'organisation courante.
     */
    private void requireOwnedServiceRequest(ServiceRequest sr) {
        organizationAccessGuard.requireSameOrganization(
                sr.getOrganizationId(), "Demande hors de votre organisation");
    }

    public ServiceRequestDto create(ServiceRequestDto dto) {
        return createWithFlowKey(dto, null);
    }

    /** Idempotent entry into the same workflow for a multi-service form submission. */
    @org.springframework.transaction.annotation.Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public ServiceRequestDto createComposedRequest(ServiceRequestDto dto, java.util.UUID submissionId) {
        String key = "COMPOSER:" + submissionId + ":" + dto.serviceItemCode;
        serviceRequestRepository.acquireAutoFlowKeyLock(key);
        var existing = serviceRequestRepository.findByAutoFlowKey(key, tenantContext.getRequiredOrganizationId());
        if (existing.isPresent()) {
            var previous = existing.get();
            if (!java.util.Objects.equals(previous.getUser().getId(), dto.userId)
                    || !java.util.Objects.equals(previous.getProperty() == null ? null : previous.getProperty().getId(), dto.propertyId)
                    || !java.util.Objects.equals(previous.getDesiredDate(), dto.desiredDate)
                    || !java.util.Objects.equals(previous.getDescription(), dto.description)
                    || !java.util.Objects.equals(previous.getEstimatedDurationHours(), dto.estimatedDurationHours)
                    || !java.util.Objects.equals(previous.getPriority(), dto.priority))
                throw new IllegalStateException("Cette demande a déjà été créée. Consultez-la avant de modifier les informations.");
            return serviceRequestMapper.toDto(previous);
        }
        return createWithFlowKey(dto, key);
    }

    /** Réutilise le parcours PMS, dans la transaction de l'échéancier. */
    @org.springframework.transaction.annotation.Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public Long createRecurringRequest(ServiceRequestDto dto, Long sourceQuoteId) {
        String key = "MARKETPLACE_RECURRENCE:" + sourceQuoteId + ":" + dto.desiredDate.toLocalDate();
        serviceRequestRepository.acquireAutoFlowKeyLock(key);
        var existing = serviceRequestRepository.findByAutoFlowKey(key, tenantContext.getRequiredOrganizationId());
        if (existing.isPresent()) return existing.get().getId();
        return createWithFlowKey(dto, key).id;
    }

    private ServiceRequestDto createWithFlowKey(ServiceRequestDto dto, String flowKey) {
        ServiceRequest entity = new ServiceRequest();
        serviceRequestMapper.apply(dto, entity);
        entity.setAutoFlowKey(flowKey);
        entity.setOrganizationId(tenantContext.getRequiredOrganizationId());
        if (entity.getProperty() != null)
            organizationAccessGuard.requireSameOrganization(entity.getProperty().getOrganizationId(),"Logement hors organisation");
        if (entity.getAssignedToId() != null) requireAvailableAssignment(entity, entity.getAssignedToId(), entity.getAssignedToType());
        entity = serviceRequestRepository.save(entity);

        try {
            notificationService.notifyAdminsAndManagers(
                NotificationKey.SERVICE_REQUEST_CREATED,
                "Nouvelle demande de service",
                "Demande \"" + entity.getTitle() + "\" creee",
                "/interventions?tab=service-requests&highlight=" + entity.getId(),
                requestFacts(entity));
        } catch (Exception e) {
            log.warn("Notification error SERVICE_REQUEST_CREATED: {}", e.getMessage());
        }

        Long initialTarget = entity.getAssignedToId();
        String initialKind = entity.getAssignedToType();
        entity.setAssignedToId(null);
        entity.setAssignedToType(null);
        entity.setStatus(RequestStatus.PENDING);
        if (initialTarget != null) assignments.propose(entity.getId(),entity.getOrganizationId(),initialKind,initialTarget);
        else assignments.initialize(entity);

        return serviceRequestMapper.toDto(entity);
    }

    /**
     * Refus d'une assignation par l'equipe/utilisateur assigne.
     * Remet la SR en PENDING pour reassignation.
     */
    public ServiceRequestDto refuse(Long serviceRequestId) {
        ServiceRequest sr = serviceRequestRepository.findForMutation(serviceRequestId)
                .orElseThrow(() -> new NotFoundException("Demande de service non trouvee"));
        requireOwnedServiceRequest(sr);
        if (sr.getAssignmentPhase()!=null)
            throw new IllegalStateException("Répondez à la proposition depuis l'écran des propositions de service");
        requireDirectControl(sr);
        if (sr.getPaidAt() != null || interventionRepository.existsByServiceRequestId(sr.getId()))
            throw new IllegalStateException("La mission existante doit être modifiée depuis son parcours d'affectation");


        if (!RequestStatus.AWAITING_PAYMENT.equals(sr.getStatus()) && !RequestStatus.ASSIGNED.equals(sr.getStatus())) {
            throw new IllegalStateException("Seules les demandes assignees peuvent etre refusees. Statut actuel: " + sr.getStatus());
        }

        sr.setAssignedToId(null);
        sr.setAssignedToType(null);
        sr.setStatus(RequestStatus.PENDING);
        sr.setAutoAssignRetryCount(0); // Reset pour relancer le cycle
        sr.setAutoAssignStatus(null);
        sr = serviceRequestRepository.save(sr);

        logAssignmentEvent(sr, "REFUSE", null, null, "Assignation refusee par l'equipe/utilisateur");

        try {
            notificationService.notifyAdminsAndManagers(
                NotificationKey.SERVICE_REQUEST_CREATED,
                "Assignation refusee",
                "L'equipe/utilisateur a refuse la demande \"" + sr.getTitle() + "\". Reassignation necessaire.",
                "/interventions?tab=service-requests&highlight=" + sr.getId(),
                requestFacts(sr));
        } catch (Exception e) {
            log.warn("Notification error REFUSE: {}", e.getMessage());
        }

        // Tenter une re-assignation automatique ; en échec sur un ménage, faire
        // remonter une carte HITL « Remplacer le prestataire » dans la constellation
        // du logement (le scheduler 15 min continue de retenter en parallèle).
        boolean reassigned = attemptAutoAssign(sr);
        if (!reassigned) {
            flagProviderReplacementNeeded(sr);
        }

        return serviceRequestMapper.toDto(sr);
    }

    public void requireRefusalRecipient(Long id,org.springframework.security.oauth2.jwt.Jwt jwt) {
        var need=serviceRequestRepository.findForMutation(id).orElseThrow(() -> new NotFoundException("Demande introuvable"));
        requireOwnedServiceRequest(need);
        Long user=assignments.currentUser(jwt);
        boolean recipient="user".equals(need.getAssignedToType()) ? java.util.Objects.equals(user,need.getAssignedToId())
            : "team".equals(need.getAssignedToType()) && teamRepository.findById(need.getAssignedToId())
                .map(team -> team.getMembers().stream().anyMatch(member -> member.getUser()!=null && user.equals(member.getUser().getId()))).orElse(false);
        if (!recipient) throw new org.springframework.security.access.AccessDeniedException("Vous n'êtes pas destinataire de cette demande");
    }

    /**
     * Carte HITL « Remplacer le prestataire ménage » (agent Operations) quand le
     * prestataire s'est désisté et qu'aucun remplaçant n'est immédiatement
     * disponible. Best-effort (dédup par intitulé côté suggestion service) ;
     * réservée aux prestations de ménage rattachées à un logement. Même pattern
     * d'autonomie que CleaningBackfillScheduler : le gate décide HITL vs auto —
     * en AUTO, l'apply retente la réassignation immédiatement ; un échec laisse
     * la carte en PENDING (repli HITL naturel).
     */
    private void flagProviderReplacementNeeded(ServiceRequest sr) {
        try {
            if (sr.getProperty() == null || sr.getServiceType() == null
                    || !sr.getServiceType().isCleaningService()) {
                return;
            }
            Long orgId = sr.getOrganizationId();
            Long propertyId = sr.getProperty().getId();
            String when = sr.getDesiredDate() != null
                    ? " du " + sr.getDesiredDate().toLocalDate()
                    : "";
            String title = "Remplacer le prestataire ménage" + when;
            String motif = "Le prestataire assigné s'est désisté (\"" + sr.getTitle()
                    + "\") et aucun remplaçant n'est disponible pour l'instant.";
            String params = "{\"serviceRequestId\":" + sr.getId() + "}";

            com.clenzy.service.agent.supervision.AutoApplyGate.AutoDecision decision =
                    autoApplyGate.decide(orgId, "ops",
                            com.clenzy.service.agent.supervision.SupervisionActionType.REASSIGN_CLEANING,
                            java.util.Map.of());
            boolean auto = decision == com.clenzy.service.agent.supervision.AutoApplyGate.AutoDecision.AUTO_NOTIFY
                    || decision == com.clenzy.service.agent.supervision.AutoApplyGate.AutoDecision.AUTO_SILENT;
            if (!auto) {
                supervisionSuggestionService.recordActionable(orgId, propertyId, "ops", title, motif,
                        com.clenzy.service.agent.supervision.SupervisionActionType.REASSIGN_CLEANING,
                        params, null, "warning");
            } else {
                supervisionSuggestionService.recordActionableForAutoApply(orgId, propertyId, "ops",
                                null, title, motif,
                                com.clenzy.service.agent.supervision.SupervisionActionType.REASSIGN_CLEANING,
                                params, null, "warning")
                        .ifPresent(suggestionId -> supervisionAutoApplyService.autoApply(
                                decision, orgId, propertyId, "ops", suggestionId, title, motif, null));
            }
        } catch (Exception e) {
            log.debug("Carte remplacement prestataire non créée (SR {}): {}", sr.getId(), e.getMessage());
        }
    }

    /**
     * Réassignation demandée par la constellation (apply d'une carte
     * {@code REASSIGN_CLEANING}) : org-scopée strict (la suggestion porte l'org du
     * requester). Idempotent : demande déjà réassignée entre-temps → succès.
     *
     * @return true si la demande est assignée (déjà ou suite à cette tentative)
     */
    public boolean retryAutoAssignForSupervision(Long organizationId, Long serviceRequestId) {
        ServiceRequest sr = serviceRequestRepository.findForMutation(serviceRequestId)
                .orElseThrow(() -> new NotFoundException("Demande de service non trouvee"));
        // findById contourne le filtre org (règle audit n°3) → garde explicite.
        if (organizationId == null || !organizationId.equals(sr.getOrganizationId())) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "Demande hors de votre organisation");
        }
        if (sr.getAssignedToId() != null) {
            return true; // réassignée entre-temps (scheduler / manuel) — objectif atteint
        }
        if (!RequestStatus.PENDING.equals(sr.getStatus())) {
            throw new IllegalStateException(
                    "Demande non réassignable (statut " + sr.getStatus() + ")");
        }
        return attemptAutoAssignByOrgId(sr, organizationId);
    }

    /**
     * Prestataires proposables pour replanifier cette prestation à une date donnée.
     *
     * <p>Le logement, le type de service et la durée viennent de la demande
     * elle-même : l'opérateur choisit une date, le reste est déjà connu. Les
     * équipes occupées sur le créneau sont rendues aussi, marquées
     * indisponibles — déplacer l'heure peut les libérer, et c'est l'arbitrage
     * qu'on veut lui laisser.</p>
     */
    @Transactional(readOnly = true)
    public PropertyTeamService.AssignableTeams findAssignableTeams(Long serviceRequestId,
                                                                   LocalDateTime date) {
        ServiceRequest sr = serviceRequestRepository.findById(serviceRequestId)
                .orElseThrow(() -> new NotFoundException("Demande de service non trouvee"));
        requireOwnedServiceRequest(sr);
        final String serviceType = sr.getServiceItemCode();
        // Le type requis accompagne TOUJOURS la reponse : c'est quand la liste
        // est vide qu'il compte le plus, et c'est precisement la que l'ecran
        // n'avait rien a dire.
        final String requiredTeamType = serviceType;

        if ((sr.getProperty() == null && !allocationGuard.isRemote(serviceType)) || date == null) {
            return new PropertyTeamService.AssignableTeams(List.of(), requiredTeamType);
        }
        return new PropertyTeamService.AssignableTeams(
                propertyTeamService.findAssignableTeams(
                        sr.getProperty() == null ? null : sr.getProperty().getId(), date, sr.getEstimatedDurationHours(),
                        serviceType, sr.getOrganizationId(), sr.getId(),
                        null),
                requiredTeamType);
    }

    /**
     * Clôture définitive d'une prestation qui n'aura pas lieu.
     *
     * <p>Une demande peut rester en attente indéfiniment : l'assignation
     * automatique abandonne après dix tentatives et rien ne la reprend. Sa date
     * passe, le séjour concerné se termine, et elle encombre la file des actions
     * pour toujours. Il fallait pouvoir dire « celle-ci n'aura pas lieu ».</p>
     *
     * <p>C'est une <b>annulation</b>, pas une suppression : la demande reste en
     * base avec son historique et son coût. Seul {@code DELETE} efface, et il est
     * réservé au staff plateforme.</p>
     */
    public ServiceRequestDto cancel(Long serviceRequestId, String reason) {
        ServiceRequest sr = serviceRequestRepository.findForMutation(serviceRequestId)
                .orElseThrow(() -> new NotFoundException("Demande de service non trouvee"));
        requireOwnedServiceRequest(sr);
        requireDirectControl(sr);

        if (!sr.getStatus().canTransitionTo(RequestStatus.CANCELLED)) {
            throw new IllegalStateException(
                    "Une demande " + sr.getStatus() + " ne peut plus etre annulee.");
        }

        var linkedMission = cancellationCoordination.requireLegacyCancellationAllowed(sr);
        if (sr.getAssignmentPhase() != null && linkedMission == null) {
            assignments.withdraw(sr.getId(),sr.getOrganizationId(),"Demande annulée");
            sr.setAssignmentPhase("CANCELLED");
        }
        if (linkedMission != null) linkedMission.setStatus(InterventionStatus.CANCELLED);
        sr.setStatus(RequestStatus.CANCELLED);
        // La recherche d'équipe s'arrête avec elle : sans ce reset, le scheduler
        // continuerait de la compter dans ses tentatives.
        sr.setAutoAssignStatus(null);
        if (reason != null && !reason.isBlank()) {
            final String note = "Cloturee : " + reason.strip();
            sr.setSpecialInstructions(sr.getSpecialInstructions() == null
                    ? note
                    : sr.getSpecialInstructions() + "\n" + note);
        }
        sr = serviceRequestRepository.save(sr);

        logAssignmentEvent(sr, "CANCEL", null, null,
                reason == null || reason.isBlank() ? "Cloturee manuellement" : reason.strip());
        log.info("SR {} cloturee manuellement", sr.getId());

        return serviceRequestMapper.toDto(sr);
    }

    /**
     * Replanifie une prestation : clôture l'ancienne et en crée une neuve.
     *
     * <p>Un seul geste, une seule transaction. Recréer la demande depuis l'écran
     * obligerait à recomposer le logement, le type de service, la durée et le
     * demandeur — donc à dupliquer des règles qui vivent ici, et à laisser une
     * fenêtre où l'ancienne serait close sans que la nouvelle existe.</p>
     *
     * <p>Le rattachement à un séjour est un <b>choix</b> : une prestation peut
     * suivre une réservation précise, ou n'en concerner aucune (remise en état,
     * travaux hors location). {@code reservationId} nul exprime le second cas.</p>
     *
     * @param assignedToId   prestataire retenu, ou {@code null} pour laisser
     *                       l'assignation automatique chercher
     */
    public ServiceRequestDto reschedule(Long serviceRequestId, LocalDateTime desiredDate,
                                        Long assignedToId, String assignedToType,
                                        Long reservationId, String reason) {
        if (desiredDate == null) {
            throw new IllegalArgumentException("Une date d'intervention est requise.");
        }
        ServiceRequest previous = serviceRequestRepository.findForMutation(serviceRequestId)
                .orElseThrow(() -> new NotFoundException("Demande de service non trouvee"));
        requireOwnedServiceRequest(previous);
        requireDirectControl(previous);
        cancellationCoordination.requireLegacyCancellationAllowed(previous);
        if (previous.getAssignmentPhase()!=null) {
            assignments.withdraw(previous.getId(),previous.getOrganizationId(),
                    reason==null || reason.isBlank()?"Créneau modifié":reason.strip());
            previous.setAssignmentCycle(previous.getAssignmentCycle()+1);
            previous.setDesiredDate(desiredDate);
            previous.setReservationId(reservationId);
            serviceRequestRepository.saveAndFlush(previous);
            if (assignedToId!=null) assignments.propose(previous.getId(),previous.getOrganizationId(),assignedToType,assignedToId);
            else assignments.resume(previous.getId(),previous.getOrganizationId());
            return serviceRequestMapper.toDto(previous);
        }

        ServiceRequest next = new ServiceRequest();
        next.setOrganizationId(previous.getOrganizationId());
        next.setTitle(previous.getTitle());
        next.setDescription(previous.getDescription());
        next.setServiceType(previous.getServiceType());
        next.setServiceItemCode(previous.getServiceItemCode());
        next.setPriority(previous.getPriority());
        next.setEstimatedDurationHours(previous.getEstimatedDurationHours());
        next.setEstimatedCost(previous.getEstimatedCost());
        next.setProperty(previous.getProperty());
        next.setUser(previous.getUser());
        next.setDesiredDate(desiredDate);
        // Absent = prestation hors séjour, c'est un cas légitime et non un oubli.
        next.setReservationId(reservationId);
        next.setStatus(RequestStatus.PENDING);

        if (assignedToId != null && assignedToType != null) {
            next.setAssignedToId(assignedToId);
            next.setAssignedToType(assignedToType);
        }
        next = serviceRequestRepository.save(next);

        // Le prestataire choisi reçoit une proposition, sans nouvelle recherche automatique.
        if (assignedToId != null && assignedToType != null) {
            manualAssign(next.getId(), assignedToId, assignedToType);
            next = serviceRequestRepository.findById(next.getId()).orElse(next);
        } else {
            assignments.initialize(next);
        }

        cancel(previous.getId(), reason == null || reason.isBlank()
                ? "Replanifiee : demande #" + next.getId()
                : reason.strip());

        log.info("SR {} replanifiee en SR {}", previous.getId(), next.getId());
        return serviceRequestMapper.toDto(next);
    }

    /**
     * Assignation manuelle par un admin/manager.
     */
    private void requireAvailableAssignment(ServiceRequest request, Long targetId, String targetType) {
        if (allocationGuard.isUnscheduled(request.getServiceItemCode())) {
            allocationGuard.requireUnscheduledAssignment(request,targetType,targetId);
            return;
        }
        if (serviceRequestRepository.assignmentConflicts(request.getId(), targetType, targetId,
                request.getDesiredDate(), request.getEstimatedDurationHours())) {
            throw new com.clenzy.exception.AssignmentConflictException();
        }
        if (!allocationGuard.isRemote(request.getServiceItemCode()))
            allocationGuard.requirePropertyAllowed(targetType, targetId, request.getProperty());
        if ("team".equals(targetType) && !allocationGuard.isTeamDeclaredAvailable(targetId,
                request.getDesiredDate(), request.getEstimatedDurationHours())) {
            throw new com.clenzy.exception.AssignmentConflictException(
                    "L'équipe est indisponible sur ce créneau. Choisissez un autre créneau ou prestataire.");
        }
        if ("user".equals(targetType) && !allocationGuard.isUserDeclaredAvailable(targetId,
                request.getDesiredDate(), request.getEstimatedDurationHours())) {
            throw new com.clenzy.exception.AssignmentConflictException("Le prestataire est indisponible sur ce créneau.");
        }
        allocationGuard.requireDocumentaryAssignment(request, targetType, targetId);
    }

    public ServiceRequestDto manualAssign(Long serviceRequestId, Long assignedToId, String assignedToType) {
        if (assignedToId==null || assignedToId<=0 || assignedToType==null || !java.util.Set.of("team","user").contains(assignedToType))
            throw new IllegalArgumentException("Prestataire invalide");
        ServiceRequest sr = serviceRequestRepository.findForMutation(serviceRequestId)
            .orElseThrow(() -> new NotFoundException("Demande introuvable"));
        requireOwnedServiceRequest(sr);
        requireDirectControl(sr);
        if (sr.getPaidAt() != null || sr.getConvertedInterventionId() != null
                || interventionRepository.existsByServiceRequestId(sr.getId()))
            throw new IllegalStateException("La mission existante doit être modifiée depuis son parcours d'affectation");
        assignments.propose(serviceRequestId,sr.getOrganizationId(),assignedToType,assignedToId);
        return serviceRequestMapper.toDto(sr);
    }

    /** Retrait volontaire : l'automatisation ne doit pas annuler la décision humaine. */
    public ServiceRequestDto unassign(Long serviceRequestId) {
        ServiceRequest sr = serviceRequestRepository.findForMutation(serviceRequestId)
                .orElseThrow(() -> new NotFoundException("Demande de service non trouvee"));
        requireOwnedServiceRequest(sr);
        requireDirectControl(sr);
        if (sr.getAssignmentPhase() != null) {
            assignments.withdraw(serviceRequestId,sr.getOrganizationId(),"Retrait par le gestionnaire");
            return serviceRequestMapper.toDto(sr);
        }
        if (sr.getStatus() != RequestStatus.PENDING && sr.getStatus() != RequestStatus.ASSIGNED) {
            throw new IllegalStateException("Seule une demande en attente ou assignée peut être désaffectée");
        }
        if (sr.getPaidAt() != null || interventionRepository.existsByServiceRequestId(sr.getId())) {
            throw new IllegalStateException("Une mission créée ou payée nécessite une révision de son affectation");
        }
        if (MANUAL_ASSIGNMENT_HOLD.equals(sr.getAutoAssignStatus()) && sr.getAssignedToId() == null) {
            return serviceRequestMapper.toDto(sr);
        }
        Long previousId = sr.getAssignedToId();
        String previousType = sr.getAssignedToType();
        sr.setAssignedToId(null);
        sr.setAssignedToType(null);
        sr.setStatus(RequestStatus.PENDING);
        sr.setAutoAssignStatus(MANUAL_ASSIGNMENT_HOLD);
        sr = serviceRequestRepository.save(sr);
        logAssignmentEvent(sr, "MANUAL_UNASSIGN", previousId, previousType, "Affectation retirée ; recherche automatique suspendue");
        return serviceRequestMapper.toDto(sr);
    }

    /**
     * Cree une intervention a partir d'une SR payee.
     * Appelee apres confirmation du paiement Stripe.
     */
    public Intervention createInterventionFromPaidServiceRequest(ServiceRequest sr) {
        throw new IllegalStateException("La création d'une intervention nécessite l'accord du prestataire, pas un paiement");
    }

    private void requireCurrentVersion(ServiceRequest entity, Long version) {
        if (version == null || version.longValue() != entity.getVersion()) {
            throw new org.springframework.orm.ObjectOptimisticLockingFailureException(ServiceRequest.class, entity.getId());
        }
    }

    private void requireEditableStatusChange(ServiceRequest entity, RequestStatus status) {
        if (status == null || status == entity.getStatus()) return;
        if (!entity.getStatus().canTransitionTo(status)
                || (status != RequestStatus.REJECTED && status != RequestStatus.CANCELLED)) {
            throw new IllegalStateException("Utilisez les actions de la mission pour modifier son avancement");
        }
        if (entity.getPaidAt() != null || interventionRepository.existsByServiceRequestId(entity.getId())) {
            throw new IllegalStateException("Une mission créée ou payée nécessite une révision dédiée");
        }
    }

    public ServiceRequestDto changeStatus(Long id, Long version, RequestStatus status) {
        ServiceRequest entity = serviceRequestRepository.findForMutation(id)
                .orElseThrow(() -> new NotFoundException("Service request not found"));
        requireOwnedServiceRequest(entity);
        requireDirectControl(entity);
        requireCurrentVersion(entity, version);
        if (status == null) throw new IllegalArgumentException("Statut requis");
        requireEditableStatusChange(entity, status);
        if (status == entity.getStatus()) return serviceRequestMapper.toDto(entity);
        if (status == RequestStatus.CANCELLED) {
            cancel(id, null);
            serviceRequestRepository.flush();
            return serviceRequestMapper.toDto(entity);
        }
        entity.setStatus(status);
        entity.setAutoAssignStatus(null);
        entity = serviceRequestRepository.save(entity);
        serviceRequestRepository.flush();
        notifyRequestRejected(entity);
        return serviceRequestMapper.toDto(entity);
    }

    public ServiceRequestDto update(Long id, ServiceRequestDto dto) {
        ServiceRequest entity = serviceRequestRepository.findForMutation(id).orElseThrow(() -> new NotFoundException("Service request not found"));
        requireOwnedServiceRequest(entity);
        requireDirectControl(entity);
        requireCurrentVersion(entity, dto.version);
        if (entity.getPaidAt() != null || interventionRepository.existsByServiceRequestId(id)) {
            throw new IllegalStateException("Une mission créée ou payée nécessite une révision dédiée");
        }
        requireEditableStatusChange(entity, dto.status);
        RequestStatus previousStatus = entity.getStatus();
        if (entity.getAssignmentPhase() != null) {
            assignments.withdraw(id,entity.getOrganizationId(),"Informations de la demande modifiées");
            entity.setAssignmentCycle(entity.getAssignmentCycle()+1);
        }
        Long previousAssignee = entity.getAssignedToId();
        String previousType = entity.getAssignedToType();
        serviceRequestMapper.apply(dto, entity);
        if (entity.getAssignmentPhase()!=null && entity.getStatus()!=RequestStatus.REJECTED
                && entity.getStatus()!=RequestStatus.CANCELLED) entity.setStatus(RequestStatus.PENDING);
        // Les changements de cible passent par les mêmes règles que le dialogue dédié.
        if (entity.getProperty() != null) {
            organizationAccessGuard.requireSameOrganization(entity.getProperty().getOrganizationId(), "Logement hors organisation");
        }
        entity.setAssignedToId(previousAssignee);
        entity.setAssignedToType(previousType);
        boolean assignmentChanged = !java.util.Objects.equals(dto.assignedToId, previousAssignee)
                || !java.util.Objects.equals(dto.assignedToType, previousType);
        if (assignmentChanged) {
            if (dto.assignedToId == null) unassign(id);
            else manualAssign(id, dto.assignedToId, dto.assignedToType);
        } else if (entity.getAssignedToId() != null) {
            requireAvailableAssignment(entity, entity.getAssignedToId(), entity.getAssignedToType());
        }
        if (entity.getStatus() == RequestStatus.REJECTED || entity.getStatus() == RequestStatus.CANCELLED) {
            entity.setAutoAssignStatus(null);
        }
        entity = serviceRequestRepository.save(entity);
        serviceRequestRepository.flush();
        if (previousStatus != entity.getStatus()) notifyRequestRejected(entity);
        return serviceRequestMapper.toDto(entity);
    }

    private void notifyRequestRejected(ServiceRequest entity) {
        // Notify requester if the status changed to REJECTED
        try {
            if (RequestStatus.REJECTED.equals(entity.getStatus()) && entity.getUser() != null && entity.getUser().getKeycloakId() != null) {
                notificationService.notify(
                    entity.getUser().getKeycloakId(),
                    NotificationKey.SERVICE_REQUEST_REJECTED,
                    "Demande de service refusee",
                    "Votre demande \"" + entity.getTitle() + "\" a ete refusee",
                    "/interventions?tab=service-requests&highlight=" + entity.getId(),
                    requestFacts(entity));
            }
        } catch (Exception e) {
            log.warn("Notification error SERVICE_REQUEST_REJECTED: {}", e.getMessage());
        }

    }

    @Transactional(readOnly = true)
    public ServiceRequestDto getById(Long id) {
        ServiceRequest sr = serviceRequestRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Service request not found"));
        requireOwnedServiceRequest(sr);
        return readDtosWithMissionAssignment(List.of(sr)).get(0);
    }

    @Transactional(readOnly = true)
    public List<ServiceRequestDto> list() {
        return readDtosWithMissionAssignment(serviceRequestRepository.findAllWithRelations(tenantContext.getRequiredOrganizationId())
                .stream().filter(sr -> !"CONVERTED".equals(sr.getAssignmentPhase())).toList());
    }

    @Transactional(readOnly = true)
    public Page<ServiceRequestDto> list(Pageable pageable) {
        // Pour la pagination, on doit d'abord récupérer les IDs puis charger avec relations
        List<ServiceRequest> withRelations = serviceRequestRepository.findAllWithRelations(tenantContext.getRequiredOrganizationId())
                .stream().filter(sr -> !"CONVERTED".equals(sr.getAssignmentPhase())).toList();

        // Filtrer selon la pagination
        int start = (int) Math.min(pageable.getOffset(), withRelations.size());
        int end = Math.min(start + pageable.getPageSize(), withRelations.size());
        List<ServiceRequest> pageContent = withRelations.subList(start, end);

        return new PageImpl<>(readDtosWithMissionAssignment(pageContent), pageable, withRelations.size());
    }

    @Transactional(readOnly = true)
    public Page<ServiceRequestDto> search(Pageable pageable, Long userId, Long propertyId, com.clenzy.model.RequestStatus status, com.clenzy.model.ServiceType serviceType) {
        // Utiliser la méthode avec relations et filtrer ensuite
        List<ServiceRequest> allWithRelations = serviceRequestRepository.findAllWithRelations(tenantContext.getRequiredOrganizationId());

        // Filtrer selon les critères
        List<ServiceRequest> filtered = allWithRelations.stream().filter(sr -> !"CONVERTED".equals(sr.getAssignmentPhase()))
            .filter(sr -> userId == null || (sr.getUser() != null && sr.getUser().getId().equals(userId)))
            .filter(sr -> propertyId == null || (sr.getProperty() != null && sr.getProperty().getId().equals(propertyId)))
            .filter(sr -> status == null || sr.getStatus().equals(status))
            .filter(sr -> serviceType == null || sr.getServiceType().equals(serviceType))
            .collect(Collectors.toList());

        // Appliquer la pagination
        int start = (int) Math.min(pageable.getOffset(), filtered.size());
        int end = Math.min(start + pageable.getPageSize(), filtered.size());
        List<ServiceRequest> pageContent = filtered.subList(start, end);

        return new PageImpl<>(readDtosWithMissionAssignment(pageContent), pageable, filtered.size());
    }

    @Transactional(readOnly = true)
    public Page<ServiceRequestDto> searchWithRoleBasedAccess(Pageable pageable, Long userId, Long propertyId,
                                                             Long reservationId,
                                                             com.clenzy.model.RequestStatus status,
                                                             com.clenzy.model.ServiceType serviceType,
                                                             Jwt jwt) {
        return searchWithRoleBasedAccess(pageable, userId, propertyId, reservationId, status, serviceType, jwt, false);
    }

    @Transactional(readOnly = true)
    public Page<ServiceRequestDto> searchWithRoleBasedAccess(Pageable pageable, Long userId, Long propertyId,
            Long reservationId, RequestStatus status, ServiceType serviceType, Jwt jwt, boolean activeOnly) {
        if (jwt == null) {
            if (activeOnly) throw new org.springframework.security.access.AccessDeniedException("Authentification requise");
            // Si pas de JWT, utiliser la méthode standard
            return search(pageable, userId, propertyId, status, serviceType);
        }

        UserRole userRole = JwtRoleExtractor.extractUserRole(jwt);
        log.debug("searchWithRoleBasedAccess - Role: {}", userRole);

        // Utiliser la méthode avec relations et filtrer ensuite
        List<ServiceRequest> allWithRelations = activeOnly
                ? serviceRequestRepository.findOpenWithRelations(tenantContext.getRequiredOrganizationId())
                : serviceRequestRepository.findAllWithRelations(tenantContext.getRequiredOrganizationId());

        // Filtrer selon le rôle
        List<ServiceRequest> filtered = allWithRelations.stream().filter(sr -> !"CONVERTED".equals(sr.getAssignmentPhase()))
            .filter(sr -> {
                // Filtre par rôle
                if (userRole == UserRole.HOST) {
                    // HOST : seulement les demandes liées à ses propriétés
                    if (sr.getProperty() != null && sr.getProperty().getOwner() != null) {
                        String keycloakId = jwt.getSubject();
                        User hostUser = userRepository.findByKeycloakId(keycloakId).orElse(null);
                        if (hostUser != null) {
                            return sr.getProperty().getOwner().getId().equals(hostUser.getId());
                        }
                    }
                    return false;
                } else if (userRole == UserRole.HOUSEKEEPER || userRole == UserRole.TECHNICIAN || userRole == UserRole.LAUNDRY || userRole == UserRole.EXTERIOR_TECH || userRole == UserRole.SUPERVISOR) {
                    // Rôles opérationnels : seulement les demandes assignées à eux ou leurs équipes
                    String keycloakId = jwt.getSubject();
                    User currentUser = userRepository.findByKeycloakId(keycloakId).orElse(null);
                    if (currentUser != null) {
                        return (sr.getAssignedToType() != null && sr.getAssignedToType().equals("user") &&
                                sr.getAssignedToId() != null && sr.getAssignedToId().equals(currentUser.getId())) ||
                               (sr.getAssignedToType() != null && sr.getAssignedToType().equals("team") &&
                                sr.getAssignedToId() != null && isUserInTeam(currentUser.getId(), sr.getAssignedToId()));
                    }
                    return false;
                } else if (userRole == UserRole.SUPER_MANAGER) {
                    // MANAGER : demandes liées à ses portefeuilles ou créées par ses utilisateurs
                    // Pour simplifier, on laisse passer toutes les demandes pour les managers
                    // Le filtrage détaillé par portefeuille peut être ajouté plus tard si nécessaire
                    return true;
                }
                // ADMIN : toutes les demandes
                return true;
            })
            .filter(sr -> userId == null || (sr.getUser() != null && sr.getUser().getId().equals(userId)))
            .filter(sr -> propertyId == null || (sr.getProperty() != null && sr.getProperty().getId().equals(propertyId)))
            .filter(sr -> reservationId == null || (sr.getReservationId() != null && sr.getReservationId().equals(reservationId)))
            .filter(sr -> status == null || sr.getStatus().equals(status))
            .filter(sr -> serviceType == null || sr.getServiceType().equals(serviceType))
            .collect(Collectors.toList());

        // Appliquer la pagination
        int start = (int) Math.min(pageable.getOffset(), filtered.size());
        int end = Math.min(start + pageable.getPageSize(), filtered.size());
        List<ServiceRequest> pageContent = filtered.subList(start, end);

        return new PageImpl<>(readDtosWithMissionAssignment(pageContent), pageable, filtered.size());
    }

    /** Même projection pour détail, liste et recherche, sans recopier l’affectation en base. */
    List<ServiceRequestDto> readDtosWithMissionAssignment(List<ServiceRequest> requests) {
        if (requests.isEmpty()) return List.of();
        var deadlines=assignments.activeDeadlines(requests.stream().map(ServiceRequest::getId).toList());
        var missions = new java.util.HashMap<Long, Intervention>();
        requests.stream().collect(Collectors.groupingBy(ServiceRequest::getOrganizationId))
                .forEach((orgId, group) -> interventionRepository.findLinkedForServiceRequests(
                        orgId, group.stream().map(ServiceRequest::getId).toList())
                        .forEach(mission -> missions.put(mission.getServiceRequest().getId(), mission)));
        var result = requests.stream().map(request -> {
            ServiceRequestDto dto = serviceRequestMapper.toDto(request);
            dto.assignmentExpiresAt=deadlines.get(request.getId());
            Intervention mission = missions.get(request.getId());
            if (mission != null) serviceRequestMapper.projectMissionAssignment(dto, mission);
            return dto;
        }).toList();
        serviceRequestMapper.enrichPropertyPhotos(result);
        return result;
    }

    private boolean isUserInTeam(Long userId, Long teamId) {
        try {
            Team team = teamRepository.findById(teamId).orElse(null);
            if (team != null) {
                return team.getMembers().stream()
                    .anyMatch(member -> member.getUser().getId().equals(userId));
            }
        } catch (Exception e) {
            log.warn("Error checking team membership: {}", e.getMessage());
        }
        return false;
    }

    /**
     * SR en AWAITING_PAYMENT pour le planning (Gantt), avec resolution des noms
     * d'assignes (equipe/utilisateur) sans N+1.
     * Logique deplacee de ServiceRequestController (T-ARCH-01).
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getPlanningServiceRequests(List<Long> propertyIds,
                                                                LocalDateTime from,
                                                                LocalDateTime to) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        List<ServiceRequest> srList;
        if (propertyIds != null && !propertyIds.isEmpty()) {
            srList = serviceRequestRepository.findByStatusAndPropertyIdsAndDesiredDateBetween(
                    RequestStatus.AWAITING_PAYMENT, propertyIds, from, to, orgId);
        } else {
            srList = serviceRequestRepository.findByStatusAndDesiredDateBetween(
                    RequestStatus.AWAITING_PAYMENT, from, to, orgId);
        }

        // Pre-load team names to avoid N+1
        List<Long> teamIds = srList.stream()
                .filter(sr -> "team".equals(sr.getAssignedToType()) && sr.getAssignedToId() != null)
                .map(ServiceRequest::getAssignedToId)
                .distinct()
                .collect(Collectors.toList());
        final Map<Long, String> teamNameMap = !teamIds.isEmpty()
                ? teamRepository.findAllById(teamIds).stream()
                    .collect(Collectors.toMap(Team::getId, Team::getName, (a, b) -> a))
                : Map.of();

        // Pre-load user names
        List<Long> userIds = srList.stream()
                .filter(sr -> "user".equals(sr.getAssignedToType()) && sr.getAssignedToId() != null)
                .map(ServiceRequest::getAssignedToId)
                .distinct()
                .collect(Collectors.toList());
        final Map<Long, String> userNameMap = !userIds.isEmpty()
                ? userRepository.findAllById(userIds).stream()
                    .collect(Collectors.toMap(User::getId,
                        u -> (u.getFirstName() + " " + u.getLastName()).trim(), (a, b) -> a))
                : Map.of();

        return srList.stream()
                .map(sr -> toPlanningMap(sr, userNameMap, teamNameMap))
                .collect(Collectors.toList());
    }

    private Map<String, Object> toPlanningMap(ServiceRequest sr,
                                              Map<Long, String> userNameMap,
                                              Map<Long, String> teamNameMap) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", sr.getId());
        map.put("serviceItemCode", sr.getServiceItemCode());
        map.put("propertyId", sr.getProperty() != null ? sr.getProperty().getId() : null);
        map.put("propertyName", sr.getProperty() != null ? sr.getProperty().getName() : "");
        map.put("serviceType", sr.getServiceType() != null ? sr.getServiceType().name() : null);
        map.put("title", sr.getTitle());
        map.put("status", "AWAITING_PAYMENT");
        map.put("estimatedDurationHours", sr.getEstimatedDurationHours());
        map.put("estimatedCost", sr.getEstimatedCost());

        // Resolve assignee name
        String assigneeName = null;
        if ("user".equals(sr.getAssignedToType()) && sr.getAssignedToId() != null) {
            assigneeName = userNameMap.getOrDefault(sr.getAssignedToId(), "Utilisateur #" + sr.getAssignedToId());
        } else if ("team".equals(sr.getAssignedToType()) && sr.getAssignedToId() != null) {
            assigneeName = teamNameMap.getOrDefault(sr.getAssignedToId(), "Équipe #" + sr.getAssignedToId());
        }
        map.put("assignedToName", assigneeName);

        // Date/time from desiredDate
        if (sr.getDesiredDate() != null) {
            map.put("startDate", sr.getDesiredDate().toLocalDate().toString());
            map.put("startTime", sr.getDesiredDate().toLocalTime().toString());
            if (sr.getEstimatedDurationHours() != null) {
                LocalTime endTime = sr.getDesiredDate().toLocalTime()
                        .plusHours(sr.getEstimatedDurationHours());
                map.put("endTime", endTime.toString());
            } else {
                map.put("endTime", null);
            }
        } else {
            map.put("startDate", null);
            map.put("startTime", null);
            map.put("endTime", null);
        }

        // Linked reservation
        map.put("reservationId", sr.getReservationId());

        return map;
    }

    private void requireDirectControl(ServiceRequest request) {
        if (request.getMarketplaceRequestId() != null)
            throw new IllegalStateException("Ce besoin est piloté par son devis marketplace ; utilisez la sollicitation liée");
    }

    public void delete(Long id) {
        ServiceRequest request = serviceRequestRepository.findForMutation(id)
            .orElseThrow(() -> new NotFoundException("Service request not found"));
        requireOwnedServiceRequest(request);
        requireDirectControl(request);
        if (interventionRepository.existsByServiceRequestId(id))
            throw new IllegalStateException("Une demande avec une mission conserve son historique");
        serviceRequestRepository.delete(request);
    }



    /**
     * Convertit une intervention en DTO
     */
    private InterventionDto convertToInterventionDto(Intervention intervention) {
        InterventionDto dto = new InterventionDto();
        dto.id = intervention.getId();
        dto.title = intervention.getTitle();
        dto.description = intervention.getDescription();
        dto.type = intervention.getType();
        dto.status = intervention.getStatus().name();
        dto.priority = intervention.getPriority();
        dto.propertyId = intervention.getProperty() == null ? null : intervention.getProperty().getId();
        if (intervention.getProperty() != null && intervention.getProperty().getType() != null) {
            dto.propertyType = intervention.getProperty().getType().name().toLowerCase();
        }
        dto.requestorId = intervention.getRequestor().getId();

        // Conversion de LocalDateTime en String pour scheduledDate
        if (intervention.getScheduledDate() != null) {
            dto.scheduledDate = intervention.getScheduledDate().toString();
        }

        dto.estimatedDurationHours = intervention.getEstimatedDurationHours();
        dto.estimatedCost = intervention.getEstimatedCost();

        // Champs optionnels
        if (intervention.getNotes() != null) {
            dto.notes = intervention.getNotes();
        }

        dto.createdAt = intervention.getCreatedAt();
        dto.updatedAt = intervention.getUpdatedAt();

        return dto;
    }

    // ── Auto-assignation refactorisee ──────────────────────────────────────────

    /**
     * Tente l'auto-assignation d'une SR (contexte web — utilise TenantContext).
     * Appele depuis create() et refuse().
     *
     * @return true si une equipe a ete trouvee et assignee
     */
    public boolean attemptAutoAssign(ServiceRequest sr) {
        return attemptAutoAssignByOrgId(sr, sr.getOrganizationId());
    }

    /**
     * Tente l'auto-assignation dans le contexte scheduler (pas de TenantContext).
     * Utilise la surcharge PropertyTeamService avec orgId explicite.
     */
    public boolean attemptAutoAssignByOrgId(ServiceRequest sr, Long orgId) {
        assignments.requireOrganization(sr,orgId);
        // Les anciens dossiers restent à qualifier ; aucune échéance rétroactive.
        if (sr.getAssignmentPhase() == null) return false;
        return assignments.search(sr.getId(),orgId);
    }

    // ── Flux deterministe : menage automatique post-checkout (fiche 08, F1a/F2a/F4d) ──

    /**
     * Resultat explicite d'un flux automatique de menage : demande creee/annulee,
     * ou saut avec raison lisible (consommee par l'ExecutionResult du SPI moteur).
     */
    public record AutoCleaningOutcome(ServiceRequest request, String skipReason) {
        public boolean executed() { return request != null; }

        static AutoCleaningOutcome done(ServiceRequest request) {
            return new AutoCleaningOutcome(request, null);
        }

        static AutoCleaningOutcome skipped(String reason) {
            return new AutoCleaningOutcome(null, reason);
        }
    }

    /**
     * Cree la demande de menage automatique planifiee a la date de check-out
     * (heure de checkout de la propriete, dans son fuseau — les dates de sejour
     * sont deja en heure locale propriete). Appelee par l'executeur
     * CREATE_CLEANING_REQUEST du moteur AutomationRule et par le filet quotidien
     * (CleaningBackfillScheduler).
     *
     * <p>Contexte hors HTTP : orgId explicite partout, aucune dependance au
     * TenantContext. Idempotence metier : cle unique {@code AUTO_CLEANING:
     * propertyId:checkIn:checkOut} (index unique en base) — une re-livraison
     * Kafka, un double evenement BOOKED ou la course moteur/filet ne creent
     * qu'UNE demande.</p>
     */
    public AutoCleaningOutcome createAutomaticCleaningRequest(Long orgId, Long propertyId,
                                                              LocalDate checkIn, LocalDate checkOut,
                                                              Long reservationId) {
        if (orgId == null || propertyId == null || checkOut == null) {
            log.warn("Menage auto: parametres incomplets (orgId={}, propertyId={}, checkOut={}) — ignore",
                orgId, propertyId, checkOut);
            return AutoCleaningOutcome.skipped("parametres incomplets (orgId/propertyId/checkOut)");
        }

        Property property = propertyRepository.findById(propertyId).orElse(null);
        if (property == null) {
            log.warn("Menage auto: propriete {} introuvable — ignore", propertyId);
            return AutoCleaningOutcome.skipped("propriete " + propertyId + " introuvable");
        }
        // findById contourne le filtre Hibernate : validation d'organisation explicite.
        if (!orgId.equals(property.getOrganizationId())) {
            log.warn("Menage auto: propriete {} hors organisation {} — ignore", propertyId, orgId);
            return AutoCleaningOutcome.skipped("propriete " + propertyId + " hors organisation");
        }
        // AFTER_EACH_STAY = « apres chaque sejour » (pas de valeur AFTER_CHECKOUT dans l'enum).
        if (property.getCleaningFrequency() != CleaningFrequency.AFTER_EACH_STAY) {
            log.debug("Menage auto: propriete {} en frequence {} — ignore",
                propertyId, property.getCleaningFrequency());
            return AutoCleaningOutcome.skipped("frequence menage " + property.getCleaningFrequency()
                + " (AFTER_EACH_STAY requis)");
        }

        String autoFlowKey = buildAutoCleaningKey(propertyId, checkIn, checkOut);
        // Course 2 declenchements simultanes (re-livraison Kafka parallele, moteur x
        // filet backfill) : verrou advisory transactionnel AVANT le check d'existence.
        // Sans lui, les deux passent le check, le perdant percute l'index unique et sa
        // transaction — marquee rollback-only par le save() — n'est plus commitable :
        // le catch ci-dessous ne peut pas la sauver (UnexpectedRollbackException au
        // commit, bug revele par AutomationConcurrencyIT vague T3).
        serviceRequestRepository.acquireAutoFlowKeyLock(autoFlowKey);
        if (serviceRequestRepository.findByAutoFlowKey(autoFlowKey, orgId).isPresent()) {
            log.debug("Menage auto: demande deja existante pour {} — idempotent", autoFlowKey);
            return AutoCleaningOutcome.skipped("demande deja existante (cle " + autoFlowKey + ")");
        }

        User owner = property.getOwner();
        if (owner == null) {
            log.warn("Menage auto: propriete {} sans proprietaire (user_id obligatoire) — ignore", propertyId);
            return AutoCleaningOutcome.skipped("propriete sans proprietaire");
        }

        LocalDateTime desiredDate = checkOut.atTime(resolveCleaningStartTime(property));

        ServiceRequest sr = new ServiceRequest();
        sr.setOrganizationId(orgId);
        sr.setTitle(truncate("Menage apres depart - " + property.getName(), 100));
        sr.setDescription("Demande creee automatiquement (flux menage post-checkout) pour le sejour du "
            + (checkIn != null ? checkIn : "?") + " au " + checkOut + "."
            + (reservationId != null ? " Reservation #" + reservationId + "." : ""));
        sr.setServiceType(ServiceType.CLEANING);
        sr.setServiceItemCode(com.clenzy.service.pricing.ProviderTariffService.CLEANING);
        sr.setPriority(Priority.NORMAL);
        sr.setStatus(RequestStatus.PENDING);
        sr.setDesiredDate(desiredDate);
        sr.setGuestCheckoutTime(desiredDate);
        sr.setEstimatedDurationHours((int) Math.ceil(ServiceType.CLEANING.getEstimatedHours()));
        // Prix résolu (override logement prioritaire, sinon conseil moteur — plus
        // jamais null quand cleaningBasePrice est absent) + snapshot du conseil.
        ResolvedCleaningPrice resolvedPrice = cleaningPricingEngine
                .resolveCleaningPrice(property, CleaningPricingEngine.STANDARD_CLEANING, null,
                        desiredDate != null ? desiredDate.toLocalDate() : null);
        sr.setEstimatedCost(resolvedPrice.amount());
        sr.setRecommendedCost(resolvedPrice.quote().recommended());
        sr.setUser(owner);
        sr.setProperty(property);
        sr.setReservationId(reservationId);
        sr.setAutoFlowKey(autoFlowKey);

        try {
            sr = serviceRequestRepository.save(sr);
        } catch (DataIntegrityViolationException e) {
            // Dernier filet (createur passe HORS du verrou advisory ci-dessus, ex.
            // insertion manuelle) : l'index unique tranche. Attention : la transaction
            // englobante est alors deja marquee rollback-only par le save() — ce retour
            // "skipped" n'empeche pas un UnexpectedRollbackException au commit englobant.
            log.info("Menage auto: creation concurrente detectee pour {} — idempotent", autoFlowKey);
            return AutoCleaningOutcome.skipped("creation concurrente (cle " + autoFlowKey + ")");
        }

        log.info("Menage auto: demande {} creee (propriete {}, checkout {}, reservation {})",
            sr.getId(), propertyId, checkOut, reservationId);

        try {
            notificationService.notifyAdminsAndManagersByOrgId(orgId,
                NotificationKey.SERVICE_REQUEST_CREATED,
                "Menage post-checkout planifie",
                "Demande de menage creee automatiquement pour \"" + property.getName()
                    + "\" (depart du " + checkOut + ")",
                "/interventions?tab=service-requests&highlight=" + sr.getId(), requestFacts(sr));
        } catch (Exception e) {
            log.warn("Notification error menage auto SR {}: {}", sr.getId(), e.getMessage());
        }

        assignments.initialize(sr);

        return AutoCleaningOutcome.done(sr);
    }

    /**
     * Annule la demande de menage automatique liee a un sejour (event CANCELLED),
     * si elle existe et n'est pas deja commencee. La cle d'idempotence est
     * suffixee a l'annulation pour permettre une re-creation si les memes dates
     * sont re-reservees ensuite ; une re-livraison de l'annulation ne retrouve
     * plus la cle et devient un no-op.
     */
    public AutoCleaningOutcome cancelAutomaticCleaningRequest(Long orgId, Long propertyId,
                                                              LocalDate checkIn, LocalDate checkOut) {
        if (orgId == null || propertyId == null || checkOut == null) {
            return AutoCleaningOutcome.skipped("parametres incomplets (orgId/propertyId/checkOut)");
        }
        String autoFlowKey = buildAutoCleaningKey(propertyId, checkIn, checkOut);
        ServiceRequest sr = serviceRequestRepository.findByAutoFlowKey(autoFlowKey, orgId).orElse(null);
        if (sr == null) {
            log.debug("Annulation menage auto: aucune demande pour {} — no-op", autoFlowKey);
            return AutoCleaningOutcome.skipped("aucune demande de menage auto pour ce sejour");
        }
        sr = serviceRequestRepository.findForMutation(sr.getId()).orElse(null);
        if (sr == null || !orgId.equals(sr.getOrganizationId()) || !autoFlowKey.equals(sr.getAutoFlowKey())) {
            return AutoCleaningOutcome.skipped("demande modifiée pendant l'annulation du séjour");
        }
        if (RequestStatus.IN_PROGRESS.equals(sr.getStatus())) {
            log.info("Annulation menage auto: demande {} deja commencee — laissee en l'etat", sr.getId());
            return AutoCleaningOutcome.skipped("demande " + sr.getId() + " deja commencee");
        }
        if (!sr.getStatus().canTransitionTo(RequestStatus.CANCELLED)) {
            log.info("Annulation menage auto: demande {} en statut {} — non annulable", sr.getId(), sr.getStatus());
            return AutoCleaningOutcome.skipped("demande " + sr.getId() + " en statut " + sr.getStatus());
        }

        var cancellation = cancellationCoordination.inspectLegacyCancellation(sr);
        if (cancellation.blocker() != null) return AutoCleaningOutcome.skipped(cancellation.blocker());
        var linkedMission = cancellation.mission();
        if (linkedMission != null && linkedMission.getStatus() != InterventionStatus.PENDING
                && linkedMission.getStatus() != InterventionStatus.CANCELLED)
            return AutoCleaningOutcome.skipped("La mission liée exige une décision du gestionnaire");
        if (linkedMission != null) linkedMission.setStatus(InterventionStatus.CANCELLED);
        sr.setStatus(RequestStatus.CANCELLED);
        sr.setAutoAssignStatus(null);
        // Libere la cle : une re-reservation des memes dates recree un menage.
        sr.setAutoFlowKey(truncate(autoFlowKey + ":CANCELLED:" + sr.getId(), 120));
        serviceRequestRepository.save(sr);

        log.info("Annulation menage auto: demande {} annulee (propriete {}, checkout {})",
            sr.getId(), propertyId, checkOut);

        try {
            notificationService.notifyAdminsAndManagersByOrgId(orgId,
                NotificationKey.SERVICE_REQUEST_CANCELLED,
                "Menage post-checkout annule",
                "La reservation liee a ete annulee : la demande de menage \"" + sr.getTitle()
                    + "\" a ete annulee automatiquement.",
                "/interventions?tab=service-requests&highlight=" + sr.getId(), requestFacts(sr));
        } catch (Exception e) {
            log.warn("Notification error annulation menage auto SR {}: {}", sr.getId(), e.getMessage());
        }
        return AutoCleaningOutcome.done(sr);
    }

    /** Cle d'idempotence metier : propriete x dates de sejour. */
    public static String buildAutoCleaningKey(Long propertyId, LocalDate checkIn, LocalDate checkOut) {
        return AUTO_CLEANING_KEY_PREFIX + ":" + propertyId + ":" + (checkIn != null ? checkIn : "NA")
            + ":" + checkOut;
    }

    /** Heure de debut du menage : heure de checkout de la propriete, repli 11:00. */
    private static LocalTime resolveCleaningStartTime(Property property) {
        String raw = property.getDefaultCheckOutTime();
        if (raw == null || raw.isBlank()) {
            return DEFAULT_CLEANING_START;
        }
        try {
            return LocalTime.parse(raw.trim());
        } catch (DateTimeParseException e) {
            return DEFAULT_CLEANING_START;
        }
    }

    private static String truncate(String value, int max) {
        return value != null && value.length() > max ? value.substring(0, max) : value;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────────

    private void logAssignmentEvent(ServiceRequest sr, String eventType,
                                     Long teamId, String assignedToType, String reason) {
        try {
            AssignmentEvent event = new AssignmentEvent();
            event.setOrganizationId(sr.getOrganizationId());
            event.setServiceRequestId(sr.getId());
            event.setEventType(eventType);
            event.setTeamId(teamId);
            event.setAssignedToType(assignedToType);
            event.setReason(reason);
            assignmentEventRepository.save(event);
        } catch (Exception e) {
            log.warn("Failed to log assignment event {} for SR {}: {}", eventType, sr.getId(), e.getMessage());
        }
    }

    private void notifyHost(ServiceRequest sr, NotificationKey key, String title, String msg) {
        if (sr.getUser() != null && sr.getUser().getKeycloakId() != null) {
            notificationService.notify(sr.getUser().getKeycloakId(), key, title, msg,
                "/interventions?tab=service-requests&highlight=" + sr.getId(), requestFacts(sr));
        }
    }

    private void notifyHostByOrgId(ServiceRequest sr, Long orgId, NotificationKey key, String title, String msg) {
        if (sr.getUser() != null && sr.getUser().getKeycloakId() != null) {
            notificationService.sendByOrgId(sr.getUser().getKeycloakId(), key, title, msg,
                "/interventions?tab=service-requests&highlight=" + sr.getId(), orgId, requestFacts(sr));
        }
    }


    /**
     * Faits joints aux notifications de demande : quel logement, quelle
     * demande, et a qui elle est confiee. Deja charges par le flux qui notifie.
     */
    private static Map<String, Object> requestFacts(ServiceRequest sr) {
        if (sr == null) return null;
        return NotificationMetadata.of()
                .property(sr.getProperty() != null ? sr.getProperty().getName() : null)
                .propertyId(sr.getProperty() != null ? sr.getProperty().getId() : null)
                .request(sr.getTitle())
                // L'identifiant permet a la fiche d'aller lire la demande ENTIERE
                // — devis, echeance, prestataire — la ou le message n'en porte
                // que l'intitule.
                .serviceRequestId(sr.getId())
                .build();
    }
}
