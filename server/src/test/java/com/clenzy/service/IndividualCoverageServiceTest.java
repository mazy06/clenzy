package com.clenzy.service;

import com.clenzy.marketplace.model.MarketplaceProviderZone;
import com.clenzy.marketplace.repository.MarketplaceProviderZoneRepository;
import com.clenzy.model.User;
import com.clenzy.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import java.util.List;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class IndividualCoverageServiceTest {
    final MarketplaceProviderZoneRepository zones = mock(MarketplaceProviderZoneRepository.class);
    final UserRepository users = mock(UserRepository.class);
    final PersonalTeamService teams = mock(PersonalTeamService.class);
    final IndividualCoverageService service = new IndividualCoverageService(zones, users, teams);
    void authenticate() {
        User user = new User(); user.setId(7L);
        when(users.findByKeycloakId("self")).thenReturn(Optional.of(user));
    }
    @Test void unknownIdentityCannotReadOrReplaceZones() {
        assertThatThrownBy(() -> service.getMine("other")).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> service.replace("other", List.of())).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(zones, teams);
    }
    @Test void readsZonesWithoutCreatingAnOrganizationCopy() {
        authenticate(); service.getMine("self");
        verify(zones).findByUserIdOrderByIdAsc(7L); verifyNoInteractions(teams);
    }
    @Test void rejectsIncompleteGeographyBeforeDeletingAnything() {
        assertThatThrownBy(() -> service.replace("self", List.of(new IndividualCoverageService.Input("FR",null,null,"Paris"))))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.replace("self", List.of(new IndividualCoverageService.Input("MA",null,null,null))))
            .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(zones, teams);
    }
    @Test void replacesOnlyAuthenticatedUsersZonesUnderTheSharedLock() {
        authenticate(); service.replace("self", List.of(new IndividualCoverageService.Input(" fr ","75","75001",null)));
        var order = inOrder(zones);
        order.verify(zones).lockIndividual(7L);
        order.verify(zones).initializeIndividual(7L);
        order.verify(zones).deleteIndividualZones(7L);
        var saved = org.mockito.ArgumentCaptor.forClass(MarketplaceProviderZone.class);
        order.verify(zones).save(saved.capture());
        assertThat(saved.getValue().getUserId()).isEqualTo(7L);
        assertThat(saved.getValue().getProvider()).isNull();
        assertThat(saved.getValue().getCountryCode()).isEqualTo("FR");
        assertThat(saved.getValue().getArrondissement()).isEqualTo("75001");
    }
}
