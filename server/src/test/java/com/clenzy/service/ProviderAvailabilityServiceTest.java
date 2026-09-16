package com.clenzy.service;

import com.clenzy.repository.TeamAbsenceRepository;
import com.clenzy.repository.TeamWeeklyAvailabilityRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.Test;
import java.time.LocalDate;
import java.time.LocalDateTime;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class ProviderAvailabilityServiceTest {
    final TeamAbsenceRepository absences = mock(TeamAbsenceRepository.class);
    final TeamWeeklyAvailabilityRepository weekly = mock(TeamWeeklyAvailabilityRepository.class);
    final com.clenzy.repository.ServiceRequestRepository assignments = mock(com.clenzy.repository.ServiceRequestRepository.class);
    final TenantContext tenant = new TenantContext();
    final ProviderAvailabilityService service = new ProviderAvailabilityService(weekly, absences, tenant, assignments);
    final LocalDate monday = LocalDate.of(2026, 9, 14);

    @org.junit.jupiter.api.AfterEach void clearTenantContext() { tenant.clear(); }

    @Test void weeklyReplacementLocksBeforeDeletingOrSaving() {
        tenant.setOrganizationId(1L);
        var slot = new ProviderAvailabilityService.WeeklySlotInput((short) 1,
                java.time.LocalTime.of(9, 0), java.time.LocalTime.of(17, 0));
        service.replaceWeekly(7L, java.util.List.of(slot));
        var order = inOrder(assignments, weekly);
        order.verify(assignments).lockTeamAvailability(7L);
        order.verify(weekly).deleteByTeamIdAndOrganizationId(7L, 1L);
        order.verify(weekly).save(any());
    }

    @Test void absenceCreationLocksBeforeSaving() {
        tenant.setOrganizationId(1L);
        when(absences.save(any())).thenAnswer(call -> call.getArgument(0));
        service.addAbsence(7L, monday, monday.plusDays(1), "Privé");
        var order = inOrder(assignments, absences);
        order.verify(assignments).lockTeamAvailability(7L);
        order.verify(absences).save(any());
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(booleans = {false, true})
    void absenceIsSavedAndReportsExistingAssignmentsWithoutChangingThem(boolean conflict) {
        tenant.setOrganizationId(1L);
        when(absences.save(any())).thenAnswer(call -> call.getArgument(0));
        when(assignments.previewAssignmentConflicts(null, null, "team", 7L, monday.atStartOfDay(), 48))
                .thenReturn(conflict);
        var saved = service.addAbsence(7L, monday, monday.plusDays(1), "Privé");
        assertThat(saved.isAssignmentConflict()).isEqualTo(conflict);
        verify(absences).save(saved);
        verify(assignments).lockTeamAvailability(7L);
        verify(assignments).previewAssignmentConflicts(null, null, "team", 7L, monday.atStartOfDay(), 48);
        verifyNoMoreInteractions(assignments);
    }

    @Test void absenceConflictIsRecalculatedWhenAssignmentsChange() {
        var absence = new com.clenzy.model.TeamAbsence(7L, monday, monday, "Privé");
        when(absences.findByTeamIdOrderByStartDateAsc(7L)).thenReturn(java.util.List.of(absence));
        when(assignments.previewAssignmentConflicts(null, null, "team", 7L, monday.atStartOfDay(), 24))
                .thenReturn(true, false);
        assertThat(service.getAbsences(7L).getFirst().isAssignmentConflict()).isTrue();
        assertThat(service.getAbsences(7L).getFirst().isAssignmentConflict()).isFalse();
        verify(assignments, never()).lockTeamAvailability(any());
        verify(absences, never()).save(any());
    }

    @Test void absenceRemovalLocksBeforeReadingAndDeleting() {
        var absence = new com.clenzy.model.TeamAbsence(7L, monday, monday, "Privé");
        when(absences.findById(9L)).thenReturn(java.util.Optional.of(absence));
        service.removeAbsence(7L, 9L);
        var order = inOrder(assignments, absences);
        order.verify(assignments).lockTeamAvailability(7L);
        order.verify(absences).findById(9L);
        order.verify(absences).delete(absence);
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(booleans = {false, true})
    void availabilityUsesOnlyTheDatabaseVerdict(boolean available) {
        var start = monday.atTime(22, 0); var end = monday.plusDays(2).atTime(2, 0);
        when(weekly.isDeclaredAvailable(7L, start, end)).thenReturn(available);
        assertThat(service.isAvailable(7L, start, end)).isEqualTo(available);
        verify(weekly).isDeclaredAvailable(7L, start, end);
        verifyNoMoreInteractions(weekly);
        verifyNoInteractions(absences);
    }

    @Test void aDatabaseFailureNeverBecomesAnAvailableResult() {
        var start = monday.atTime(9, 0); var end = monday.atTime(10, 0);
        when(weekly.isDeclaredAvailable(7L, start, end)).thenThrow(new IllegalStateException("Unavailable"));
        assertThatThrownBy(() -> service.isAvailable(7L, start, end)).isInstanceOf(IllegalStateException.class);
    }

    @Test void invalidIntervalsAreRejectedBeforeReadingAvailability() {
        LocalDateTime start = monday.atTime(9, 0);
        assertThatThrownBy(() -> service.isAvailable(7L, null, start)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.isAvailable(7L, start, null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.isAvailable(7L, start, start)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.isAvailable(7L, start, start.minusHours(1))).isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(absences, weekly);
    }
}
