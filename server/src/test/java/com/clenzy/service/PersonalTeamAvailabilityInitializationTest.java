package com.clenzy.service;

import com.clenzy.model.Team;
import com.clenzy.model.User;
import com.clenzy.repository.*;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.*;
import java.util.Optional;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

class PersonalTeamAvailabilityInitializationTest {
    final TeamRepository teams = mock(TeamRepository.class);
    final UserRepository users = mock(UserRepository.class);
    final TenantContext tenant = new TenantContext();
    PersonalTeamService service;
    @BeforeEach void setup() {
        tenant.setOrganizationId(7L);
        service = new PersonalTeamService(teams, users, tenant);
    }
    @AfterEach void clear() { tenant.clear(); }
    @Test void creatingAPersonalTeamDoesNotCopyCalendarData() {
        User user = new User(); user.setId(11L); user.setFirstName("Test");
        when(users.findById(11L)).thenReturn(Optional.of(user));
        when(teams.save(any())).thenAnswer(call -> { Team team = call.getArgument(0); team.setId(9L); return team; });
        assertThat(service.getOrCreate(11L).getId()).isEqualTo(9L);
        verify(teams).findByPersonalUserId(11L, 7L);
        verify(teams).save(any());
        verifyNoMoreInteractions(teams);
    }
    @Test void anExistingTeamDoesNotAffectTheCalendar() {
        Team existing = new Team(); existing.setId(9L);
        when(teams.findByPersonalUserId(11L, 7L)).thenReturn(Optional.of(existing));
        assertThat(service.getOrCreate(11L)).isSameAs(existing);
        verify(teams).findByPersonalUserId(11L, 7L);
        verifyNoMoreInteractions(teams);
        verifyNoInteractions(users);
    }
}
