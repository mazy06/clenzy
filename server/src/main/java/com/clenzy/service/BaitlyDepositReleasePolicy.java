package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.IssueRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.List;
import java.util.Set;

/** La fin du séjour seule ne prouve pas que le logement a été contrôlé. */
@Service
@Transactional(readOnly = true)
public class BaitlyDepositReleasePolicy {
    private final InterventionRepository interventions;
    private final IssueRepository issues;
    private final Clock clock;

    public BaitlyDepositReleasePolicy(InterventionRepository interventions, IssueRepository issues, Clock clock) {
        this.interventions = interventions; this.issues = issues; this.clock = clock;
    }

    public boolean eligible(Reservation reservation) {
        if (reservation == null || reservation.getId() == null || reservation.getOrganizationId() == null) return false;
        // Une annulation après occupation ne remplace pas l'inspection de départ.
        if ("cancelled".equalsIgnoreCase(reservation.getStatus()) && reservation.getCheckIn() != null
                && reservation.getCancelledAt() != null
                && reservation.getCancelledAt().isBefore(reservation.getCheckIn().atStartOfDay())) return true;
        var property = reservation.getProperty();
        if (property == null || property.getId() == null || !reservation.getOrganizationId().equals(property.getOrganizationId())
                || reservation.getCheckOut() == null) return false;
        final LocalDateTime departure;
        try {
            String time = reservation.getCheckOutTime();
            if (time == null || time.isBlank()) time = property.getDefaultCheckOutTime();
            departure = reservation.getCheckOut().atTime(LocalTime.parse(time == null || time.isBlank() ? "11:00" : time));
            if (clock.instant().isBefore(departure.atZone(SecurityDepositHoldPolicy.zoneOf(property)).toInstant())) return false;
        } catch (DateTimeException invalid) { return false; }

        var cleanings = interventions.findByReservationId(reservation.getId(), reservation.getOrganizationId()).stream()
                .filter(i -> i.getServiceRequest() != null && i.getServiceRequest().getServiceType() != null
                        && Set.of(ServiceType.CLEANING, ServiceType.EXPRESS_CLEANING, ServiceType.DEEP_CLEANING)
                            .contains(i.getServiceRequest().getServiceType()))
                .filter(i -> i.getStatus() != InterventionStatus.CANCELLED)
                .filter(i -> i.getScheduledDate() != null && !i.getScheduledDate().toLocalDate().isBefore(reservation.getCheckOut()))
                .toList();
        if (cleanings.isEmpty() || cleanings.stream().anyMatch(i ->
                !reservation.getOrganizationId().equals(i.getOrganizationId()) || i.getProperty() == null
                || !property.getId().equals(i.getProperty().getId())
                || !reservation.getId().equals(i.getServiceRequest().getReservationId())
                || !Set.of(InterventionStatus.COMPLETED, InterventionStatus.AWAITING_PAYMENT).contains(i.getStatus())
                || i.getCompletedAt() == null || i.getCompletedAt().isBefore(departure))) return false;

        // Une anomalie convertie en intervention exige aussi une décision humaine sur la caution.
        return !issues.existsByOrganizationIdAndPropertyIdAndStatusIn(reservation.getOrganizationId(), property.getId(),
                List.of(Issue.IssueStatus.OPEN, Issue.IssueStatus.QUALIFIED, Issue.IssueStatus.CONVERTED));
    }
}
