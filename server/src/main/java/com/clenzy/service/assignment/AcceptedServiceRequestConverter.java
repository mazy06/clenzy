package com.clenzy.service.assignment;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.service.InterventionAllocationGuard;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import java.time.*;

/** Conversion initiale uniquement après accord, sous le verrou du besoin. */
@Service
public class AcceptedServiceRequestConverter {
    private final InterventionRepository interventions;
    private final UserRepository users;
    private final ReservationRepository reservations;
    private final InterventionAllocationGuard allocation;
    private final Clock clock;
    public AcceptedServiceRequestConverter(InterventionRepository interventions, UserRepository users,
            ReservationRepository reservations, InterventionAllocationGuard allocation, Clock clock) {
        this.interventions=interventions; this.users=users; this.reservations=reservations; this.allocation=allocation; this.clock=clock;
    }
    @Transactional(propagation=Propagation.MANDATORY)
    public Intervention convert(ServiceRequest need) {
        if (need.getConvertedInterventionId()!=null)
            return interventions.findById(need.getConvertedInterventionId()).orElseThrow();
        if (interventions.existsByServiceRequestId(need.getId()))
            throw new IllegalStateException("Une intervention existe déjà pour cette demande");
        if (need.getAssignedToId()==null) throw new IllegalStateException("Accord prestataire requis");
        var mission=new Intervention();
        mission.setOrganizationId(need.getOrganizationId());
        mission.setServiceRequest(need);
        mission.setInitialAcceptanceRequestId(need.getId());
        mission.setProperty(need.getProperty());
        mission.setRequestor(need.getUser());
        mission.setTitle(need.getTitle());
        String description=need.getDescription();
        mission.setDescription(description==null?null:description.substring(0,Math.min(500,description.length())));
        mission.setServiceItemCode(need.getServiceItemCode());
        mission.setType(need.getServiceType().name());
        mission.setStatus(InterventionStatus.PENDING);
        mission.setPriority(need.getPriority().name());
        mission.setScheduledDate(need.getDesiredDate());
        mission.setStartTime(need.getDesiredDate());
        mission.setEstimatedDurationHours(need.getEstimatedDurationHours());
        mission.setSpecialInstructions(need.getSpecialInstructions());
        mission.setAccessNotes(need.getAccessNotes());
        mission.setGuestCheckoutTime(need.getGuestCheckoutTime());
        mission.setGuestCheckinTime(need.getGuestCheckinTime());
        if (need.getDesiredDate()!=null && need.getEstimatedDurationHours()!=null)
            mission.setEndTime(need.getDesiredDate().plusHours(need.getEstimatedDurationHours()));
        mission.setEstimatedCost(need.getEstimatedCost());
        mission.setRecommendedCost(need.getRecommendedCost());
        mission.setIsUrgent(need.isUrgent());
        mission.setPaymentStatus(need.getPaymentStatus());
        mission.setPaidAt(need.getPaidAt());
        if ("team".equals(need.getAssignedToType())) mission.proposeAssignment(null,need.getAssignedToId());
        else mission.proposeAssignment(users.findById(need.getAssignedToId()).orElseThrow(),null);
        mission.setAssignmentResponse(InterventionAssignmentResponse.ACCEPTED);
        mission.setAssignmentRespondedAt(LocalDateTime.now(clock));
        allocation.requireAvailable(mission);
        mission=interventions.saveAndFlush(mission);
        need.setConvertedInterventionId(mission.getId());
        need.setAssignmentPhase("CONVERTED");
        need.setAutoAssignStatus("confirmed");
        linkReservation(need, mission);
        return mission;
    }

    @Transactional(propagation=Propagation.MANDATORY)
    public void linkReservation(ServiceRequest need, Intervention mission) {
        if (need.getReservationId()!=null) {
            var reservation=reservations.findById(need.getReservationId()).orElseThrow();
            if (!need.getOrganizationId().equals(reservation.getOrganizationId()))
                throw new org.springframework.security.access.AccessDeniedException("Séjour hors organisation");
            reservation.setIntervention(mission);
        }
    }
}
