package com.clenzy.service;

import com.clenzy.dto.PropertyDto;
import com.clenzy.dto.ServiceRequestDto;
import com.clenzy.dto.TeamDto;
import com.clenzy.dto.UserDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Property;
import com.clenzy.model.ServiceRequest;
import com.clenzy.model.Team;
import com.clenzy.model.User;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.TeamRepository;
import com.clenzy.repository.UserRepository;
import org.springframework.stereotype.Service;

@Service
public class ServiceRequestMapper {

    private final UserRepository userRepository;
    private final PropertyRepository propertyRepository;
    private final TeamRepository teamRepository;

    public ServiceRequestMapper(UserRepository userRepository,
                                PropertyRepository propertyRepository,
                                TeamRepository teamRepository) {
        this.userRepository = userRepository;
        this.propertyRepository = propertyRepository;
        this.teamRepository = teamRepository;
    }

    public void apply(ServiceRequestDto dto, ServiceRequest e) {
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

    public ServiceRequestDto toDto(ServiceRequest e) {
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

        // Remplir les informations de l'assignation (utilisateur ou equipe)
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

        // Inclure les objets complets pour eviter les "inconnu"
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
