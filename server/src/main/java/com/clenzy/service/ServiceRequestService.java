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
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.repository.InterventionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

@Service
@Transactional
public class ServiceRequestService {
    private final ServiceRequestRepository serviceRequestRepository;
    private final UserRepository userRepository;
    private final PropertyRepository propertyRepository;
    private final InterventionRepository interventionRepository;

    public ServiceRequestService(ServiceRequestRepository serviceRequestRepository, UserRepository userRepository, PropertyRepository propertyRepository, InterventionRepository interventionRepository) {
        this.serviceRequestRepository = serviceRequestRepository;
        this.userRepository = userRepository;
        this.propertyRepository = propertyRepository;
        this.interventionRepository = interventionRepository;
    }

    public ServiceRequestDto create(ServiceRequestDto dto) {
        ServiceRequest entity = new ServiceRequest();
        apply(dto, entity);
        entity = serviceRequestRepository.save(entity);
        return toDto(entity);
    }

    public ServiceRequestDto update(Long id, ServiceRequestDto dto) {
        ServiceRequest entity = serviceRequestRepository.findById(id).orElseThrow(() -> new NotFoundException("Service request not found"));
        apply(dto, entity);
        entity = serviceRequestRepository.save(entity);
        return toDto(entity);
    }

    @Transactional(readOnly = true)
    public ServiceRequestDto getById(Long id) {
        return toDto(serviceRequestRepository.findById(id).orElseThrow(() -> new NotFoundException("Service request not found")));
    }

    @Transactional(readOnly = true)
    public List<ServiceRequestDto> list() {
        return serviceRequestRepository.findAll().stream().map(this::toDto).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Page<ServiceRequestDto> list(Pageable pageable) {
        return serviceRequestRepository.findAll(pageable).map(this::toDto);
    }

    @Transactional(readOnly = true)
    public Page<ServiceRequestDto> search(Pageable pageable, Long userId, Long propertyId, com.clenzy.model.RequestStatus status, com.clenzy.model.ServiceType serviceType) {
        return serviceRequestRepository.findAll((root, query, cb) -> cb.and(
                userId != null ? cb.equal(root.get("user").get("id"), userId) : cb.conjunction(),
                propertyId != null ? cb.equal(root.get("property").get("id"), propertyId) : cb.conjunction(),
                status != null ? cb.equal(root.get("status"), status) : cb.conjunction(),
                serviceType != null ? cb.equal(root.get("serviceType"), serviceType) : cb.conjunction()
        ), pageable).map(this::toDto);
    }

    public void delete(Long id) {
        if (!serviceRequestRepository.existsById(id)) throw new NotFoundException("Service request not found");
        serviceRequestRepository.deleteById(id);
    }

    /**
     * Valide une demande de service et crée automatiquement une intervention
     * Seuls les managers et admins peuvent valider les demandes
     */
    public InterventionDto validateAndCreateIntervention(Long serviceRequestId, Jwt jwt) {
        try {
            System.out.println("🔍 DEBUG - Début de validateAndCreateIntervention pour l'ID: " + serviceRequestId);
            
            // Vérifier les droits d'accès
            System.out.println("🔍 DEBUG - Extraction du rôle utilisateur...");
            String userRole = extractUserRole(jwt);
            System.out.println("🔍 DEBUG - Rôle extrait: " + userRole);
            
            if (!"ADMIN".equals(userRole) && !"MANAGER".equals(userRole)) {
                System.out.println("🔍 DEBUG - Rôle insuffisant: " + userRole);
                throw new UnauthorizedException("Seuls les administrateurs et managers peuvent valider les demandes de service");
            }
            System.out.println("🔍 DEBUG - Rôle validé: " + userRole);

        // Récupérer la demande de service
        System.out.println("🔍 DEBUG - Récupération de la demande de service...");
        ServiceRequest serviceRequest = serviceRequestRepository.findById(serviceRequestId)
                .orElseThrow(() -> new NotFoundException("Demande de service non trouvée"));
        System.out.println("🔍 DEBUG - Demande de service trouvée: " + serviceRequest.getTitle());

        // Vérifier que la demande n'est pas déjà validée
        System.out.println("🔍 DEBUG - Vérification du statut actuel: " + serviceRequest.getStatus());
        if (RequestStatus.APPROVED.equals(serviceRequest.getStatus())) {
            System.out.println("🔍 DEBUG - Demande déjà validée!");
            throw new IllegalStateException("Cette demande de service est déjà validée");
        }
        System.out.println("🔍 DEBUG - Statut validé, pas encore APPROVED");

        // Vérifier qu'il n'existe pas déjà une intervention pour cette demande
        System.out.println("🔍 DEBUG - Vérification d'intervention existante...");
        if (interventionRepository.existsByServiceRequestId(serviceRequestId)) {
            System.out.println("🔍 DEBUG - Intervention déjà existante!");
            throw new IllegalStateException("Une intervention existe déjà pour cette demande de service");
        }
        System.out.println("🔍 DEBUG - Aucune intervention existante");

        // Mettre à jour le statut de la demande
        System.out.println("🔍 DEBUG - Mise à jour du statut vers APPROVED...");
        serviceRequest.setStatus(RequestStatus.APPROVED);
        serviceRequest.setApprovedBy(jwt.getSubject());
        serviceRequest.setApprovedAt(LocalDateTime.now());
        System.out.println("🔍 DEBUG - Sauvegarde de la demande mise à jour...");
        serviceRequest = serviceRequestRepository.save(serviceRequest);
        System.out.println("🔍 DEBUG - Demande sauvegardée avec succès");

        // Créer l'intervention
        System.out.println("🔍 DEBUG - Création de l'intervention...");
        Intervention intervention = new Intervention();
        intervention.setTitle(serviceRequest.getTitle());
        intervention.setDescription(serviceRequest.getDescription());
        
        String interventionType = mapServiceTypeToInterventionType(serviceRequest.getServiceType());
        System.out.println("🔍 DEBUG - Type d'intervention mappé: " + interventionType);
        intervention.setType(interventionType);
        
        intervention.setStatus(InterventionStatus.SCHEDULED.name());
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

        System.out.println("🔍 DEBUG - Sauvegarde de l'intervention...");
        intervention = interventionRepository.save(intervention);
        System.out.println("🔍 DEBUG - Intervention sauvegardée avec succès, ID: " + intervention.getId());

        // Convertir en DTO et retourner
        System.out.println("🔍 DEBUG - Conversion en DTO...");
        InterventionDto dto = convertToInterventionDto(intervention);
        System.out.println("🔍 DEBUG - DTO créé avec succès, retour...");
        return dto;
        } catch (Exception e) {
            System.err.println("🔍 DEBUG - Erreur dans validateAndCreateIntervention: " + e.getMessage());
            e.printStackTrace();
            throw e;
        }
    }

    /**
     * Extrait le rôle de l'utilisateur depuis le JWT
     */
    private String extractUserRole(Jwt jwt) {
        System.out.println("🔍 DEBUG - extractUserRole appelé");
        if (jwt == null) {
            System.err.println("🔍 DEBUG - JWT est null!");
            throw new UnauthorizedException("JWT manquant");
        }
        
        System.out.println("🔍 DEBUG - JWT non-null, extraction du rôle...");
        String role = jwt.getClaimAsString("role");
        System.out.println("🔍 DEBUG - Rôle extrait depuis 'role': " + role);
        
        if (role == null) {
            System.out.println("🔍 DEBUG - Rôle null, essai avec 'realm_access'...");
            // Fallback: essayer de récupérer depuis les claims standards
            String realmAccess = jwt.getClaimAsString("realm_access");
            System.out.println("🔍 DEBUG - Realm_access brut: " + realmAccess);
            
            if (realmAccess != null) {
                // Parser le JSON {roles=[ADMIN]} pour extraire le premier rôle
                if (realmAccess.contains("ADMIN")) {
                    role = "ADMIN";
                } else if (realmAccess.contains("MANAGER")) {
                    role = "MANAGER";
                } else if (realmAccess.contains("USER")) {
                    role = "USER";
                }
                System.out.println("🔍 DEBUG - Rôle extrait depuis realm_access: " + role);
            }
            
            if (role == null) {
                System.err.println("🔍 DEBUG - Aucun rôle trouvé dans le JWT!");
                throw new UnauthorizedException("Rôle non trouvé dans le JWT");
            }
        }
        
        System.out.println("🔍 DEBUG - Rôle final retourné: " + role);
        return role;
    }

    /**
     * Mappe le type de service vers le type d'intervention
     */
    private String mapServiceTypeToInterventionType(com.clenzy.model.ServiceType serviceType) {
        if (serviceType == null) {
            return InterventionType.MAINTENANCE.name();
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
                return InterventionType.MAINTENANCE.name();
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
        dto.status = intervention.getStatus();
        dto.priority = intervention.getPriority();
        dto.propertyId = intervention.getProperty().getId();
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
        dto.userId = e.getUser() != null ? e.getUser().getId() : null;
        dto.propertyId = e.getProperty() != null ? e.getProperty().getId() : null;
        dto.createdAt = e.getCreatedAt();
        dto.updatedAt = e.getUpdatedAt();
        return dto;
    }
}


