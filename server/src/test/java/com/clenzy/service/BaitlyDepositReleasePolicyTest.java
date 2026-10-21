package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import org.junit.jupiter.api.*;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BaitlyDepositReleasePolicyTest {
    final InterventionRepository interventions=mock(InterventionRepository.class);
    final IssueRepository issues=mock(IssueRepository.class);
    final Clock clock=Clock.fixed(Instant.parse("2026-10-17T15:00:00Z"), ZoneOffset.UTC);
    final BaitlyDepositReleasePolicy policy=new BaitlyDepositReleasePolicy(interventions,issues,clock);
    Reservation reservation;
    Intervention cleaning;

    @BeforeEach void setup() {
        var property=new Property();property.setId(50L);property.setOrganizationId(7L);property.setTimezone("Europe/Paris");
        reservation=new Reservation();reservation.setId(9L);reservation.setOrganizationId(7L);reservation.setProperty(property);
        reservation.setCheckIn(LocalDate.of(2026,10,14));
        reservation.setCheckOut(LocalDate.of(2026,10,17));reservation.setCheckOutTime("11:00");
        var request=new ServiceRequest();request.setReservationId(9L);request.setServiceType(ServiceType.CLEANING);
        cleaning=new Intervention();cleaning.setId(20L);cleaning.setOrganizationId(7L);cleaning.setProperty(property);
        cleaning.setServiceRequest(request);cleaning.setStatus(InterventionStatus.COMPLETED);
        cleaning.setScheduledDate(LocalDateTime.of(2026,10,17,12,0));cleaning.setCompletedAt(LocalDateTime.of(2026,10,17,14,0));
        when(interventions.findByReservationId(9L,7L)).thenReturn(List.of(cleaning));
    }

    @Test void completedDepartureCleaningWithoutIssuesPermitsRelease() {
        assertThat(policy.eligible(reservation)).isTrue();
        verify(issues).existsByOrganizationIdAndPropertyIdAndStatusIn(7L,50L,
                List.of(Issue.IssueStatus.OPEN,Issue.IssueStatus.QUALIFIED,Issue.IssueStatus.CONVERTED));
    }
    @Test void managerValidatedCleaningDoesNotNeedToWaitForProviderPayment() {
        cleaning.setStatus(InterventionStatus.AWAITING_PAYMENT);
        assertThat(policy.eligible(reservation)).isTrue();
    }
    @Test void absenceOfCleaningOrUnvalidatedWorkNeverMeansNoDamage() {
        when(interventions.findByReservationId(9L,7L)).thenReturn(List.of());
        assertThat(policy.eligible(reservation)).isFalse();
        when(interventions.findByReservationId(9L,7L)).thenReturn(List.of(cleaning));
        for(var status:List.of(InterventionStatus.PENDING,InterventionStatus.IN_PROGRESS,
                InterventionStatus.AWAITING_VALIDATION,InterventionStatus.CANCELLED)) {
            cleaning.setStatus(status);assertThat(policy.eligible(reservation)).isFalse();
        }
    }
    @Test void anyReportedUnresolvedIssueBlocksAutomaticRelease() {
        when(issues.existsByOrganizationIdAndPropertyIdAndStatusIn(eq(7L),eq(50L),any())).thenReturn(true);
        assertThat(policy.eligible(reservation)).isFalse();
    }
    @Test void cleaningBeforeDepartureOrAnotherStayCannotReleaseThisDeposit() {
        cleaning.setCompletedAt(LocalDateTime.of(2026,10,17,10,0));
        assertThat(policy.eligible(reservation)).isFalse();
        cleaning.setCompletedAt(LocalDateTime.of(2026,10,17,14,0));
        cleaning.getServiceRequest().setReservationId(10L);
        assertThat(policy.eligible(reservation)).isFalse();
    }
    @Test void otherPropertyOtherTenantOrMissingCompletionAreRejected() {
        cleaning.setOrganizationId(8L);assertThat(policy.eligible(reservation)).isFalse();cleaning.setOrganizationId(7L);
        var other=new Property();other.setId(51L);cleaning.setProperty(other);
        assertThat(policy.eligible(reservation)).isFalse();cleaning.setProperty(reservation.getProperty());
        cleaning.setCompletedAt(null);assertThat(policy.eligible(reservation)).isFalse();
    }
    @Test void oneCompletedTaskCannotHideAnotherUnfinishedCleaning() {
        var pending=new Intervention();pending.setOrganizationId(7L);pending.setProperty(reservation.getProperty());
        pending.setServiceRequest(cleaning.getServiceRequest());pending.setStatus(InterventionStatus.IN_PROGRESS);
        pending.setScheduledDate(cleaning.getScheduledDate());
        when(interventions.findByReservationId(9L,7L)).thenReturn(List.of(cleaning,pending));
        assertThat(policy.eligible(reservation)).isFalse();
    }
    @Test void maintenanceIsNotACompletedDepartureCleaning() {
        cleaning.getServiceRequest().setServiceType(ServiceType.PREVENTIVE_MAINTENANCE);
        assertThat(policy.eligible(reservation)).isFalse();
    }
    @Test void completedMidStayCleaningNeverReplacesTheDepartureInspection() {
        cleaning.getServiceRequest().setServiceItemCode("cleaning-mid-stay");
        cleaning.setScheduledDate(LocalDateTime.of(2026,10,16,12,0));
        cleaning.setCompletedAt(LocalDateTime.of(2026,10,16,14,0));
        assertThat(policy.eligible(reservation)).isFalse();
    }
    @Test void propertyTimezoneControlsDepartureBoundary() {
        reservation.getProperty().setTimezone("America/Los_Angeles");
        assertThat(policy.eligible(reservation)).isFalse();
    }
    @Test void cancelledBeforeArrivalCanReleaseWithoutCleaning() {
        reservation.setStatus("cancelled");
        reservation.setCancelledAt(reservation.getCheckIn().minusDays(1).atStartOfDay());
        assertThat(policy.eligible(reservation)).isTrue();
    }
    @Test void cancellationAfterOccupancyNeverBypassesTheInspection() {
        when(interventions.findByReservationId(9L,7L)).thenReturn(List.of());
        reservation.setStatus("cancelled");
        reservation.setCancelledAt(reservation.getCheckOut().atStartOfDay());
        assertThat(policy.eligible(reservation)).isFalse();
        verifyNoInteractions(issues);
    }
}
