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
import com.clenzy.config.KafkaConfig;
import com.clenzy.service.pricing.CleaningPricingEngine;
import com.clenzy.service.pricing.CleaningPricingEngine.ResolvedCleaningPrice;
import com.clenzy.tenant.TenantContext;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.kafka.core.KafkaTemplate;
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
    private final KafkaTemplate<String, Object> kafkaTemplate;
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

    public ServiceRequestService(ServiceRequestRepository serviceRequestRepository,
                                  UserRepository userRepository,
                                  PropertyRepository propertyRepository,
                                  InterventionRepository interventionRepository,
                                  ReservationRepository reservationRepository,
                                  TeamRepository teamRepository,
                                  NotificationService notificationService,
                                  PropertyTeamService propertyTeamService,
                                  KafkaTemplate<String, Object> kafkaTemplate,
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
                                  com.clenzy.service.agent.supervision.AutoApplyGate autoApplyGate) {
        this.serviceRequestRepository = serviceRequestRepository;
        this.userRepository = userRepository;
        this.propertyRepository = propertyRepository;
        this.interventionRepository = interventionRepository;
        this.reservationRepository = reservationRepository;
        this.teamRepository = teamRepository;
        this.notificationService = notificationService;
        this.propertyTeamService = propertyTeamService;
        this.kafkaTemplate = kafkaTemplate;
        this.tenantContext = tenantContext;
        this.serviceRequestMapper = serviceRequestMapper;
        this.assignmentEventRepository = assignmentEventRepository;
        this.workflowSettingsRepository = workflowSettingsRepository;
        this.cleaningPricingEngine = cleaningPricingEngine;
        this.housekeeperScoreService = housekeeperScoreService;
        this.supervisionSuggestionService = supervisionSuggestionService;
        this.supervisionAutoApplyService = supervisionAutoApplyService;
        this.autoApplyGate = autoApplyGate;
    }

    public ServiceRequestDto create(ServiceRequestDto dto) {
        ServiceRequest entity = new ServiceRequest();
        serviceRequestMapper.apply(dto, entity);
        entity.setOrganizationId(tenantContext.getRequiredOrganizationId());
        entity = serviceRequestRepository.save(entity);

        try {
            notificationService.notifyAdminsAndManagers(
                NotificationKey.SERVICE_REQUEST_CREATED,
                "Nouvelle demande de service",
                "Demande \"" + entity.getTitle() + "\" creee",
                "/interventions?tab=service-requests&highlight=" + entity.getId()
            );
        } catch (Exception e) {
            log.warn("Notification error SERVICE_REQUEST_CREATED: {}", e.getMessage());
        }

        // ── Auto-assignation basee sur zone geographique + disponibilite ──
        attemptAutoAssign(entity);

        return serviceRequestMapper.toDto(entity);
    }

    /**
     * Refus d'une assignation par l'equipe/utilisateur assigne.
     * Remet la SR en PENDING pour reassignation.
     */
    public ServiceRequestDto refuse(Long serviceRequestId) {
        ServiceRequest sr = serviceRequestRepository.findById(serviceRequestId)
                .orElseThrow(() -> new NotFoundException("Demande de service non trouvee"));

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
                "/interventions?tab=service-requests&highlight=" + sr.getId()
            );
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
        ServiceRequest sr = serviceRequestRepository.findById(serviceRequestId)
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
     * Assignation manuelle par un admin/manager.
     */
    public ServiceRequestDto manualAssign(Long serviceRequestId, Long assignedToId, String assignedToType) {
        ServiceRequest sr = serviceRequestRepository.findById(serviceRequestId)
                .orElseThrow(() -> new NotFoundException("Demande de service non trouvee"));

        if (!RequestStatus.PENDING.equals(sr.getStatus()) && !RequestStatus.AWAITING_PAYMENT.equals(sr.getStatus()) && !RequestStatus.ASSIGNED.equals(sr.getStatus())) {
            throw new IllegalStateException("Seules les demandes en attente ou en attente de paiement peuvent etre (re)assignees manuellement. Statut actuel: " + sr.getStatus());
        }

        sr.setAssignedToId(assignedToId);
        sr.setAssignedToType(assignedToType);
        // Moteur Ménage 2A : assignation d'un PRO sur une SR ménage non payée
        // (garde de statut ci-dessus : PENDING/AWAITING_PAYMENT/ASSIGNED) →
        // le prix pratiqué suit son tarif. Le conseil (recommendedCost) est INCHANGÉ.
        if ("user".equals(assignedToType) && sr.getPaidAt() == null
                && sr.getProperty() != null
                && sr.getServiceType() != null && sr.getServiceType().isCleaningService()) {
            var resolved = cleaningPricingEngine.resolveCleaningPrice(
                    sr.getProperty(), sr.getServiceType().name(), assignedToId);
            if (resolved.source() == com.clenzy.service.pricing.CleaningPricingEngine.CleaningPriceSource.HOUSEKEEPER_RATE) {
                sr.setEstimatedCost(resolved.amount());
                log.info("SR {} : cout reevalue au tarif du pro {} → {}", sr.getId(), assignedToId, resolved.amount());
            }
        }
        sr.setStatus(RequestStatus.AWAITING_PAYMENT);
        sr.setAutoAssignStatus("found");
        sr = serviceRequestRepository.save(sr);

        logAssignmentEvent(sr, "MANUAL_ASSIGN", assignedToId, assignedToType,
            "Assignation manuelle par admin/manager");

        log.info("Manual assignment: {} {} for SR {}", assignedToType, assignedToId, sr.getId());

        return serviceRequestMapper.toDto(sr);
    }

    /**
     * Cree une intervention a partir d'une SR payee.
     * Appelee apres confirmation du paiement Stripe.
     */
    public Intervention createInterventionFromPaidServiceRequest(ServiceRequest sr) {
        if (interventionRepository.existsByServiceRequestId(sr.getId())) {
            log.warn("Intervention already exists for SR {} — skipping creation", sr.getId());
            return null;
        }

        Intervention intervention = new Intervention();
        String title = sr.getTitle();
        intervention.setTitle(title != null && title.length() > 255 ? title.substring(0, 255) : title);
        String description = sr.getDescription();
        intervention.setDescription(description != null && description.length() > 500 ? description.substring(0, 500) : description);

        String interventionType = mapServiceTypeToInterventionType(sr.getServiceType());
        intervention.setType(interventionType);

        intervention.setStatus(InterventionStatus.PENDING);
        intervention.setPaymentStatus(com.clenzy.model.PaymentStatus.PAID);
        intervention.setPaidAt(sr.getPaidAt());
        intervention.setPriority(sr.getPriority().name());
        intervention.setProperty(sr.getProperty());
        intervention.setRequestor(sr.getUser());
        intervention.setServiceRequest(sr);
        intervention.setScheduledDate(sr.getDesiredDate());
        intervention.setEstimatedDurationHours(sr.getEstimatedDurationHours());
        intervention.setEstimatedCost(sr.getEstimatedCost());
        intervention.setRecommendedCost(sr.getRecommendedCost());
        intervention.setIsUrgent(sr.isUrgent());
        intervention.setStartTime(sr.getDesiredDate());
        intervention.setRequiresFollowUp(false);

        // Assigner la meme equipe/user que la SR
        if ("team".equals(sr.getAssignedToType()) && sr.getAssignedToId() != null) {
            intervention.setTeamId(sr.getAssignedToId());
        } else if ("user".equals(sr.getAssignedToType()) && sr.getAssignedToId() != null) {
            User assignedUser = userRepository.findById(sr.getAssignedToId()).orElse(null);
            if (assignedUser != null) {
                intervention.setAssignedUser(assignedUser);
                intervention.setAssignedTechnicianId(sr.getAssignedToId());
            }
        }

        intervention.setOrganizationId(sr.getOrganizationId());
        intervention = interventionRepository.save(intervention);
        log.info("Intervention {} created from paid SR {}", intervention.getId(), sr.getId());

        // Lier l'intervention a la reservation associee (pour affichage planning)
        if (sr.getReservationId() != null) {
            try {
                Reservation reservation = reservationRepository.findById(sr.getReservationId()).orElse(null);
                if (reservation != null) {
                    reservation.setIntervention(intervention);
                    reservationRepository.save(reservation);
                    log.info("Intervention {} linked to reservation {}", intervention.getId(), sr.getReservationId());
                }
            } catch (Exception e) {
                log.warn("Failed to link intervention {} to reservation {}: {}", intervention.getId(), sr.getReservationId(), e.getMessage());
            }
        }

        // Generation FACTURE via Kafka
        try {
            String emailTo = sr.getUser() != null ? sr.getUser().getEmail() : null;
            kafkaTemplate.send(
                KafkaConfig.TOPIC_DOCUMENT_GENERATE,
                "facture-sr-" + sr.getId(),
                Map.of(
                    "documentType", "FACTURE",
                    "referenceId", sr.getId(),
                    "referenceType", "service_request",
                    "emailTo", emailTo != null ? emailTo : ""
                )
            );
        } catch (Exception e) {
            log.warn("Kafka publish error FACTURE for SR {}: {}", sr.getId(), e.getMessage());
        }

        // Notifier les admins
        try {
            notificationService.notifyAdminsAndManagers(
                NotificationKey.INTERVENTION_AWAITING_VALIDATION,
                "Intervention creee apres paiement",
                "L'intervention \"" + intervention.getTitle() + "\" a ete creee suite au paiement de la demande de service."
                    + (intervention.getEstimatedCost() != null
                        ? " Cout estime: " + intervention.getEstimatedCost().stripTrailingZeros().toPlainString() + " EUR."
                        : ""),
                "/interventions/" + intervention.getId()
            );
        } catch (Exception e) {
            log.warn("Notification error INTERVENTION_CREATED_FROM_SR: {}", e.getMessage());
        }

        return intervention;
    }

    public ServiceRequestDto update(Long id, ServiceRequestDto dto) {
        ServiceRequest entity = serviceRequestRepository.findById(id).orElseThrow(() -> new NotFoundException("Service request not found"));
        serviceRequestMapper.apply(dto, entity);
        entity = serviceRequestRepository.save(entity);
        ServiceRequestDto result = serviceRequestMapper.toDto(entity);

        // Notify requester if the status changed to REJECTED
        try {
            if (RequestStatus.REJECTED.equals(entity.getStatus()) && entity.getUser() != null && entity.getUser().getKeycloakId() != null) {
                notificationService.notify(
                    entity.getUser().getKeycloakId(),
                    NotificationKey.SERVICE_REQUEST_REJECTED,
                    "Demande de service refusee",
                    "Votre demande \"" + entity.getTitle() + "\" a ete refusee",
                    "/interventions?tab=service-requests&highlight=" + entity.getId()
                );
            }
        } catch (Exception e) {
            log.warn("Notification error SERVICE_REQUEST_REJECTED: {}", e.getMessage());
        }

        return result;
    }

    @Transactional(readOnly = true)
    public ServiceRequestDto getById(Long id) {
        return serviceRequestMapper.toDto(serviceRequestRepository.findById(id).orElseThrow(() -> new NotFoundException("Service request not found")));
    }

    @Transactional(readOnly = true)
    public List<ServiceRequestDto> list() {
        return serviceRequestRepository.findAllWithRelations(tenantContext.getRequiredOrganizationId()).stream().map(serviceRequestMapper::toDto).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Page<ServiceRequestDto> list(Pageable pageable) {
        // Pour la pagination, on doit d'abord récupérer les IDs puis charger avec relations
        Page<ServiceRequest> page = serviceRequestRepository.findAll(pageable);
        List<ServiceRequest> withRelations = serviceRequestRepository.findAllWithRelations(tenantContext.getRequiredOrganizationId());

        // Filtrer selon la pagination
        int start = (int) pageable.getOffset();
        int end = Math.min(start + pageable.getPageSize(), withRelations.size());
        List<ServiceRequest> pageContent = withRelations.subList(start, end);

        return new PageImpl<>(pageContent.stream().map(serviceRequestMapper::toDto).collect(Collectors.toList()), pageable, page.getTotalElements());
    }

    @Transactional(readOnly = true)
    public Page<ServiceRequestDto> search(Pageable pageable, Long userId, Long propertyId, com.clenzy.model.RequestStatus status, com.clenzy.model.ServiceType serviceType) {
        // Utiliser la méthode avec relations et filtrer ensuite
        List<ServiceRequest> allWithRelations = serviceRequestRepository.findAllWithRelations(tenantContext.getRequiredOrganizationId());

        // Filtrer selon les critères
        List<ServiceRequest> filtered = allWithRelations.stream()
            .filter(sr -> userId == null || (sr.getUser() != null && sr.getUser().getId().equals(userId)))
            .filter(sr -> propertyId == null || (sr.getProperty() != null && sr.getProperty().getId().equals(propertyId)))
            .filter(sr -> status == null || sr.getStatus().equals(status))
            .filter(sr -> serviceType == null || sr.getServiceType().equals(serviceType))
            .collect(Collectors.toList());

        // Appliquer la pagination
        int start = (int) pageable.getOffset();
        int end = Math.min(start + pageable.getPageSize(), filtered.size());
        List<ServiceRequest> pageContent = filtered.subList(start, end);

        return new PageImpl<>(pageContent.stream().map(serviceRequestMapper::toDto).collect(Collectors.toList()), pageable, filtered.size());
    }

    @Transactional(readOnly = true)
    public Page<ServiceRequestDto> searchWithRoleBasedAccess(Pageable pageable, Long userId, Long propertyId,
                                                             Long reservationId,
                                                             com.clenzy.model.RequestStatus status,
                                                             com.clenzy.model.ServiceType serviceType,
                                                             Jwt jwt) {
        if (jwt == null) {
            // Si pas de JWT, utiliser la méthode standard
            return search(pageable, userId, propertyId, status, serviceType);
        }

        UserRole userRole = JwtRoleExtractor.extractUserRole(jwt);
        log.debug("searchWithRoleBasedAccess - Role: {}", userRole);

        // Utiliser la méthode avec relations et filtrer ensuite
        List<ServiceRequest> allWithRelations = serviceRequestRepository.findAllWithRelations(tenantContext.getRequiredOrganizationId());

        // Filtrer selon le rôle
        List<ServiceRequest> filtered = allWithRelations.stream()
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
        int start = (int) pageable.getOffset();
        int end = Math.min(start + pageable.getPageSize(), filtered.size());
        List<ServiceRequest> pageContent = filtered.subList(start, end);

        return new PageImpl<>(pageContent.stream().map(serviceRequestMapper::toDto).collect(Collectors.toList()), pageable, filtered.size());
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

    public void delete(Long id) {
        if (!serviceRequestRepository.existsById(id)) throw new NotFoundException("Service request not found");
        serviceRequestRepository.deleteById(id);
    }



    /**
     * Mappe le type de service vers le type d'intervention
     */
    /**
     * MM-3D — auto-assignation du meilleur pro (opt-in org, défaut FALSE).
     * APRÈS la sélection d'équipe existante (le choix d'équipe ne change pas) :
     * si la SR est un ménage, classe les membres HOUSEKEEPER de l'équipe et pose
     * l'assignation sur le meilleur (assignedToType=user). Classement documenté :
     *   1) score qualité 30 j décroissant ;
     *   2) à score proche (±10 pts) : tarif résolu le plus PROCHE de la médiane
     *      conseil (cohérent avec l'ancrage médiane — ni le moins cher ni le plus cher) ;
     *   3) tie-break : le moins de missions ouvertes le jour de la demande (équilibrage).
     * Gardes : jamais d'écrasement d'un user déjà assigné ; uniquement à la
     * création auto. L'assignation user déclenche le tarif MM-2A (même logique
     * que manualAssign) + push INTERVENTION_ASSIGNED_TO_USER (l'email MM-2B part
     * à la création de l'intervention, hors périmètre SR).
     */
    private void maybeUpgradeToBestPro(ServiceRequest sr, Long teamId) {
        try {
            if (!cleaningPricingEngine.isAutoAssignBestProEnabled()) return;
            if (sr.getServiceType() == null || !sr.getServiceType().isCleaningService()) return;
            if (sr.getProperty() == null) return;

            Team team = teamRepository.findById(teamId).orElse(null);
            if (team == null || team.getMembers() == null || team.getMembers().isEmpty()) return;

            Long orgId = sr.getOrganizationId();
            java.time.LocalDateTime day = sr.getDesiredDate() != null ? sr.getDesiredDate() : LocalDateTime.now();
            java.time.LocalDateTime dayStart = day.toLocalDate().atStartOfDay();
            java.time.LocalDateTime dayEnd = dayStart.plusDays(1);
            var median = cleaningPricingEngine
                    .quote(sr.getProperty(), sr.getServiceType().name()).recommended();

            record Candidate(User user, int score, java.math.BigDecimal rateDistance, long openCount) {}
            java.util.List<Candidate> candidates = new java.util.ArrayList<>();
            for (var member : team.getMembers()) {
                User user = member.getUser();
                if (user == null || user.getRole() != UserRole.HOUSEKEEPER) continue;
                int score = housekeeperScoreService.computeScore(user.getId(), orgId).score();
                var resolved = cleaningPricingEngine.resolveCleaningPrice(
                        sr.getProperty(), sr.getServiceType().name(), user.getId());
                java.math.BigDecimal distance = resolved.amount().subtract(median).abs();
                long open = interventionRepository.countOpenOnDay(user.getId(), orgId, dayStart, dayEnd);
                candidates.add(new Candidate(user, score, distance, open));
            }
            if (candidates.isEmpty()) return;

            // Classement : score desc ; à ±10 pts, distance à la médiane asc ; puis charge asc.
            candidates.sort((a, b) -> {
                if (Math.abs(a.score() - b.score()) > 10) {
                    return Integer.compare(b.score(), a.score());
                }
                int byDistance = a.rateDistance().compareTo(b.rateDistance());
                if (byDistance != 0) return byDistance;
                return Long.compare(a.openCount(), b.openCount());
            });
            User best = candidates.get(0).user();

            // Garde absolue : jamais écraser une assignation USER existante.
            if ("user".equals(sr.getAssignedToType())) return;

            sr.setAssignedToType("user");
            sr.setAssignedToId(best.getId());
            // Tarif MM-2A : même logique que manualAssign (source HOUSEKEEPER_RATE seulement).
            if (sr.getPaidAt() == null) {
                var resolved = cleaningPricingEngine.resolveCleaningPrice(
                        sr.getProperty(), sr.getServiceType().name(), best.getId());
                if (resolved.source() == com.clenzy.service.pricing.CleaningPricingEngine.CleaningPriceSource.HOUSEKEEPER_RATE) {
                    sr.setEstimatedCost(resolved.amount());
                }
            }
            logAssignmentEvent(sr, "AUTO_BEST_PRO", best.getId(), "user",
                    "Meilleur pro de l'equipe " + teamId + " (score qualite)");
            if (best.getKeycloakId() != null) {
                String remuneration = sr.getEstimatedCost() != null
                        ? " Remuneration: " + sr.getEstimatedCost().stripTrailingZeros().toPlainString() + " EUR."
                        : "";
                notificationService.send(best.getKeycloakId(), NotificationKey.INTERVENTION_ASSIGNED_TO_USER,
                        "Mission assignee",
                        "Vous etes assigne a la mission '" + sr.getTitle() + "'." + remuneration,
                        "/interventions?tab=service-requests&highlight=" + sr.getId(), orgId);
            }
            log.info("Auto-assign best pro: user {} (team {}) for SR {}", best.getId(), teamId, sr.getId());
        } catch (Exception e) {
            // Best-effort : l'échec du sélecteur laisse l'assignation ÉQUIPE intacte.
            log.warn("maybeUpgradeToBestPro failed for SR {}: {}", sr.getId(), e.getMessage());
        }
    }

    private String mapServiceTypeToInterventionType(com.clenzy.model.ServiceType serviceType) {
        if (serviceType == null) {
            return InterventionType.PREVENTIVE_MAINTENANCE.name();
        }

        switch (serviceType) {
            case CLEANING:
            case EXPRESS_CLEANING:
            case DEEP_CLEANING:
            case WINDOW_CLEANING:
            case FLOOR_CLEANING:
            case KITCHEN_CLEANING:
            case BATHROOM_CLEANING:
            case EXTERIOR_CLEANING:
            case DISINFECTION:
                return InterventionType.CLEANING.name();
            case PREVENTIVE_MAINTENANCE:
            case EMERGENCY_REPAIR:
            case ELECTRICAL_REPAIR:
            case PLUMBING_REPAIR:
            case HVAC_REPAIR:
            case APPLIANCE_REPAIR:
            case GARDENING:
            case PEST_CONTROL:
            case RESTORATION:
            default:
                return InterventionType.PREVENTIVE_MAINTENANCE.name();
        }
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
        dto.propertyId = intervention.getProperty().getId();
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
        try {
            // Verifier les preconditions
            if (sr.getAssignedToId() != null || sr.getProperty() == null || sr.getDesiredDate() == null) {
                return false;
            }

            // Verifier workflow settings de l'org
            Long orgId = sr.getOrganizationId();
            WorkflowSettings ws = workflowSettingsRepository.findByOrganizationId(orgId).orElse(null);
            if (ws != null && !ws.isAutoAssignInterventions()) {
                log.debug("Auto-assignation desactivee pour org={}", orgId);
                return false;
            }

            String svcType = sr.getServiceType() != null ? sr.getServiceType().name() : null;
            Optional<Long> availableTeamId = propertyTeamService.findAvailableTeamForProperty(
                sr.getProperty().getId(), sr.getDesiredDate(), sr.getEstimatedDurationHours(), svcType
            );

            sr.setLastAutoAssignAttempt(LocalDateTime.now());

            if (availableTeamId.isPresent()) {
                sr.setAssignedToId(availableTeamId.get());
                sr.setAssignedToType("team");
                // MM-3D : si l'org a activé autoAssignBestPro, promeut le MEILLEUR
                // housekeeper de l'équipe retenue en assignation user (opt-in,
                // défaut false = comportement actuel strictement intact).
                maybeUpgradeToBestPro(sr, availableTeamId.get());
                sr.setStatus(RequestStatus.AWAITING_PAYMENT);
                sr.setAutoAssignStatus("found");
                serviceRequestRepository.save(sr);

                logAssignmentEvent(sr, "AUTO_SUCCESS", availableTeamId.get(), "team", null);

                log.info("Auto-assignment: team {} assigned to SR {} for property {}",
                    availableTeamId.get(), sr.getId(), sr.getProperty().getId());

                try {
                    Team assignedTeam = teamRepository.findById(availableTeamId.get()).orElse(null);
                    String teamName = assignedTeam != null ? assignedTeam.getName() : "Equipe #" + availableTeamId.get();
                    notificationService.notifyAdminsAndManagers(
                        NotificationKey.SERVICE_REQUEST_TEAM_ASSIGNED,
                        "Demande auto-assignee",
                        "La demande \"" + sr.getTitle() + "\" a ete auto-assignee a " + teamName,
                        "/interventions?tab=service-requests&highlight=" + sr.getId()
                    );
                    notifyHost(sr, NotificationKey.SERVICE_REQUEST_TEAM_ASSIGNED,
                        "Equipe assignee",
                        "Une equipe a ete assignee a votre demande \"" + sr.getTitle() + "\" — en attente de paiement");
                } catch (Exception notifErr) {
                    log.warn("Notification error auto-assignment: {}", notifErr.getMessage());
                }

                return true;
            } else {
                // Pas d'equipe trouvee
                int currentRetry = (sr.getAutoAssignRetryCount() != null ? sr.getAutoAssignRetryCount() : 0) + 1;
                sr.setAutoAssignRetryCount(currentRetry);
                sr.setAutoAssignStatus(currentRetry >= MAX_AUTO_ASSIGN_RETRIES ? "exhausted" : "searching");
                serviceRequestRepository.save(sr);

                logAssignmentEvent(sr, "AUTO_FAIL", null, null,
                    "Aucune equipe disponible (tentative " + currentRetry + "/" + MAX_AUTO_ASSIGN_RETRIES + ")");

                log.debug("Auto-assignment: no team available for SR {} (retry {}/{})",
                    sr.getId(), currentRetry, MAX_AUTO_ASSIGN_RETRIES);

                // Notification premiere tentative
                if (currentRetry == 1) {
                    try {
                        notificationService.notifyAdminsAndManagers(
                            NotificationKey.SERVICE_REQUEST_NO_TEAM_AVAILABLE,
                            "Aucune equipe disponible",
                            "La demande \"" + sr.getTitle() + "\" n'a pas pu etre assignee. Retry automatique dans 15 min.",
                            "/interventions?tab=service-requests&highlight=" + sr.getId()
                        );
                        notifyHost(sr, NotificationKey.SERVICE_REQUEST_NO_TEAM_AVAILABLE,
                            "Recherche en cours",
                            "Nous recherchons une equipe pour votre demande \"" + sr.getTitle() + "\"");
                    } catch (Exception e) {
                        log.warn("Notification error NO_TEAM: {}", e.getMessage());
                    }
                }

                // Escalade a MAX retries
                if ("exhausted".equals(sr.getAutoAssignStatus())) {
                    try {
                        logAssignmentEvent(sr, "ESCALATION", null, null,
                            "Retries epuises (" + MAX_AUTO_ASSIGN_RETRIES + ") — assignation manuelle requise");
                        notificationService.notifyAdminsAndManagers(
                            NotificationKey.SERVICE_REQUEST_ESCALATION,
                            "ACTION REQUISE — Assignation manuelle",
                            "La demande \"" + sr.getTitle() + "\" n'a pas pu etre assignee apres " + MAX_AUTO_ASSIGN_RETRIES + " tentatives. Assignation manuelle necessaire.",
                            "/interventions?tab=service-requests&highlight=" + sr.getId()
                        );
                        notifyHost(sr, NotificationKey.SERVICE_REQUEST_ESCALATION,
                            "Assignation impossible",
                            "Nous n'avons pas pu trouver d'equipe pour votre demande \"" + sr.getTitle() + "\". Un administrateur va intervenir.");
                    } catch (Exception e) {
                        log.warn("Notification error ESCALATION: {}", e.getMessage());
                    }
                }

                return false;
            }
        } catch (Exception e) {
            log.warn("Auto-assignment failed for SR {}: {} — SR stays PENDING", sr.getId(), e.getMessage());
            return false;
        }
    }

    /**
     * Tente l'auto-assignation dans le contexte scheduler (pas de TenantContext).
     * Utilise la surcharge PropertyTeamService avec orgId explicite.
     */
    public boolean attemptAutoAssignByOrgId(ServiceRequest sr, Long orgId) {
        try {
            if (sr.getAssignedToId() != null || sr.getProperty() == null || sr.getDesiredDate() == null) {
                return false;
            }

            String svcType = sr.getServiceType() != null ? sr.getServiceType().name() : null;
            Optional<Long> availableTeamId = propertyTeamService.findAvailableTeamForProperty(
                sr.getProperty().getId(), sr.getDesiredDate(), sr.getEstimatedDurationHours(), svcType, orgId
            );

            sr.setLastAutoAssignAttempt(LocalDateTime.now());

            if (availableTeamId.isPresent()) {
                sr.setAssignedToId(availableTeamId.get());
                sr.setAssignedToType("team");
                // MM-3D : si l'org a activé autoAssignBestPro, promeut le MEILLEUR
                // housekeeper de l'équipe retenue en assignation user (opt-in,
                // défaut false = comportement actuel strictement intact).
                maybeUpgradeToBestPro(sr, availableTeamId.get());
                sr.setStatus(RequestStatus.AWAITING_PAYMENT);
                sr.setAutoAssignStatus("found");
                serviceRequestRepository.save(sr);

                logAssignmentEvent(sr, "AUTO_SUCCESS", availableTeamId.get(), "team", "Retry scheduler");

                log.info("Auto-assignment (scheduler): team {} assigned to SR {}", availableTeamId.get(), sr.getId());

                try {
                    Team assignedTeam = teamRepository.findById(availableTeamId.get()).orElse(null);
                    String teamName = assignedTeam != null ? assignedTeam.getName() : "Equipe #" + availableTeamId.get();
                    notificationService.notifyAdminsAndManagersByOrgId(orgId,
                        NotificationKey.SERVICE_REQUEST_TEAM_ASSIGNED,
                        "Demande auto-assignee (retry)",
                        "La demande \"" + sr.getTitle() + "\" a ete auto-assignee a " + teamName,
                        "/interventions?tab=service-requests&highlight=" + sr.getId()
                    );
                    notifyHostByOrgId(sr, orgId, NotificationKey.SERVICE_REQUEST_TEAM_ASSIGNED,
                        "Equipe assignee",
                        "Une equipe a ete assignee a votre demande \"" + sr.getTitle() + "\" — en attente de paiement");
                } catch (Exception notifErr) {
                    log.warn("Notification error auto-assignment scheduler: {}", notifErr.getMessage());
                }

                return true;
            } else {
                int retryCount = (sr.getAutoAssignRetryCount() != null ? sr.getAutoAssignRetryCount() : 0) + 1;
                sr.setAutoAssignRetryCount(retryCount);
                sr.setAutoAssignStatus(retryCount >= MAX_AUTO_ASSIGN_RETRIES ? "exhausted" : "searching");
                serviceRequestRepository.save(sr);

                logAssignmentEvent(sr, "AUTO_FAIL", null, null,
                    "Scheduler retry " + retryCount + "/" + MAX_AUTO_ASSIGN_RETRIES);

                log.debug("Auto-assignment (scheduler): no team for SR {} (retry {}/{})",
                    sr.getId(), retryCount, MAX_AUTO_ASSIGN_RETRIES);

                // Escalade a MAX retries
                if ("exhausted".equals(sr.getAutoAssignStatus())) {
                    try {
                        logAssignmentEvent(sr, "ESCALATION", null, null,
                            "Retries epuises — assignation manuelle requise");
                        notificationService.notifyAdminsAndManagersByOrgId(orgId,
                            NotificationKey.SERVICE_REQUEST_ESCALATION,
                            "ACTION REQUISE — Assignation manuelle",
                            "La demande \"" + sr.getTitle() + "\" n'a pas pu etre assignee apres " + MAX_AUTO_ASSIGN_RETRIES + " tentatives.",
                            "/interventions?tab=service-requests&highlight=" + sr.getId()
                        );
                        notifyHostByOrgId(sr, orgId, NotificationKey.SERVICE_REQUEST_ESCALATION,
                            "Assignation impossible",
                            "Nous n'avons pas pu trouver d'equipe pour votre demande \"" + sr.getTitle() + "\". Un administrateur va intervenir.");
                    } catch (Exception e) {
                        log.warn("Notification error ESCALATION scheduler: {}", e.getMessage());
                    }
                }

                return false;
            }
        } catch (Exception e) {
            log.warn("Auto-assignment scheduler failed for SR {}: {}", sr.getId(), e.getMessage());
            return false;
        }
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
                "/interventions?tab=service-requests&highlight=" + sr.getId());
        } catch (Exception e) {
            log.warn("Notification error menage auto SR {}: {}", sr.getId(), e.getMessage());
        }

        // Auto-assignation : meme garde-fou d'org que le flux web (workflow settings).
        WorkflowSettings ws = workflowSettingsRepository.findByOrganizationId(orgId).orElse(null);
        if (ws == null || ws.isAutoAssignInterventions()) {
            attemptAutoAssignByOrgId(sr, orgId);
        }

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
        if (RequestStatus.IN_PROGRESS.equals(sr.getStatus())) {
            log.info("Annulation menage auto: demande {} deja commencee — laissee en l'etat", sr.getId());
            return AutoCleaningOutcome.skipped("demande " + sr.getId() + " deja commencee");
        }
        if (!sr.getStatus().canTransitionTo(RequestStatus.CANCELLED)) {
            log.info("Annulation menage auto: demande {} en statut {} — non annulable", sr.getId(), sr.getStatus());
            return AutoCleaningOutcome.skipped("demande " + sr.getId() + " en statut " + sr.getStatus());
        }

        sr.setStatus(RequestStatus.CANCELLED);
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
                "/interventions?tab=service-requests&highlight=" + sr.getId());
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
                "/interventions?tab=service-requests&highlight=" + sr.getId());
        }
    }

    private void notifyHostByOrgId(ServiceRequest sr, Long orgId, NotificationKey key, String title, String msg) {
        if (sr.getUser() != null && sr.getUser().getKeycloakId() != null) {
            notificationService.sendByOrgId(sr.getUser().getKeycloakId(), key, title, msg,
                "/interventions?tab=service-requests&highlight=" + sr.getId(), orgId);
        }
    }

}
