package com.clenzy.service;

import com.clenzy.dto.InterventionDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.Property;
import com.clenzy.model.Team;
import com.clenzy.model.User;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.TeamRepository;
import com.clenzy.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.stream.Collectors;

/**
 * Handles bidirectional mapping between {@link Intervention} entities and {@link InterventionDto}.
 * Extracted from InterventionService to respect SRP.
 */
@Service
public class InterventionMapper {

    private static final Logger log = LoggerFactory.getLogger(InterventionMapper.class);

    private final PropertyRepository propertyRepository;
    private final UserRepository userRepository;
    private final TeamRepository teamRepository;
    private final InterventionPhotoService photoService;

    public InterventionMapper(PropertyRepository propertyRepository,
                              UserRepository userRepository,
                              TeamRepository teamRepository,
                              InterventionPhotoService photoService) {
        this.propertyRepository = propertyRepository;
        this.userRepository = userRepository;
        this.teamRepository = teamRepository;
        this.photoService = photoService;
    }

    /**
     * Apply DTO field values onto an existing entity (create or update).
     */
    public void apply(InterventionDto dto, Intervention intervention) {
        if (dto.title != null) intervention.setTitle(dto.title);
        if (dto.description != null) intervention.setDescription(dto.description);
        if (dto.type != null) intervention.setType(dto.type);
        if (dto.status != null) {
            try {
                InterventionStatus status = InterventionStatus.fromString(dto.status);
                intervention.setStatus(status);
                log.debug("apply - status updated: {}", status);
            } catch (IllegalArgumentException e) {
                log.warn("apply - invalid status: {}", dto.status);
                throw new IllegalArgumentException("Statut invalide: " + dto.status + ". Valeurs autorisees: " +
                        Arrays.stream(InterventionStatus.values()).map(InterventionStatus::name).collect(Collectors.joining(", ")));
            }
        }
        if (dto.priority != null) intervention.setPriority(dto.priority);
        if (dto.estimatedDurationHours != null) intervention.setEstimatedDurationHours(dto.estimatedDurationHours);
        if (dto.estimatedCost != null) intervention.setEstimatedCost(dto.estimatedCost);
        if (dto.notes != null) intervention.setNotes(dto.notes);
        if (dto.progressPercentage != null) intervention.setProgressPercentage(dto.progressPercentage);

        // Assignment handling
        if (dto.assignedToType != null && dto.assignedToId != null) {
            if ("user".equals(dto.assignedToType)) {
                intervention.setAssignedTechnicianId(dto.assignedToId);
                intervention.setTeamId(null);

                User assignedUser = userRepository.findById(dto.assignedToId).orElse(null);
                if (assignedUser != null) {
                    intervention.setAssignedUser(assignedUser);
                    log.debug("apply - user assigned: {}", assignedUser.getFullName());
                }
            } else if ("team".equals(dto.assignedToType)) {
                intervention.setTeamId(dto.assignedToId);
                intervention.setAssignedTechnicianId(null);
                intervention.setAssignedUser(null);

                Team assignedTeam = teamRepository.findById(dto.assignedToId).orElse(null);
                if (assignedTeam != null) {
                    log.debug("apply - team assigned: {}", assignedTeam.getName());
                } else {
                    log.warn("apply - team not found for id: {}", dto.assignedToId);
                }
            }
        }

        if (dto.propertyId != null) {
            Property property = propertyRepository.findById(dto.propertyId)
                    .orElseThrow(() -> new NotFoundException("Propriete non trouvee"));
            intervention.setProperty(property);
        }

        if (dto.requestorId != null) {
            User requestor = userRepository.findById(dto.requestorId)
                    .orElseThrow(() -> new NotFoundException("Demandeur non trouve"));
            intervention.setRequestor(requestor);
        }

        if (dto.scheduledDate != null) {
            LocalDateTime scheduledDate = LocalDateTime.parse(dto.scheduledDate,
                    DateTimeFormatter.ISO_LOCAL_DATE_TIME);
            intervention.setScheduledDate(scheduledDate);
        }
    }

    /**
     * Convert an entity to its DTO representation.
     */
    public InterventionDto convertToDto(Intervention intervention) {
        try {
            InterventionDto dto = new InterventionDto();

            // Basic properties
            dto.id = intervention.getId();
            dto.title = intervention.getTitle();
            dto.description = intervention.getDescription();
            dto.type = intervention.getType();
            dto.status = intervention.getStatus().name();
            dto.priority = intervention.getPriority();
            dto.estimatedDurationHours = intervention.getEstimatedDurationHours();
            dto.actualDurationMinutes = intervention.getActualDurationMinutes();
            dto.estimatedCost = intervention.getEstimatedCost();
            dto.actualCost = intervention.getActualCost();
            dto.notes = intervention.getNotes();
            // Convert BYTEA photos to base64 data URLs for frontend compatibility
            dto.photos = photoService.convertPhotosToBase64Urls(intervention);
            dto.beforePhotosUrls = photoService.convertPhotosToBase64UrlsByType(intervention, "before");
            dto.afterPhotosUrls = photoService.convertPhotosToBase64UrlsByType(intervention, "after");
            dto.validatedRooms = intervention.getValidatedRooms();
            dto.completedSteps = intervention.getCompletedSteps();
            dto.progressPercentage = intervention.getProgressPercentage();

            // Dates
            if (intervention.getScheduledDate() != null) {
                dto.scheduledDate = intervention.getScheduledDate().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
            } else {
                dto.scheduledDate = null;
            }

            dto.createdAt = intervention.getCreatedAt();
            dto.updatedAt = intervention.getUpdatedAt();
            dto.completedAt = intervention.getCompletedAt();
            dto.startTime = intervention.getStartTime();
            dto.endTime = intervention.getEndTime();

            // Relations
            if (intervention.getProperty() != null) {
                dto.propertyId = intervention.getProperty().getId();
                dto.propertyName = intervention.getProperty().getName();
                dto.propertyAddress = intervention.getProperty().getAddress();
                if (intervention.getProperty().getType() != null) {
                    dto.propertyType = intervention.getProperty().getType().name().toLowerCase();
                }
            }

            if (intervention.getRequestor() != null) {
                dto.requestorId = intervention.getRequestor().getId();
                dto.requestorName = intervention.getRequestor().getFullName();
            }

            // Assignment handling
            if (intervention.getAssignedToType() != null) {
                dto.assignedToType = intervention.getAssignedToType();
                dto.assignedToId = intervention.getAssignedToId();

                if ("user".equals(intervention.getAssignedToType()) && intervention.getAssignedUser() != null) {
                    dto.assignedToName = intervention.getAssignedUser().getFullName();
                } else if ("team".equals(intervention.getAssignedToType()) && intervention.getTeamId() != null) {
                    Team assignedTeam = teamRepository.findById(intervention.getTeamId()).orElse(null);
                    if (assignedTeam != null) {
                        dto.assignedToName = assignedTeam.getName();
                    } else {
                        dto.assignedToName = "Equipe inconnue";
                        log.warn("convertToDto - team not found for id: {}", intervention.getTeamId());
                    }
                } else {
                    dto.assignedToName = null;
                }
            } else {
                dto.assignedToType = null;
                dto.assignedToId = null;
                dto.assignedToName = null;
            }

            // Payment fields
            if (intervention.getPaymentStatus() != null) {
                dto.paymentStatus = intervention.getPaymentStatus().name();
            }
            dto.stripePaymentIntentId = intervention.getStripePaymentIntentId();
            dto.stripeSessionId = intervention.getStripeSessionId();
            dto.paidAt = intervention.getPaidAt();
            dto.preferredTimeSlot = intervention.getPreferredTimeSlot();

            return dto;
        } catch (Exception e) {
            log.error("convertToDto - error converting intervention id={}", intervention.getId(), e);
            throw e;
        }
    }
}
