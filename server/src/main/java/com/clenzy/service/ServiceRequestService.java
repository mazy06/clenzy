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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import com.clenzy.dto.PropertyDto;
import com.clenzy.dto.UserDto;
import org.springframework.data.domain.PageImpl;

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
        return serviceRequestRepository.findAllWithRelations().stream().map(this::toDto).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Page<ServiceRequestDto> list(Pageable pageable) {
        // Pour la pagination, on doit d'abord récupérer les IDs puis charger avec relations
        Page<ServiceRequest> page = serviceRequestRepository.findAll(pageable);
        List<ServiceRequest> withRelations = serviceRequestRepository.findAllWithRelations();
        
        // Filtrer selon la pagination
        int start = (int) pageable.getOffset();
        int end = Math.min(start + pageable.getPageSize(), withRelations.size());
        List<ServiceRequest> pageContent = withRelations.subList(start, end);
        
        return new PageImpl<>(pageContent.stream().map(this::toDto).collect(Collectors.toList()), pageable, page.getTotalElements());
    }

    @Transactional(readOnly = true)
    public Page<ServiceRequestDto> search(Pageable pageable, Long userId, Long propertyId, com.clenzy.model.RequestStatus status, com.clenzy.model.ServiceType serviceType) {
        // Utiliser la méthode avec relations et filtrer ensuite
        List<ServiceRequest> allWithRelations = serviceRequestRepository.findAllWithRelations();
        
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
            UserRole userRole = extractUserRole(jwt);
            System.out.println("🔍 DEBUG - Rôle extrait: " + userRole);
            
            if (userRole != UserRole.ADMIN && userRole != UserRole.MANAGER) {
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
    /**
     * Extrait le rôle principal de l'utilisateur depuis le JWT
     * Les rôles sont stockés dans realm_access.roles et préfixés avec "ROLE_"
     */
    private UserRole extractUserRole(Jwt jwt) {
        System.out.println("🔍 ServiceRequestService.extractUserRole - Début de l'extraction");
        
        if (jwt == null) {
            System.err.println("🔍 ServiceRequestService.extractUserRole - JWT est null!");
            throw new UnauthorizedException("JWT manquant");
        }
        
        try {
            // Essayer d'abord realm_access.roles (format Keycloak)
            Map<String, Object> realmAccess = jwt.getClaim("realm_access");
            System.out.println("🔍 ServiceRequestService.extractUserRole - Realm_access: " + realmAccess);
            
            if (realmAccess != null) {
                Object roles = realmAccess.get("roles");
                System.out.println("🔍 ServiceRequestService.extractUserRole - Rôles extraits: " + roles);
                
                if (roles instanceof List<?>) {
                    List<?> roleList = (List<?>) roles;
                    System.out.println("🔍 ServiceRequestService.extractUserRole - Liste des rôles: " + roleList);
                    
                    for (Object role : roleList) {
                        if (role instanceof String) {
                            String roleStr = (String) role;
                            System.out.println("🔍 ServiceRequestService.extractUserRole - Rôle trouvé: " + roleStr);

                            // Ignorer les rôles techniques Keycloak
                            if (roleStr.equals("offline_access") || 
                                roleStr.equals("uma_authorization") || 
                                roleStr.equals("default-roles-clenzy")) {
                                System.out.println("🔍 ServiceRequestService.extractUserRole - Rôle technique ignoré: " + roleStr);
                                continue;
                            }

                            // Retourner le premier rôle métier trouvé (ADMIN, MANAGER, HOST, etc.)
                            System.out.println("🔍 ServiceRequestService.extractUserRole - Rôle métier trouvé: " + roleStr);
                            try {
                                return UserRole.valueOf(roleStr.toUpperCase());
                            } catch (IllegalArgumentException e) {
                                System.err.println("🔍 ServiceRequestService.extractUserRole - Rôle inconnu: " + roleStr + ", fallback vers HOST");
                                return UserRole.HOST; // Fallback vers HOST pour les rôles non reconnus
                            }
                        }
                    }
                }
            }
            
            // Fallback: essayer le claim "role" direct
            String directRole = jwt.getClaimAsString("role");
            System.out.println("🔍 ServiceRequestService.extractUserRole - Rôle direct: " + directRole);
            
            if (directRole != null) {
                System.out.println("🔍 ServiceRequestService.extractUserRole - Retour du rôle direct: " + directRole.toUpperCase());
                try {
                    return UserRole.valueOf(directRole.toUpperCase());
                } catch (IllegalArgumentException e) {
                    System.err.println("🔍 ServiceRequestService.extractUserRole - Rôle direct inconnu: " + directRole + ", fallback vers HOST");
                    return UserRole.HOST;
                }
            }
            
            // Si aucun rôle trouvé, retourner HOST par défaut
            System.out.println("🔍 ServiceRequestService.extractUserRole - Aucun rôle trouvé, retour de HOST par défaut");
            return UserRole.HOST;
        } catch (Exception e) {
            System.err.println("🔍 ServiceRequestService.extractUserRole - Erreur lors de l'extraction: " + e.getMessage());
            e.printStackTrace();
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
}


