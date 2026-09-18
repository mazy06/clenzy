package com.clenzy.service;

import com.clenzy.model.User;
import com.clenzy.repository.*;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class MyAvailabilityServiceTest {
    final UserRepository users = mock(UserRepository.class);
    final IndividualCalendarRepository calendars = mock(IndividualCalendarRepository.class);
    final ServiceRequestRepository assignments = mock(ServiceRequestRepository.class);
    final MyAvailabilityService service = new MyAvailabilityService(users, calendars, assignments);

    void authenticate() {
        var user = new User(); user.setId(7L);
        when(users.findByKeycloakId("own-subject")).thenReturn(Optional.of(user));
    }
    @Test void unknownIdentityCannotReadOrWriteAnyCalendar() {
        assertThatThrownBy(() -> service.getMine("unknown")).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> service.removeAbsence("unknown", 1L)).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(calendars, assignments);
    }
    @Test void snapshotUsesOnlyAuthenticatedIdentityAndPreservesBlockedEmptyWeek() {
        authenticate(); when(calendars.restricted(7L)).thenReturn(true);
        var result = service.getMine("own-subject");
        assertThat(result.weekly()).isEmpty(); assertThat(result.weeklyRestricted()).isTrue();
        verify(calendars).weekly(7L); verify(calendars).absences(7L); verify(calendars).restricted(7L);
        verifyNoMoreInteractions(calendars);
    }
    @Test void invalidWeeklySlotCannotEraseExistingCalendar() {
        assertThatThrownBy(() -> service.replaceWeekly("own-subject", List.of(
            new MyAvailabilityService.WeeklySlot((short)1, LocalTime.NOON, LocalTime.of(9,0)))))
            .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(calendars);
    }
    @Test void absenceIsSavedAndConflictReportedWithoutChangingAssignment() {
        authenticate(); LocalDate date = LocalDate.of(2026,9,20);
        when(calendars.addAbsence(7L, date, date, "Congé"))
            .thenReturn(new IndividualCalendarRepository.Absence(1L, date, date, "Congé"));
        when(assignments.previewAssignmentConflicts(null, null, "user", 7L, date.atStartOfDay(), 24)).thenReturn(true);
        assertThat(service.addAbsence("own-subject", date, date, "Congé").assignmentConflict()).isTrue();
        verify(assignments).previewAssignmentConflicts(null, null, "user", 7L, date.atStartOfDay(), 24);
        verifyNoMoreInteractions(assignments);
    }
    @Test void removalAlwaysIncludesTheAuthenticatedOwner() {
        authenticate(); service.removeAbsence("own-subject", 99L);
        verify(calendars).removeAbsence(7L,99L);
    }
}
