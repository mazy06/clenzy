package com.clenzy.service;

import com.clenzy.dto.PropertyDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Property;
import com.clenzy.model.User;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.repository.ManagerPropertyRepository;
import com.clenzy.repository.PortfolioClientRepository;
import com.clenzy.repository.PortfolioRepository;
import com.clenzy.model.Portfolio;
import com.clenzy.tenant.TenantContext;
import com.clenzy.model.UserRole;
import com.clenzy.model.NotificationKey;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

@Service
@Transactional
public class PropertyService {
    private static final Logger log = LoggerFactory.getLogger(PropertyService.class);

    private final PropertyRepository propertyRepository;
    private final UserRepository userRepository;
    private final ManagerPropertyRepository managerPropertyRepository;
    private final PortfolioClientRepository portfolioClientRepository;
    private final PortfolioRepository portfolioRepository;
    private final NotificationService notificationService;
    private final TenantContext tenantContext;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public PropertyService(PropertyRepository propertyRepository, UserRepository userRepository,
                          ManagerPropertyRepository managerPropertyRepository,
                          PortfolioClientRepository portfolioClientRepository,
                          PortfolioRepository portfolioRepository,
                          NotificationService notificationService,
                          TenantContext tenantContext) {
        this.propertyRepository = propertyRepository;
        this.userRepository = userRepository;
        this.managerPropertyRepository = managerPropertyRepository;
        this.portfolioClientRepository = portfolioClientRepository;
        this.portfolioRepository = portfolioRepository;
        this.notificationService = notificationService;
        this.tenantContext = tenantContext;
    }

    @CacheEvict(value = "properties", allEntries = true)
    public PropertyDto create(PropertyDto dto) {
        Property property = new Property();
        apply(dto, property);
        property.setOrganizationId(tenantContext.getRequiredOrganizationId());
        property = propertyRepository.save(property);
        PropertyDto result = toDto(property);

        try {
            notificationService.notifyAdminsAndManagers(
                NotificationKey.PROPERTY_CREATED,
                "Nouvelle propriete",
                "Propriete \"" + property.getName() + "\" creee",
                "/properties/" + property.getId()
            );
        } catch (Exception e) {
            log.warn("Erreur notification PROPERTY_CREATED: {}", e.getMessage());
        }

        return result;
    }

    @CacheEvict(value = "properties", allEntries = true)
    public PropertyDto update(Long id, PropertyDto dto) {
        Property property = propertyRepository.findById(id).orElseThrow(() -> new NotFoundException("Property not found"));
        apply(dto, property);
        property = propertyRepository.save(property);
        PropertyDto result = toDto(property);

        try {
            if (property.getOwner() != null && property.getOwner().getKeycloakId() != null) {
                notificationService.notify(
                    property.getOwner().getKeycloakId(),
                    NotificationKey.PROPERTY_UPDATED,
                    "Propriete mise a jour",
                    "La propriete \"" + property.getName() + "\" a ete modifiee",
                    "/properties/" + property.getId()
                );
            }
        } catch (Exception e) {
            log.warn("Erreur notification PROPERTY_UPDATED: {}", e.getMessage());
        }

        return result;
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "properties", key = "#id")
    public PropertyDto getById(Long id) {
        try {
            // Utiliser la méthode avec JOIN FETCH pour charger la relation owner
            Property entity = propertyRepository.findByIdWithOwner(id, tenantContext.getRequiredOrganizationId())
                .orElseThrow(() -> new NotFoundException("Property not found with id: " + id));
            
            return toDto(entity);
        } catch (NotFoundException e) {
            throw e;
        } catch (Exception e) {
            log.error("PropertyService.getById - Erreur lors de la recuperation de la propriete ID: {}", id, e);
            throw new RuntimeException("Erreur lors de la récupération de la propriété: " + e.getMessage(), e);
        }
    }
    
    /**
     * Récupère l'entité Property directement (pour les vérifications d'accès)
     */
    @Transactional(readOnly = true)
    public Property getPropertyEntityById(Long id) {
        return propertyRepository.findByIdWithOwner(id, tenantContext.getRequiredOrganizationId())
            .orElseThrow(() -> new NotFoundException("Property not found with id: " + id));
    }

    @Transactional(readOnly = true)
    public List<PropertyDto> list() {
        return propertyRepository.findAll().stream().map(this::toDto).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Page<PropertyDto> list(Pageable pageable) {
        return propertyRepository.findAll(pageable).map(this::toDto);
    }

    @Transactional(readOnly = true)
    public Page<PropertyDto> search(Pageable pageable, Long ownerId, com.clenzy.model.PropertyStatus status, com.clenzy.model.PropertyType type, String city) {
        return propertyRepository.findAll((root, query, cb) -> cb.and(
                ownerId != null ? cb.equal(root.get("owner").get("id"), ownerId) : cb.conjunction(),
                status != null ? cb.equal(root.get("status"), status) : cb.conjunction(),
                type != null ? cb.equal(root.get("type"), type) : cb.conjunction(),
                city != null ? cb.like(cb.lower(root.get("city")), "%" + city.toLowerCase() + "%") : cb.conjunction()
        ), pageable).map(this::toDto);
    }

    @Transactional(readOnly = true)
    public Page<PropertyDto> searchWithManagers(Pageable pageable, String ownerKeycloakId) {
        return propertyRepository.findAll((root, query, cb) -> cb.and(
                ownerKeycloakId != null ? cb.equal(root.get("owner").get("keycloakId"), ownerKeycloakId) : cb.conjunction()
        ), pageable).map(this::toDtoWithManager);
    }

    public void delete(Long id) {
        if (!propertyRepository.existsById(id)) throw new NotFoundException("Property not found");
        propertyRepository.deleteById(id);

        try {
            notificationService.notifyAdminsAndManagers(
                NotificationKey.PROPERTY_DELETED,
                "Propriete supprimee",
                "La propriete #" + id + " a ete supprimee",
                "/properties"
            );
        } catch (Exception e) {
            log.warn("Erreur notification PROPERTY_DELETED: {}", e.getMessage());
        }
    }

    private void apply(PropertyDto dto, Property property) {
        if (dto.name != null) property.setName(dto.name);
        property.setDescription(dto.description);
        if (dto.address != null) property.setAddress(dto.address);
        property.setPostalCode(dto.postalCode);
        property.setCity(dto.city);
        property.setCountry(dto.country);
        property.setLatitude(dto.latitude);
        property.setLongitude(dto.longitude);
        property.setDepartment(dto.department);
        property.setArrondissement(dto.arrondissement);
        property.setBedroomCount(dto.bedroomCount);
        property.setBathroomCount(dto.bathroomCount);
        property.setMaxGuests(dto.maxGuests);
        property.setSquareMeters(dto.squareMeters);
        property.setNightlyPrice(dto.nightlyPrice);
        if (dto.type != null) property.setType(dto.type);
        if (dto.status != null) property.setStatus(dto.status);
        property.setAirbnbListingId(dto.airbnbListingId);
        property.setAirbnbUrl(dto.airbnbUrl);
        if (dto.cleaningFrequency != null) property.setCleaningFrequency(dto.cleaningFrequency);
        property.setMaintenanceContract(dto.maintenanceContract);
        property.setEmergencyContact(dto.emergencyContact);
        property.setEmergencyPhone(dto.emergencyPhone);
        property.setAccessInstructions(dto.accessInstructions);
        property.setSpecialRequirements(dto.specialRequirements);
        property.setCleaningBasePrice(dto.cleaningBasePrice);
        property.setNumberOfFloors(dto.numberOfFloors);
        if (dto.hasExterior != null) property.setHasExterior(dto.hasExterior);
        if (dto.hasLaundry != null) property.setHasLaundry(dto.hasLaundry);
        // Prestations à la carte
        if (dto.windowCount != null) property.setWindowCount(dto.windowCount);
        if (dto.frenchDoorCount != null) property.setFrenchDoorCount(dto.frenchDoorCount);
        if (dto.slidingDoorCount != null) property.setSlidingDoorCount(dto.slidingDoorCount);
        if (dto.hasIroning != null) property.setHasIroning(dto.hasIroning);
        if (dto.hasDeepKitchen != null) property.setHasDeepKitchen(dto.hasDeepKitchen);
        if (dto.hasDisinfection != null) property.setHasDisinfection(dto.hasDisinfection);
        // Amenities serialization
        if (dto.amenities != null) {
            try {
                property.setAmenities(objectMapper.writeValueAsString(dto.amenities));
            } catch (Exception e) {
                log.warn("PropertyService.apply - Error serializing amenities: {}", e.getMessage());
                property.setAmenities(null);
            }
        }
        property.setCleaningNotes(dto.cleaningNotes);
        // Horaires par défaut
        if (dto.defaultCheckInTime != null) property.setDefaultCheckInTime(dto.defaultCheckInTime);
        if (dto.defaultCheckOutTime != null) property.setDefaultCheckOutTime(dto.defaultCheckOutTime);
        // Durée calculée automatiquement
        property.setCleaningDurationMinutes(computeCleaningDuration(property));
        if (dto.ownerId != null) {
            User owner = userRepository.findById(dto.ownerId).orElseThrow(() -> new NotFoundException("Owner not found"));
            property.setOwner(owner);
        }
    }

    private PropertyDto toDto(Property p) {
        try {
            PropertyDto dto = new PropertyDto();
            dto.id = p.getId();
            dto.name = p.getName();
            dto.description = p.getDescription();
            dto.address = p.getAddress();
            dto.postalCode = p.getPostalCode();
            dto.city = p.getCity();
            dto.country = p.getCountry();
            dto.latitude = p.getLatitude();
            dto.longitude = p.getLongitude();
            dto.department = p.getDepartment();
            dto.arrondissement = p.getArrondissement();
            dto.bedroomCount = p.getBedroomCount();
            dto.bathroomCount = p.getBathroomCount();
            dto.maxGuests = p.getMaxGuests();
            dto.squareMeters = p.getSquareMeters();
            dto.nightlyPrice = p.getNightlyPrice();
            dto.type = p.getType();
            dto.status = p.getStatus();
            dto.airbnbListingId = p.getAirbnbListingId();
            dto.airbnbUrl = p.getAirbnbUrl();
            dto.cleaningFrequency = p.getCleaningFrequency();
            dto.maintenanceContract = p.isMaintenanceContract();
            dto.emergencyContact = p.getEmergencyContact();
            dto.emergencyPhone = p.getEmergencyPhone();
            dto.accessInstructions = p.getAccessInstructions();
            dto.specialRequirements = p.getSpecialRequirements();
            dto.cleaningBasePrice = p.getCleaningBasePrice();
            dto.cleaningDurationMinutes = p.getCleaningDurationMinutes();
            dto.numberOfFloors = p.getNumberOfFloors();
            dto.hasExterior = p.getHasExterior();
            dto.hasLaundry = p.getHasLaundry();
            dto.windowCount = p.getWindowCount();
            dto.frenchDoorCount = p.getFrenchDoorCount();
            dto.slidingDoorCount = p.getSlidingDoorCount();
            dto.hasIroning = p.getHasIroning();
            dto.hasDeepKitchen = p.getHasDeepKitchen();
            dto.hasDisinfection = p.getHasDisinfection();
            // Amenities deserialization
            if (p.getAmenities() != null && !p.getAmenities().isEmpty()) {
                try {
                    dto.amenities = objectMapper.readValue(p.getAmenities(), new TypeReference<List<String>>(){});
                } catch (Exception e) {
                    log.warn("PropertyService.toDto - Error deserializing amenities: {}", e.getMessage());
                    dto.amenities = new ArrayList<>();
                }
            } else {
                dto.amenities = new ArrayList<>();
            }
            dto.cleaningNotes = p.getCleaningNotes();
            dto.defaultCheckInTime = p.getDefaultCheckInTime();
            dto.defaultCheckOutTime = p.getDefaultCheckOutTime();

            // Gestion sécurisée de la relation owner (lazy loading)
            try {
                if (p.getOwner() != null) {
                    dto.ownerId = p.getOwner().getId();
                    dto.ownerName = (p.getOwner().getFirstName() != null ? p.getOwner().getFirstName() : "")
                        + " "
                        + (p.getOwner().getLastName() != null ? p.getOwner().getLastName() : "");
                    dto.ownerName = dto.ownerName.trim();
                } else {
                    dto.ownerId = null;
                    dto.ownerName = null;
                }
            } catch (Exception e) {
                log.warn("PropertyService.toDto - Erreur lors de l'acces a owner: {}", e.getMessage());
                dto.ownerId = null;
                dto.ownerName = null;
            }
            
            dto.createdAt = p.getCreatedAt();
            dto.updatedAt = p.getUpdatedAt();
            return dto;
        } catch (Exception e) {
            log.error("PropertyService.toDto - Erreur lors de la conversion Property -> PropertyDto, Property ID: {}", (p != null ? p.getId() : "null"), e);
            throw new RuntimeException("Erreur lors de la conversion de la propriété: " + e.getMessage(), e);
        }
    }

    /**
     * Calcule la durée de ménage estimée en minutes,
     * basée sur les caractéristiques du logement et les prestations à la carte.
     */
    private int computeCleaningDuration(Property property) {
        // Base selon le nombre de chambres (type T)
        int bedrooms = property.getBedroomCount() != null ? property.getBedroomCount() : 1;
        int baseMins;
        if (bedrooms <= 1)      baseMins = 90;   // T1 : 1h30
        else if (bedrooms == 2) baseMins = 120;  // T2 : 2h00
        else if (bedrooms == 3) baseMins = 150;  // T3 : 2h30
        else if (bedrooms == 4) baseMins = 180;  // T4 : 3h00
        else                    baseMins = 210;  // T5+ : 3h30

        // SDB supplémentaires : +15 min par SDB au-delà de 1
        int bathrooms = property.getBathroomCount() != null ? property.getBathroomCount() : 1;
        baseMins += Math.max(0, bathrooms - 1) * 15;

        // Surface > 80m² : +1 min par tranche de 5m²
        int sqm = property.getSquareMeters() != null ? property.getSquareMeters() : 0;
        if (sqm > 80) {
            baseMins += (sqm - 80) / 5;
        }

        // Vitres
        int windowCount = property.getWindowCount() != null ? property.getWindowCount() : 0;
        int frenchDoorCount = property.getFrenchDoorCount() != null ? property.getFrenchDoorCount() : 0;
        int slidingDoorCount = property.getSlidingDoorCount() != null ? property.getSlidingDoorCount() : 0;
        baseMins += windowCount * 5;
        baseMins += frenchDoorCount * 8;
        baseMins += slidingDoorCount * 12;

        // Prestations booléennes
        if (Boolean.TRUE.equals(property.getHasLaundry()))       baseMins += 10;
        if (Boolean.TRUE.equals(property.getHasIroning()))       baseMins += 20;
        if (Boolean.TRUE.equals(property.getHasDeepKitchen()))   baseMins += 30;
        if (Boolean.TRUE.equals(property.getHasExterior()))      baseMins += 25;
        if (Boolean.TRUE.equals(property.getHasDisinfection()))  baseMins += 40;

        // Étages supplémentaires : +15 min par étage au-delà de 1
        int floors = property.getNumberOfFloors() != null ? property.getNumberOfFloors() : 1;
        baseMins += Math.max(0, floors - 1) * 15;

        return baseMins;
    }

    private PropertyDto toDtoWithManager(Property p) {
        PropertyDto dto = toDto(p);
        
        // Récupérer le manager associé à cette propriété
        List<com.clenzy.model.ManagerProperty> managerProperties = managerPropertyRepository.findByPropertyId(p.getId(), tenantContext.getRequiredOrganizationId());
        if (!managerProperties.isEmpty()) {
            com.clenzy.model.ManagerProperty managerProperty = managerProperties.get(0); // Prendre le premier
            User manager = managerProperty.getManager();
            if (manager != null) {
                // Ajouter les informations du manager au DTO
                dto.managerId = manager.getId();
                dto.managerFirstName = manager.getFirstName();
                dto.managerLastName = manager.getLastName();
                dto.managerEmail = manager.getEmail();
            }
        }
        
        return dto;
    }
    
    /**
     * Vérifie si un utilisateur peut assigner une demande de service pour une propriété donnée.
     * Un utilisateur peut assigner si :
     * 1. Il est ADMIN ou MANAGER
     * 2. OU il est le manager d'un portefeuille qui contient le client propriétaire de la propriété
     * 3. OU il est directement assigné à la propriété via ManagerProperty
     */
    @Transactional(readOnly = true)
    public boolean canUserAssignForProperty(Long userId, Long propertyId) {
        // Récupérer la propriété avec son propriétaire
        Property property = propertyRepository.findByIdWithOwner(propertyId, tenantContext.getRequiredOrganizationId())
            .orElseThrow(() -> new NotFoundException("Property not found"));
        
        if (property.getOwner() == null) {
            return false;
        }
        
        Long ownerId = property.getOwner().getId();
        
        // Récupérer l'utilisateur
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new NotFoundException("User not found"));
        
        // 1. Vérifier si l'utilisateur est ADMIN ou MANAGER
        if (user.getRole() != null && user.getRole().isPlatformStaff()) {
            return true;
        }
        
        // 2. Vérifier si l'utilisateur est directement assigné à la propriété via ManagerProperty
        if (managerPropertyRepository.existsByManagerIdAndPropertyId(userId, propertyId, tenantContext.getRequiredOrganizationId())) {
            return true;
        }
        
        // 3. Vérifier si l'utilisateur est le manager d'un portefeuille qui contient le client propriétaire
        List<Portfolio> portfolios = portfolioRepository.findByManagerId(userId, tenantContext.getRequiredOrganizationId());
        for (Portfolio portfolio : portfolios) {
            if (portfolioClientRepository.existsByPortfolioIdAndClientIdAndIsActiveTrue(portfolio.getId(), ownerId, tenantContext.getRequiredOrganizationId())) {
                return true;
            }
        }
        
        return false;
    }
}


