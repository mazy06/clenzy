package com.clenzy.service;

import com.clenzy.dto.ServiceRequestDto;
import com.clenzy.dto.InterventionDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.exception.UnauthorizedException;
import com.clenzy.model.ServiceRequest;
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
import com.clenzy.tenant.TenantContext;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.LocalDateTime;
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
                                  WorkflowSettingsRepository workflowSettingsRepository) {
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
                "/service-requests/" + entity.getId()
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
                "/service-requests/" + sr.getId()
            );
        } catch (Exception e) {
            log.warn("Notification error REFUSE: {}", e.getMessage());
        }

        // Tenter une re-assignation automatique
        attemptAutoAssign(sr);

        return serviceRequestMapper.toDto(sr);
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
                "L'intervention \"" + intervention.getTitle() + "\" a ete creee suite au paiement de la demande de service.",
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
                    "/service-requests/" + entity.getId()
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

    public void delete(Long id) {
        if (!serviceRequestRepository.existsById(id)) throw new NotFoundException("Service request not found");
        serviceRequestRepository.deleteById(id);
    }



    /**
     * Mappe le type de service vers le type d'intervention
     */
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
                        "/service-requests/" + sr.getId()
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
                            "/service-requests/" + sr.getId()
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
                            "/service-requests/" + sr.getId()
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
                        "/service-requests/" + sr.getId()
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
                            "/service-requests/" + sr.getId()
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
                "/service-requests/" + sr.getId());
        }
    }

    private void notifyHostByOrgId(ServiceRequest sr, Long orgId, NotificationKey key, String title, String msg) {
        if (sr.getUser() != null && sr.getUser().getKeycloakId() != null) {
            notificationService.sendByOrgId(sr.getUser().getKeycloakId(), key, title, msg,
                "/service-requests/" + sr.getId(), orgId);
        }
    }

}
