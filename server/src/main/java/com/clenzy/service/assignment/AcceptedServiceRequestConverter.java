package com.clenzy.service.assignment;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.service.InterventionAllocationGuard;
import com.clenzy.service.access.StayTimes;
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
        // Le besoin porte l'heure du logement ; les horodatages d'intervention sont en UTC.
        LocalDateTime scheduled = need.getDesiredDate();
        if (scheduled != null && need.getProperty() != null) {
            scheduled = scheduled.atZone(StayTimes.zoneOf(need.getProperty()))
                .withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
        }
        mission.setScheduledDate(scheduled);
        mission.setStartTime(scheduled);
        mission.setEstimatedDurationHours(need.getEstimatedDurationHours());
        mission.setSpecialInstructions(need.getSpecialInstructions());
        mission.setAccessNotes(need.getAccessNotes());
        mission.setGuestCheckoutTime(need.getGuestCheckoutTime());
        mission.setGuestCheckinTime(need.getGuestCheckinTime());
        if (scheduled!=null && need.getEstimatedDurationHours()!=null)
            mission.setEndTime(scheduled.plusHours(need.getEstimatedDurationHours()));
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
            // Les extras gardent leur lien via le besoin. Seul le ménage de départ
            // occupe le lien utilisé pour le suivi du séjour et de la caution.
            if ("cleaning-turnover".equals(need.getServiceItemCode())
                    || (need.getServiceItemCode()==null && need.getServiceType()==ServiceType.CLEANING))
                reservation.setIntervention(mission);
        }
    }
}
