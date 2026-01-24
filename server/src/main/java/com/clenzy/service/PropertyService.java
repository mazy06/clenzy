package com.clenzy.service;

import com.clenzy.dto.PropertyDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Property;
import com.clenzy.model.User;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.repository.ManagerPropertyRepository;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

@Service
@Transactional
public class PropertyService {
    private final PropertyRepository propertyRepository;
    private final UserRepository userRepository;
    private final ManagerPropertyRepository managerPropertyRepository;

    public PropertyService(PropertyRepository propertyRepository, UserRepository userRepository, ManagerPropertyRepository managerPropertyRepository) {
        this.propertyRepository = propertyRepository;
        this.userRepository = userRepository;
        this.managerPropertyRepository = managerPropertyRepository;
    }

    @CacheEvict(value = "properties", allEntries = true)
    public PropertyDto create(PropertyDto dto) {
        Property property = new Property();
        apply(dto, property);
        property = propertyRepository.save(property);
        return toDto(property);
    }

    @CacheEvict(value = "properties", allEntries = true)
    public PropertyDto update(Long id, PropertyDto dto) {
        Property property = propertyRepository.findById(id).orElseThrow(() -> new NotFoundException("Property not found"));
        apply(dto, property);
        property = propertyRepository.save(property);
        return toDto(property);
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "properties", key = "#id")
    public PropertyDto getById(Long id) {
        Property entity = propertyRepository.findById(id).orElseThrow(() -> new NotFoundException("Property not found"));
        return toDto(entity);
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
        if (dto.ownerId != null) {
            User owner = userRepository.findById(dto.ownerId).orElseThrow(() -> new NotFoundException("Owner not found"));
            property.setOwner(owner);
        }
    }

    private PropertyDto toDto(Property p) {
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
        dto.ownerId = p.getOwner() != null ? p.getOwner().getId() : null;
        dto.createdAt = p.getCreatedAt();
        dto.updatedAt = p.getUpdatedAt();
        return dto;
    }

    private PropertyDto toDtoWithManager(Property p) {
        PropertyDto dto = toDto(p);
        
        // Récupérer le manager associé à cette propriété
        List<com.clenzy.model.ManagerProperty> managerProperties = managerPropertyRepository.findByPropertyId(p.getId());
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
}


