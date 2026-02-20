package com.clenzy.service;

import com.clenzy.dto.ServiceRequestDto;
import com.clenzy.dto.InterventionDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.exception.UnauthorizedException;
import com.clenzy.model.Property;
import com.clenzy.model.ServiceRequest;
import com.clenzy.model.User;
import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionType;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.RequestStatus;
import com.clenzy.model.UserRole;
import com.clenzy.repository.PropertyRepository;
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
import com.clenzy.dto.PropertyDto;
import com.clenzy.dto.UserDto;
import com.clenzy.dto.TeamDto;
import org.springframework.data.domain.PageImpl;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
@Transactional
public class ServiceRequestService {

    private static final Logger log = LoggerFactory.getLogger(ServiceRequestService.class);

    private final ServiceRequestRepository serviceRequestRepository;
    private final UserRepository userRepository;
    private final PropertyRepository propertyRepository;
    private final InterventionRepository interventionRepository;
    private final TeamRepository teamRepository;
    private final NotificationService notificationService;
    private final PropertyTeamService propertyTeamService;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final TenantContext tenantContext;

    public ServiceRequestService(ServiceRequestRepository serviceRequestRepository, UserRepository userRepository, PropertyRepository propertyRepository, InterventionRepository interventionRepository, TeamRepository teamRepository, NotificationService notificationService, PropertyTeamService propertyTeamService, KafkaTemplate<String, Object> kafkaTemplate, TenantContext tenantContext) {
        this.serviceRequestRepository = serviceRequestRepository;
        this.userRepository = userRepository;
        this.propertyRepository = propertyRepository;
        this.interventionRepository = interventionRepository;
        this.teamRepository = teamRepository;
        this.notificationService = notificationService;
        this.propertyTeamService = propertyTeamService;
        this.kafkaTemplate = kafkaTemplate;
        this.tenantContext = tenantContext;
    }

    public ServiceRequestDto create(ServiceRequestDto dto) {
        ServiceRequest entity = new ServiceRequest();
        apply(dto, entity);
        entity.setOrganizationId(tenantContext.getRequiredOrganizationId());
        entity = serviceRequestRepository.save(entity);
        ServiceRequestDto result = toDto(entity);

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

        return result;
    }

    public ServiceRequestDto update(Long id, ServiceRequestDto dto) {
        ServiceRequest entity = serviceRequestRepository.findById(id).orElseThrow(() -> new NotFoundException("Service request not found"));
        apply(dto, entity);
        entity = serviceRequestRepository.save(entity);
        ServiceRequestDto result = toDto(entity);

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
        return toDto(serviceRequestRepository.findById(id).orElseThrow(() -> new NotFoundException("Service request not found")));
    }

    @Transactional(readOnly = true)
    public List<ServiceRequestDto> list() {
        return serviceRequestRepository.findAllWithRelations(tenantContext.getRequiredOrganizationId()).stream().map(this::toDto).collect(Collectors.toList());
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

        return new PageImpl<>(pageContent.stream().map(this::toDto).collect(Collectors.toList()), pageable, page.getTotalElements());
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

        return new PageImpl<>(pageContent.stream().map(this::toDto).collect(Collectors.toList()), pageable, filtered.size());
    }

    @Transactional(readOnly = true)
    public Page<ServiceRequestDto> searchWithRoleBasedAccess(Pageable pageable, Long userId, Long propertyId,
                                                             com.clenzy.model.RequestStatus status,
                                                             com.clenzy.model.ServiceType serviceType,
                                                             Jwt jwt) {
        if (jwt == null) {
            // Si pas de JWT, utiliser la méthode standard
            return search(pageable, userId, propertyId, status, serviceType);
        }

        UserRole userRole = extractUserRole(jwt);
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
                } else if (userRole == UserRole.HOUSEKEEPER || userRole == UserRole.TECHNICIAN) {
                    // HOUSEKEEPER/TECHNICIAN : seulement les demandes assignées à eux ou leurs équipes
                    String keycloakId = jwt.getSubject();
                    User currentUser = userRepository.findByKeycloakId(keycloakId).orElse(null);
                    if (currentUser != null) {
                        return (sr.getAssignedToType() != null && sr.getAssignedToType().equals("user") &&
                                sr.getAssignedToId() != null && sr.getAssignedToId().equals(currentUser.getId())) ||
                               (sr.getAssignedToType() != null && sr.getAssignedToType().equals("team") &&
                                sr.getAssignedToId() != null && isUserInTeam(currentUser.getId(), sr.getAssignedToId()));
                    }
                    return false;
                } else if (userRole == UserRole.MANAGER) {
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
            .filter(sr -> status == null || sr.getStatus().equals(status))
            .filter(sr -> serviceType == null || sr.getServiceType().equals(serviceType))
            .collect(Collectors.toList());

        // Appliquer la pagination
        int start = (int) pageable.getOffset();
        int end = Math.min(start + pageable.getPageSize(), filtered.size());
        List<ServiceRequest> pageContent = filtered.subList(start, end);

        return new PageImpl<>(pageContent.stream().map(this::toDto).collect(Collectors.toList()), pageable, filtered.size());
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
     * Valide une demande de service et crée automatiquement une intervention
     * Seuls les managers et admins peuvent valider les demandes
     */
    public InterventionDto validateAndCreateIntervention(Long serviceRequestId, Long teamId, Long userId, boolean autoAssign, Jwt jwt) {
        try {
            log.debug("validateAndCreateIntervention - serviceRequestId: {}", serviceRequestId);

            // Vérifier les droits d'accès
            UserRole userRole = extractUserRole(jwt);
            log.debug("validateAndCreateIntervention - role: {}", userRole);

            if (userRole != UserRole.ADMIN && userRole != UserRole.MANAGER) {
                log.debug("validateAndCreateIntervention - insufficient role: {}", userRole);
                throw new UnauthorizedException("Seuls les administrateurs et managers peuvent valider les demandes de service");
            }

        // Récupérer la demande de service
        ServiceRequest serviceRequest = serviceRequestRepository.findById(serviceRequestId)
                .orElseThrow(() -> new NotFoundException("Demande de service non trouvée"));
        log.debug("validateAndCreateIntervention - service request found: {}", serviceRequest.getTitle());

        // Vérifier que la demande n'est pas déjà validée
        if (RequestStatus.APPROVED.equals(serviceRequest.getStatus())) {
            throw new IllegalStateException("Cette demande de service est déjà validée");
        }

        // Vérifier qu'il n'existe pas déjà une intervention pour cette demande
        if (interventionRepository.existsByServiceRequestId(serviceRequestId)) {
            throw new IllegalStateException("Une intervention existe déjà pour cette demande de service");
        }

        // Mettre à jour le statut de la demande
        serviceRequest.setStatus(RequestStatus.APPROVED);
        serviceRequest.setApprovedBy(jwt.getSubject());
        serviceRequest.setApprovedAt(LocalDateTime.now());
        serviceRequest = serviceRequestRepository.save(serviceRequest);

        // Créer l'intervention
        Intervention intervention = new Intervention();
        intervention.setTitle(serviceRequest.getTitle());
        intervention.setDescription(serviceRequest.getDescription());

        String interventionType = mapServiceTypeToInterventionType(serviceRequest.getServiceType());
        log.debug("validateAndCreateIntervention - intervention type mapped: {}", interventionType);
        intervention.setType(interventionType);

        intervention.setStatus(InterventionStatus.PENDING);
        intervention.setPriority(serviceRequest.getPriority().name());
        intervention.setProperty(serviceRequest.getProperty());
        intervention.setRequestor(serviceRequest.getUser());
        intervention.setServiceRequest(serviceRequest);
        intervention.setScheduledDate(serviceRequest.getDesiredDate());
        intervention.setEstimatedDurationHours(serviceRequest.getEstimatedDurationHours());
        intervention.setEstimatedCost(serviceRequest.getEstimatedCost());
        intervention.setIsUrgent(serviceRequest.isUrgent());
        intervention.setStartTime(serviceRequest.getDesiredDate());
        intervention.setRequiresFollowUp(false);

        // Auto-assignation si aucune equipe/user fourni et toggle active
        if (teamId == null && userId == null && autoAssign) {
            String svcType = serviceRequest.getServiceType() != null ? serviceRequest.getServiceType().name() : null;
            Optional<Long> availableTeamId = propertyTeamService.findAvailableTeamForProperty(
                serviceRequest.getProperty().getId(),
                serviceRequest.getDesiredDate(),
                serviceRequest.getEstimatedDurationHours(),
                svcType
            );
            if (availableTeamId.isPresent()) {
                teamId = availableTeamId.get();
                log.debug("Auto-assignment: team {} for property {}", teamId, serviceRequest.getProperty().getId());
            } else {
                log.debug("Auto-assignment: no team available for property {}", serviceRequest.getProperty().getId());
            }
        }

        // Assigner l'équipe ou l'utilisateur si fourni
        if (teamId != null) {
            Team team = teamRepository.findById(teamId)
                    .orElseThrow(() -> new NotFoundException("Équipe non trouvée"));
            intervention.setTeamId(team.getId());
            log.debug("validateAndCreateIntervention - team assigned: {}", team.getName());
        } else if (userId != null) {
            User assignedUser = userRepository.findById(userId)
                    .orElseThrow(() -> new NotFoundException("Utilisateur non trouvé"));
            intervention.setAssignedUser(assignedUser);
            intervention.setAssignedTechnicianId(userId);
            log.debug("validateAndCreateIntervention - user assigned: {}", assignedUser.getFullName());
        }

        intervention.setOrganizationId(tenantContext.getRequiredOrganizationId());
        intervention = interventionRepository.save(intervention);
        log.debug("validateAndCreateIntervention - intervention saved, id: {}", intervention.getId());

        // Convertir en DTO et retourner
        InterventionDto dto = convertToInterventionDto(intervention);

        // Notify requester of approval
        try {
            if (serviceRequest.getUser() != null && serviceRequest.getUser().getKeycloakId() != null) {
                notificationService.notify(
                    serviceRequest.getUser().getKeycloakId(),
                    NotificationKey.SERVICE_REQUEST_APPROVED,
                    "Demande de service approuvee",
                    "Votre demande \"" + serviceRequest.getTitle() + "\" a ete approuvee et une intervention a ete creee",
                    "/service-requests/" + serviceRequest.getId()
                );
            }
        } catch (Exception e) {
            log.warn("Notification error SERVICE_REQUEST_APPROVED: {}", e.getMessage());
        }

        // ─── Génération automatique du DEVIS ─────────────────────────────────
        try {
            String emailTo = serviceRequest.getUser() != null ? serviceRequest.getUser().getEmail() : null;
            kafkaTemplate.send(
                KafkaConfig.TOPIC_DOCUMENT_GENERATE,
                "devis-sr-" + serviceRequest.getId(),
                Map.of(
                    "documentType", "DEVIS",
                    "referenceId", serviceRequest.getId(),
                    "referenceType", "service_request",
                    "emailTo", emailTo != null ? emailTo : ""
                )
            );
            log.debug("Kafka DEVIS event published for service request: {}", serviceRequest.getId());
        } catch (Exception e) {
            log.warn("Kafka publish error DEVIS: {}", e.getMessage());
        }

        return dto;
        } catch (Exception e) {
            log.error("Error in validateAndCreateIntervention for id={}", serviceRequestId, e);
            throw e;
        }
    }

    /**
     * Acceptation du devis par le Host.
     * Change le statut de la demande de APPROVED à DEVIS_ACCEPTED
     * et déclenche la génération de l'AUTORISATION_TRAVAUX.
     */
    public ServiceRequestDto acceptDevis(Long serviceRequestId, Jwt jwt) {
        ServiceRequest serviceRequest = serviceRequestRepository.findById(serviceRequestId)
                .orElseThrow(() -> new NotFoundException("Demande de service non trouvée"));

        // Vérifier que la demande est bien au statut APPROVED (devis généré, en attente d'acceptation)
        if (!RequestStatus.APPROVED.equals(serviceRequest.getStatus())) {
            throw new IllegalStateException("Le devis ne peut être accepté que lorsque la demande est au statut APPROVED. Statut actuel: " + serviceRequest.getStatus());
        }

        // Vérifier que c'est bien le Host (propriétaire) qui accepte le devis
        UserRole userRole = extractUserRole(jwt);
        String keycloakId = jwt.getSubject();

        // Les admins/managers peuvent aussi accepter pour le host
        if (userRole == UserRole.HOST) {
            // Vérifier que le host est le propriétaire de la propriété
            User currentUser = userRepository.findByKeycloakId(keycloakId).orElse(null);
            if (currentUser == null || serviceRequest.getProperty() == null
                    || serviceRequest.getProperty().getOwner() == null
                    || !serviceRequest.getProperty().getOwner().getId().equals(currentUser.getId())) {
                throw new com.clenzy.exception.UnauthorizedException("Vous n'êtes pas autorisé à accepter ce devis");
            }
        } else if (userRole != UserRole.ADMIN && userRole != UserRole.MANAGER) {
            throw new com.clenzy.exception.UnauthorizedException("Seuls le propriétaire, les managers et les admins peuvent accepter un devis");
        }

        // Mettre à jour le statut
        serviceRequest.setStatus(RequestStatus.DEVIS_ACCEPTED);
        serviceRequest.setDevisAcceptedBy(keycloakId);
        serviceRequest.setDevisAcceptedAt(LocalDateTime.now());
        serviceRequest = serviceRequestRepository.save(serviceRequest);

        // ─── Notification ────────────────────────────────────────────────────
        try {
            notificationService.notifyAdminsAndManagers(
                NotificationKey.SERVICE_REQUEST_APPROVED,
                "Devis accepté",
                "Le devis pour la demande \"" + serviceRequest.getTitle() + "\" a été accepté par le client",
                "/service-requests/" + serviceRequest.getId()
            );
        } catch (Exception e) {
            log.warn("Notification error DEVIS_ACCEPTED: {}", e.getMessage());
        }

        // ─── Génération automatique de l'AUTORISATION_TRAVAUX ────────────────
        try {
            String emailTo = serviceRequest.getUser() != null ? serviceRequest.getUser().getEmail() : null;
            kafkaTemplate.send(
                KafkaConfig.TOPIC_DOCUMENT_GENERATE,
                "autorisation-travaux-sr-" + serviceRequest.getId(),
                Map.of(
                    "documentType", "AUTORISATION_TRAVAUX",
                    "referenceId", serviceRequest.getId(),
                    "referenceType", "service_request",
                    "emailTo", emailTo != null ? emailTo : ""
                )
            );
            log.debug("Kafka AUTORISATION_TRAVAUX event published for service request: {}", serviceRequest.getId());
        } catch (Exception e) {
            log.warn("Kafka publish error AUTORISATION_TRAVAUX: {}", e.getMessage());
        }

        return toDto(serviceRequest);
    }

    /**
     * Extrait le rôle principal de l'utilisateur depuis le JWT
     * Les rôles sont stockés dans realm_access.roles et préfixés avec "ROLE_"
     */
    private UserRole extractUserRole(Jwt jwt) {
        if (jwt == null) {
            throw new UnauthorizedException("JWT manquant");
        }

        try {
            // Essayer d'abord realm_access.roles (format Keycloak)
            Map<String, Object> realmAccess = jwt.getClaim("realm_access");
            log.debug("extractUserRole - realm_access: {}", realmAccess);

            if (realmAccess != null) {
                Object roles = realmAccess.get("roles");
                log.debug("extractUserRole - roles: {}", roles);

                if (roles instanceof List<?>) {
                    List<?> roleList = (List<?>) roles;

                    // D'abord, chercher les rôles métier prioritaires (ADMIN, MANAGER)
                    for (Object role : roleList) {
                        if (role instanceof String) {
                            String roleStr = (String) role;

                            // Ignorer les rôles techniques Keycloak
                            if (roleStr.equals("offline_access") ||
                                roleStr.equals("uma_authorization") ||
                                roleStr.equals("default-roles-clenzy")) {
                                continue;
                            }

                            // Mapper "realm-admin" vers ADMIN
                            if (roleStr.equalsIgnoreCase("realm-admin")) {
                                return UserRole.ADMIN;
                            }

                            // Chercher les rôles métier directs (ADMIN, MANAGER, etc.)
                            try {
                                UserRole userRole = UserRole.valueOf(roleStr.toUpperCase());
                                // Prioriser ADMIN et MANAGER
                                if (userRole == UserRole.ADMIN || userRole == UserRole.MANAGER) {
                                    return userRole;
                                }
                            } catch (IllegalArgumentException e) {
                                // Continuer à chercher
                            }
                        }
                    }

                    // Si ADMIN ou MANAGER non trouvé, retourner le premier rôle métier valide
                    for (Object role : roleList) {
                        if (role instanceof String) {
                            String roleStr = (String) role;

                            // Ignorer les rôles techniques Keycloak
                            if (roleStr.equals("offline_access") ||
                                roleStr.equals("uma_authorization") ||
                                roleStr.equals("default-roles-clenzy") ||
                                roleStr.equalsIgnoreCase("realm-admin")) {
                                continue;
                            }

                            try {
                                UserRole userRole = UserRole.valueOf(roleStr.toUpperCase());
                                log.debug("extractUserRole - returning business role: {}", userRole);
                                return userRole;
                            } catch (IllegalArgumentException e) {
                                // Continuer à chercher
                            }
                        }
                    }
                }
            }

            // Fallback: essayer le claim "role" direct
            String directRole = jwt.getClaimAsString("role");
            log.debug("extractUserRole - direct role claim: {}", directRole);

            if (directRole != null) {
                try {
                    return UserRole.valueOf(directRole.toUpperCase());
                } catch (IllegalArgumentException e) {
                    log.warn("extractUserRole - unknown direct role: {}, falling back to HOST", directRole);
                    return UserRole.HOST;
                }
            }

            // Si aucun rôle trouvé, retourner HOST par défaut
            log.debug("extractUserRole - no role found, returning HOST default");
            return UserRole.HOST;
        } catch (Exception e) {
            log.error("extractUserRole - error during extraction", e);
            return UserRole.HOST; // Fallback en cas d'erreur
        }
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

    private void apply(ServiceRequestDto dto, ServiceRequest e) {
        if (dto.title != null) e.setTitle(dto.title);
        e.setDescription(dto.description);
        if (dto.serviceType != null) e.setServiceType(dto.serviceType);
        if (dto.priority != null) e.setPriority(dto.priority);
        if (dto.status != null) e.setStatus(dto.status);
        e.setDesiredDate(dto.desiredDate);
        e.setPreferredTimeSlot(dto.preferredTimeSlot);
        e.setEstimatedDurationHours(dto.estimatedDurationHours);
        e.setEstimatedCost(dto.estimatedCost);
        e.setActualCost(dto.actualCost);
        e.setSpecialInstructions(dto.specialInstructions);
        e.setAccessNotes(dto.accessNotes);
        e.setGuestCheckoutTime(dto.guestCheckoutTime);
        e.setGuestCheckinTime(dto.guestCheckinTime);
        e.setUrgent(dto.urgent);
        e.setRequiresApproval(dto.requiresApproval);
        e.setApprovedBy(dto.approvedBy);
        e.setApprovedAt(dto.approvedAt);
        if (dto.userId != null) {
            User user = userRepository.findById(dto.userId).orElseThrow(() -> new NotFoundException("User not found"));
            e.setUser(user);
        }
        if (dto.propertyId != null) {
            Property property = propertyRepository.findById(dto.propertyId).orElseThrow(() -> new NotFoundException("Property not found"));
            e.setProperty(property);
        }
        // Assignation
        e.setAssignedToId(dto.assignedToId);
        e.setAssignedToType(dto.assignedToType);
    }

    private ServiceRequestDto toDto(ServiceRequest e) {
        ServiceRequestDto dto = new ServiceRequestDto();
        dto.id = e.getId();
        dto.title = e.getTitle();
        dto.description = e.getDescription();
        dto.serviceType = e.getServiceType();
        dto.priority = e.getPriority();
        dto.status = e.getStatus();
        dto.desiredDate = e.getDesiredDate();
        dto.preferredTimeSlot = e.getPreferredTimeSlot();
        dto.estimatedDurationHours = e.getEstimatedDurationHours();
        dto.estimatedCost = e.getEstimatedCost();
        dto.actualCost = e.getActualCost();
        dto.specialInstructions = e.getSpecialInstructions();
        dto.accessNotes = e.getAccessNotes();
        dto.guestCheckoutTime = e.getGuestCheckoutTime();
        dto.guestCheckinTime = e.getGuestCheckinTime();
        dto.urgent = e.isUrgent();
        dto.requiresApproval = e.isRequiresApproval();
        dto.approvedBy = e.getApprovedBy();
        dto.approvedAt = e.getApprovedAt();
        dto.devisAcceptedBy = e.getDevisAcceptedBy();
        dto.devisAcceptedAt = e.getDevisAcceptedAt();
        dto.userId = e.getUser() != null ? e.getUser().getId() : null;
        dto.propertyId = e.getProperty() != null ? e.getProperty().getId() : null;

        // Assignation
        dto.assignedToId = e.getAssignedToId();
        dto.assignedToType = e.getAssignedToType();

        // Remplir les informations de l'assignation (utilisateur ou équipe)
        if (e.getAssignedToId() != null && e.getAssignedToType() != null) {
            if ("user".equalsIgnoreCase(e.getAssignedToType())) {
                User assignedUser = userRepository.findById(e.getAssignedToId()).orElse(null);
                if (assignedUser != null) {
                    dto.assignedToUser = userToDto(assignedUser);
                }
            } else if ("team".equalsIgnoreCase(e.getAssignedToType())) {
                Team assignedTeam = teamRepository.findById(e.getAssignedToId()).orElse(null);
                if (assignedTeam != null) {
                    dto.assignedToTeam = teamToDto(assignedTeam);
                }
            }
        }

        // Inclure les objets complets pour éviter les "inconnu"
        if (e.getProperty() != null) {
            dto.property = propertyToDto(e.getProperty());
        }
        if (e.getUser() != null) {
            dto.user = userToDto(e.getUser());
        }

        dto.createdAt = e.getCreatedAt();
        dto.updatedAt = e.getUpdatedAt();
        return dto;
    }

    /**
     * Convertit une propriété en DTO
     */
    private PropertyDto propertyToDto(Property property) {
        PropertyDto dto = new PropertyDto();
        dto.id = property.getId();
        dto.name = property.getName();
        dto.address = property.getAddress();
        dto.city = property.getCity();
        dto.postalCode = property.getPostalCode();
        dto.country = property.getCountry();
        dto.type = property.getType();
        dto.status = property.getStatus();
        dto.bedroomCount = property.getBedroomCount();
        dto.bathroomCount = property.getBathroomCount();
        dto.squareMeters = property.getSquareMeters();
        dto.nightlyPrice = property.getNightlyPrice();
        dto.maxGuests = property.getMaxGuests();
        dto.description = property.getDescription();
        dto.cleaningFrequency = property.getCleaningFrequency();
        dto.ownerId = property.getOwner() != null ? property.getOwner().getId() : null;
        dto.createdAt = property.getCreatedAt();
        dto.updatedAt = property.getUpdatedAt();
        return dto;
    }

    /**
     * Convertit un utilisateur en DTO
     */
    private UserDto userToDto(User user) {
        UserDto dto = new UserDto();
        dto.id = user.getId();
        dto.firstName = user.getFirstName();
        dto.lastName = user.getLastName();
        dto.email = user.getEmail();
        dto.role = user.getRole();
        dto.status = user.getStatus();
        dto.phoneNumber = user.getPhoneNumber();
        dto.createdAt = user.getCreatedAt();
        dto.updatedAt = user.getUpdatedAt();
        return dto;
    }

    /**
     * Convertit une équipe en DTO
     */
    private TeamDto teamToDto(Team team) {
        TeamDto dto = new TeamDto();
        dto.id = team.getId();
        dto.name = team.getName();
        dto.description = team.getDescription();
        dto.interventionType = team.getInterventionType();
        dto.memberCount = team.getMemberCount();
        dto.createdAt = team.getCreatedAt();
        dto.updatedAt = team.getUpdatedAt();
        return dto;
    }
}
