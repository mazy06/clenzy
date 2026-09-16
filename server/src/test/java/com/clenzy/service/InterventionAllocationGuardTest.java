package com.clenzy.service;

import com.clenzy.exception.AssignmentConflictException;
import com.clenzy.model.*;
import com.clenzy.repository.ServiceRequestRepository;
import org.junit.jupiter.api.Test;
import java.time.LocalDateTime;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class InterventionAllocationGuardTest {
    final ServiceRequestRepository requests = mock(ServiceRequestRepository.class);
    final ProviderAvailabilityService availability = mock(ProviderAvailabilityService.class);
    final com.clenzy.marketplace.service.ProviderDocumentaryService documentary = mock(com.clenzy.marketplace.service.ProviderDocumentaryService.class);
    final InterventionAllocationGuard guard = new InterventionAllocationGuard(requests, availability, org.mockito.Mockito.mock(com.clenzy.service.ProviderPropertyEligibility.class), documentary);

    private Intervention mission() {
        var mission = new Intervention(); mission.setId(12L); mission.setStatus(InterventionStatus.PENDING);
        mission.setScheduledDate(LocalDateTime.of(2026, 9, 15, 9, 0)); mission.setEstimatedDurationHours(3);
        return mission;
    }

    @Test
    void checksUserAndExcludesOnlyTheCurrentMissionAndItsSourceRequest() {
        var mission = mission(); var user = new User(); user.setId(9L); mission.setAssignedUser(user);
        var source = new ServiceRequest(); source.setId(11L); mission.setServiceRequest(source);
        when(requests.interventionAssignmentConflicts(11L, 12L, "user", 9L, mission.getScheduledDate(), 3)).thenReturn(true);
        assertThatThrownBy(() -> guard.requireAvailable(mission)).isInstanceOf(AssignmentConflictException.class);
    }

    @Test
    void checksTeamForAnIndependentMission() {
        var mission = mission(); mission.setTeamId(7L);
        when(availability.isAvailable(7L, mission.getScheduledDate(), mission.getScheduledDate().plusHours(3))).thenReturn(true);
        guard.requireAvailable(mission);
        verify(requests).interventionAssignmentConflicts(null, 12L, "team", 7L, mission.getScheduledDate(), 3);
    }

    @Test
    void releasingTheSlotDoesNotRequireItToBeAvailable() {
        var mission = mission(); mission.setTeamId(7L);
        for (var status : new InterventionStatus[]{InterventionStatus.CANCELLED, InterventionStatus.COMPLETED}) {
            mission.setStatus(status); guard.requireAvailable(mission);
        }
        verifyNoInteractions(requests, availability);
    }

    @Test
    void unassignedMissionDoesNotReserveAResource() {
        guard.requireAvailable(mission());
        verifyNoInteractions(requests, availability);
    }

    @Test
    void absentTeamCannotBeAllocatedEvenWithoutAnotherReservation() {
        var mission = mission(); mission.setTeamId(7L);
        assertThatThrownBy(() -> guard.requireAvailable(mission))
                .isInstanceOf(AssignmentConflictException.class).hasMessageContaining("indisponible");
        var order = inOrder(requests, availability);
        order.verify(requests).interventionAssignmentConflicts(null, 12L, "team", 7L, mission.getScheduledDate(), 3);
        order.verify(availability).isAvailable(7L, mission.getScheduledDate(), mission.getScheduledDate().plusHours(3));
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.NullSource
    @org.junit.jupiter.params.provider.ValueSource(ints = {0, -1})
    void missingOrInvalidDurationUsesTheSameFourHoursAsReservations(Integer duration) {
        var mission = mission(); mission.setTeamId(7L); mission.setEstimatedDurationHours(duration);
        when(availability.isAvailable(7L, mission.getScheduledDate(), mission.getScheduledDate().plusHours(4))).thenReturn(true);
        guard.requireAvailable(mission);
        verify(availability).isAvailable(7L, mission.getScheduledDate(), mission.getScheduledDate().plusHours(4));
    }

    @Test
    void existingReservationStopsBeforeCheckingDeclaredAvailability() {
        var mission = mission(); mission.setTeamId(7L);
        when(requests.interventionAssignmentConflicts(null, 12L, "team", 7L, mission.getScheduledDate(), 3)).thenReturn(true);
        assertThatThrownBy(() -> guard.requireAvailable(mission)).isInstanceOf(AssignmentConflictException.class);
        verifyNoInteractions(availability);
    }

    @Test void individualAssignmentRespectsPersonalAbsences() {
        var mission = mission(); var user = new User(); user.setId(9L); mission.setAssignedUser(user);
        assertThatThrownBy(() -> guard.requireAvailable(mission)).isInstanceOf(AssignmentConflictException.class)
                .hasMessageContaining("indisponible");
        var order = inOrder(requests, availability);
        order.verify(requests).interventionAssignmentConflicts(null, 12L, "user", 9L, mission.getScheduledDate(), 3);
        order.verify(availability).isUserAvailable(9L, mission.getScheduledDate(), mission.getScheduledDate().plusHours(3));
    }
    @Test void requestAssignmentChecksExactServiceBeforeMissionCreation() {
        var request=new ServiceRequest(); request.setServiceType(ServiceType.ELECTRICAL_REPAIR);
        request.setDesiredDate(LocalDateTime.of(2026,9,20,9,0)); request.setProperty(new Property());
        guard.requireDocumentaryAssignment(request,"team",7L);
        var captor=org.mockito.ArgumentCaptor.forClass(Intervention.class);
        verify(documentary).requireAssignment(captor.capture(),isNull());
        assertThat(captor.getValue().getType()).isEqualTo("ELECTRICAL_REPAIR");
        assertThat(captor.getValue().getTeamId()).isEqualTo(7L);
        doThrow(new IllegalStateException("Justificatif expiré")).when(documentary).requireAssignment(any(),isNull());
        assertThatThrownBy(() -> guard.requireDocumentaryAssignment(request,"user",9L))
                .isInstanceOf(AssignmentConflictException.class);
    }

}
