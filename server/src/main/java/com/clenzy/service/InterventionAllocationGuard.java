package com.clenzy.service;

import com.clenzy.exception.AssignmentConflictException;
import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.repository.ServiceRequestRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Réserve les ressources d'une intervention avec le même verrou que les demandes. */
@Service
public class InterventionAllocationGuard {
    private final com.clenzy.marketplace.service.ProviderDocumentaryService documentary;
    private final ServiceRequestRepository requests;
    private final ProviderAvailabilityService availability;
    private final ProviderPropertyEligibility propertyEligibility;

    public InterventionAllocationGuard(ServiceRequestRepository requests, ProviderAvailabilityService availability, ProviderPropertyEligibility propertyEligibility, com.clenzy.marketplace.service.ProviderDocumentaryService documentary) {
        this.documentary=documentary;
        this.propertyEligibility=propertyEligibility;
        this.requests = requests;
        this.availability = availability;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void requireAvailable(Intervention intervention) { requireAvailable(intervention,null); }

    @Transactional(propagation = Propagation.MANDATORY)
    public void requireAvailable(Intervention intervention, String serviceScope) {
        if (intervention.getStatus() == InterventionStatus.CANCELLED
                || intervention.getStatus() == InterventionStatus.COMPLETED) return;
        Long requestId = intervention.getServiceRequest() == null ? null : intervention.getServiceRequest().getId();
        if (intervention.getTeamId() != null) {
            check(intervention, requestId, "team", intervention.getTeamId());
            requirePropertyAllowed("team", intervention.getTeamId(), intervention.getProperty());
            if (!isTeamDeclaredAvailable(intervention.getTeamId(), intervention.getScheduledDate(),
                    intervention.getEstimatedDurationHours())) {
                throw new AssignmentConflictException(
                        "L'équipe est indisponible sur ce créneau. Choisissez un autre créneau ou prestataire.");
            }
        }
        if (intervention.getAssignedUser() != null) {
            check(intervention, requestId, "user", intervention.getAssignedUser().getId());
            requirePropertyAllowed("user", intervention.getAssignedUser().getId(), intervention.getProperty());
            if (!isUserDeclaredAvailable(intervention.getAssignedUser().getId(), intervention.getScheduledDate(),
                    intervention.getEstimatedDurationHours())) {
                throw new AssignmentConflictException("Le prestataire est indisponible sur ce créneau.");
            }
        }
        documentary.requireAssignment(intervention, serviceScope);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void requireDocumentaryAssignment(com.clenzy.model.ServiceRequest request, String kind, Long id) {
        var mission = new Intervention();
        mission.setProperty(request.getProperty());
        mission.setScheduledDate(request.getDesiredDate());
        mission.setType(request.getServiceType() == null ? "OTHER" : request.getServiceType().name());
        if ("team".equals(kind)) mission.setTeamId(id);
        else {
            var user = new com.clenzy.model.User();
            user.setId(id);
            mission.setAssignedUser(user);
        }
        try { documentary.requireAssignment(mission, null); }
        catch (IllegalStateException unavailable) { throw new AssignmentConflictException(unavailable.getMessage()); }
    }

    /** Verdict commun après verrouillage ; un refus permet à l'automatisation d'essayer une autre équipe. */
    @Transactional(propagation = Propagation.MANDATORY)
    public boolean isTeamDeclaredAvailable(Long teamId, java.time.LocalDateTime start, Integer duration) {
        // Même durée de repli que la réservation commune des ressources.
        var finish = start.plusHours(duration != null && duration > 0 ? duration : 4);
        return availability.isAvailable(teamId, start, finish);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public boolean isUserDeclaredAvailable(Long userId, java.time.LocalDateTime start, Integer duration) {
        return availability.isUserAvailable(userId, start, start.plusHours(duration != null && duration > 0 ? duration : 4));
    }

    public void requirePropertyAllowed(String kind, Long id, com.clenzy.model.Property property) {
        propertyEligibility.require(kind,id,property);
    }

    private void check(Intervention intervention, Long requestId, String type, Long targetId) {
        if (requests.interventionAssignmentConflicts(requestId, intervention.getId(), type, targetId,
                intervention.getScheduledDate(), intervention.getEstimatedDurationHours())) {
            throw new AssignmentConflictException();
        }
    }
}
