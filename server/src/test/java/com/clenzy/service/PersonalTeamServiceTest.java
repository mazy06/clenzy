package com.clenzy.service;

import com.clenzy.model.Team;
import com.clenzy.model.User;
import com.clenzy.repository.TeamRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.Test;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class PersonalTeamServiceTest {
    final TeamRepository teams = mock(TeamRepository.class);
    final UserRepository users = mock(UserRepository.class);
    final TenantContext tenant = new TenantContext();
    final PersonalTeamService service = new PersonalTeamService(teams, users, tenant);

    @Test void switchingClientOrganizationKeepsTheSamePersonalCapabilityProfile() {
        var user = new User(); user.setId(9L);
        var canonical = new Team(); canonical.setId(3L); canonical.setOrganizationId(7L);
        when(users.findByKeycloakId("subject")).thenReturn(Optional.of(user));
        when(teams.findCanonicalPersonalTeam(9L)).thenReturn(Optional.of(canonical));
        tenant.setOrganizationId(12L);
        assertThat(service.findCanonicalByKeycloakId("subject")).contains(canonical);
        assertThat(service.getOrCreateCanonicalByKeycloakId("subject")).isSameAs(canonical);
        verify(teams, never()).save(any());
        verify(teams, never()).registerPersonalCapabilityOwner(any());
    }

    @Test void firstDeclarationUsesTheOwnerChosenAtomicallyByTheDatabase() {
        var user = new User(); user.setId(9L);
        var local = new Team(); local.setId(4L);
        var canonical = new Team(); canonical.setId(3L);
        tenant.setOrganizationId(12L);
        when(users.findByKeycloakId("subject")).thenReturn(Optional.of(user));
        when(teams.findCanonicalPersonalTeam(9L)).thenReturn(Optional.empty(), Optional.of(canonical));
        when(teams.findByPersonalUserId(9L,12L)).thenReturn(Optional.of(local));
        assertThat(service.getOrCreateCanonicalByKeycloakId("subject")).isSameAs(canonical);
        verify(teams).registerPersonalCapabilityOwner(9L);
    }
}
