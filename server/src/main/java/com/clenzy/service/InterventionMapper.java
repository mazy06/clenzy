package com.clenzy.service;

import com.clenzy.dto.CreateInterventionRequest;
import com.clenzy.dto.InterventionResponse;
import com.clenzy.dto.UpdateInterventionRequest;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Intervention;
import com.clenzy.model.Property;
import com.clenzy.model.Team;
import com.clenzy.model.User;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.TeamRepository;
import com.clenzy.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;

/**
 * Handles bidirectional mapping between {@link Intervention} entities and DTOs.
 * Extracted from InterventionService to respect SRP.
 */
@Service
@Transactional(readOnly = true)
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
     * Apply create request fields onto a new entity.
     */
    public void apply(CreateInterventionRequest request, Intervention intervention) {
        intervention.setTitle(request.title());
        if (request.description() != null) intervention.setDescription(request.description());
        intervention.setType(request.type());
        intervention.setPriority(request.priority());
        if (request.estimatedDurationHours() != null) intervention.setEstimatedDurationHours(request.estimatedDurationHours());

        // Assignment handling
        if (request.assignedToType() != null && request.assignedToId() != null) {
            applyAssignment(request.assignedToType(), request.assignedToId(), intervention);
        }

        Property property = propertyRepository.findById(request.propertyId())
                .orElseThrow(() -> new NotFoundException("Propriete non trouvee"));
        intervention.setProperty(property);

        User requestor = userRepository.findById(request.requestorId())
                .orElseThrow(() -> new NotFoundException("Demandeur non trouve"));
        intervention.setRequestor(requestor);

        LocalDateTime scheduledDate = LocalDateTime.parse(request.scheduledDate(),
                DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        intervention.setScheduledDate(scheduledDate);
    }

    /**
     * Apply update request fields onto an existing entity (partial update).
     * Status changes must go through dedicated lifecycle endpoints.
     */
    public void applyUpdate(UpdateInterventionRequest request, Intervention intervention) {
        if (request.title() != null) intervention.setTitle(request.title());
        if (request.description() != null) intervention.setDescription(request.description());
        if (request.type() != null) intervention.setType(request.type());
        if (request.priority() != null) intervention.setPriority(request.priority());
        if (request.estimatedDurationHours() != null) intervention.setEstimatedDurationHours(request.estimatedDurationHours());
        if (request.estimatedCost() != null) intervention.setEstimatedCost(request.estimatedCost());
        if (request.notes() != null) intervention.setNotes(request.notes());

        // Assignment handling
        if (request.assignedToType() != null && request.assignedToId() != null) {
            applyAssignment(request.assignedToType(), request.assignedToId(), intervention);
        }
    }

    /**
     * Convert an entity to its response representation, using a pre-loaded team name map
     * to avoid N+1 queries when converting lists of interventions.
     */
    public InterventionResponse convertToResponse(Intervention intervention, Map<Long, String> teamNameMap) {
        return convertToResponseInternal(intervention, teamNameMap);
    }

    /**
     * Convert an entity to its response representation.
     */
    public InterventionResponse convertToResponse(Intervention intervention) {
        return convertToResponseInternal(intervention, null);
    }

    /**
     * Convert an entity to a lightweight response for list views.
     * Identical to convertToResponseInternal but SKIPS photo loading to avoid N+1 BYTEA loads.
     */
    public InterventionResponse convertToListResponse(Intervention intervention, Map<Long, String> teamNameMap) {
        return convertToResponseInternal(intervention, teamNameMap, false);
    }

    private InterventionResponse convertToResponseInternal(Intervention intervention, Map<Long, String> teamNameMap) {
        return convertToResponseInternal(intervention, teamNameMap, true);
    }

    private InterventionResponse convertToResponseInternal(Intervention intervention, Map<Long, String> teamNameMap, boolean loadPhotos) {
        InterventionResponse.Builder builder = InterventionResponse.builder();

        // Basic properties
        builder.id(intervention.getId())
               .title(intervention.getTitle())
               .description(intervention.getDescription())
               .type(intervention.getType())
               .status(intervention.getStatus().name())
               .priority(intervention.getPriority())
               .estimatedDurationHours(intervention.getEstimatedDurationHours())
               .actualDurationMinutes(intervention.getActualDurationMinutes())
               .estimatedCost(intervention.getEstimatedCost())
               .actualCost(intervention.getActualCost())
               .notes(intervention.getNotes());

        if (loadPhotos) {
            // Convert BYTEA photos to base64 data URLs for frontend compatibility (single query)
            InterventionPhotoService.PhotoBundle photoBundle = photoService.loadPhotoBundle(intervention);
            builder.photos(photoBundle.allPhotosJson())
                   .beforePhotosUrls(photoBundle.beforeUrls())
                   .afterPhotosUrls(photoBundle.afterUrls())
                   .beforePhotoIds(photoBundle.beforeIds())
                   .afterPhotoIds(photoBundle.afterIds());
        }

        builder.validatedRooms(intervention.getValidatedRooms())
               .completedSteps(intervention.getCompletedSteps())
               .progressPercentage(intervention.getProgressPercentage());

        // Dates
        if (intervention.getScheduledDate() != null) {
            builder.scheduledDate(intervention.getScheduledDate().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        }

        builder.createdAt(intervention.getCreatedAt())
               .updatedAt(intervention.getUpdatedAt())
               .completedAt(intervention.getCompletedAt())
               .startTime(intervention.getStartTime())
               .endTime(intervention.getEndTime());

        // Relations
        if (intervention.getProperty() != null) {
            Property prop = intervention.getProperty();
            builder.propertyId(prop.getId())
                   .propertyName(prop.getName())
                   .propertyAddress(prop.getAddress());
            if (prop.getType() != null) {
                builder.propertyType(prop.getType().name().toLowerCase());
            }
            builder.propertyLatitude(prop.getLatitude() != null ? prop.getLatitude().doubleValue() : null)
                   .propertyLongitude(prop.getLongitude() != null ? prop.getLongitude().doubleValue() : null);
        }

        if (intervention.getRequestor() != null) {
            builder.requestorId(intervention.getRequestor().getId())
                   .requestorName(intervention.getRequestor().getFullName());
        }

        // Assignment handling
        if (intervention.getAssignedToType() != null) {
            builder.assignedToType(intervention.getAssignedToType())
                   .assignedToId(intervention.getAssignedToId());

            if ("user".equals(intervention.getAssignedToType()) && intervention.getAssignedUser() != null) {
                builder.assignedToName(intervention.getAssignedUser().getFullName());
                if (intervention.getAssignedUser().getRole() != null) {
                    builder.assignedUserRole(intervention.getAssignedUser().getRole().name());
                }
            } else if ("team".equals(intervention.getAssignedToType()) && intervention.getTeamId() != null) {
                // Use pre-loaded team name map when available (list conversions) to avoid N+1
                String teamName = teamNameMap != null ? teamNameMap.get(intervention.getTeamId()) : null;
                if (teamName != null) {
                    builder.assignedToName(teamName);
                } else {
                    Team assignedTeam = teamRepository.findById(intervention.getTeamId()).orElse(null);
                    if (assignedTeam != null) {
                        builder.assignedToName(assignedTeam.getName());
                    } else {
                        builder.assignedToName("Equipe inconnue");
                        log.warn("convertToResponse - team not found for id: {}", intervention.getTeamId());
                    }
                }
            }
        }

        // Payment fields
        if (intervention.getPaymentStatus() != null) {
            builder.paymentStatus(intervention.getPaymentStatus().name());
        }
        builder.stripePaymentIntentId(intervention.getStripePaymentIntentId())
               .stripeSessionId(intervention.getStripeSessionId())
               .paidAt(intervention.getPaidAt())
               .preferredTimeSlot(intervention.getPreferredTimeSlot());

        return builder.build();
    }

    // ── Private helpers ─────────────────────────────────────────────────────

    private void applyAssignment(String assignedToType, Long assignedToId, Intervention intervention) {
        if ("user".equals(assignedToType)) {
            intervention.setAssignedTechnicianId(assignedToId);
            intervention.setTeamId(null);

            User assignedUser = userRepository.findById(assignedToId).orElse(null);
            if (assignedUser != null) {
                intervention.setAssignedUser(assignedUser);
                log.debug("apply - user assigned: {}", assignedUser.getFullName());
            }
        } else if ("team".equals(assignedToType)) {
            intervention.setTeamId(assignedToId);
            intervention.setAssignedTechnicianId(null);
            intervention.setAssignedUser(null);

            Team assignedTeam = teamRepository.findById(assignedToId).orElse(null);
            if (assignedTeam != null) {
                log.debug("apply - team assigned: {}", assignedTeam.getName());
            } else {
                log.warn("apply - team not found for id: {}", assignedToId);
            }
        } else {
            throw new IllegalArgumentException("assignedToType doit etre 'user' ou 'team', recu: " + assignedToType);
        }
    }
}
