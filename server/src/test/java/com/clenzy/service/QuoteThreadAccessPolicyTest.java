package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class QuoteThreadAccessPolicyTest {
    private final InterventionRepository interventions = mock(InterventionRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final ContactThreadParticipantRepository participants = mock(ContactThreadParticipantRepository.class);
    private final QuoteDiscussionScope scope = mock(QuoteDiscussionScope.class);
    private final com.clenzy.marketplace.repository.MarketplaceQuoteRequestRepository marketplaceRequests = mock(com.clenzy.marketplace.repository.MarketplaceQuoteRequestRepository.class);
    private final QuoteThreadAccessPolicy policy = new QuoteThreadAccessPolicy(interventions, users, participants, scope,
            marketplaceRequests, mock(com.clenzy.marketplace.repository.MarketplaceProviderRepository.class), mock(PropertyRepository.class));
    private final ContactThread thread = mock(ContactThread.class);
    private User a;
    private User b;

    @BeforeEach
    void setUp() {
        when(thread.getReferenceId()).thenReturn(5L);
        when(thread.getOrganizationId()).thenReturn(7L);
        Intervention intervention = new Intervention(); intervention.setOrganizationId(7L);
        when(interventions.findById(5L)).thenReturn(Optional.of(intervention));
        a = user(1L, "a"); b = user(2L, "b");
    }

    private User user(long id, String key) {
        User user = new User(); user.setId(id); user.setKeycloakId(key);
        user.setRole(UserRole.TECHNICIAN);
        when(users.findByKeycloakId(key)).thenReturn(Optional.of(user));
        return user;
    }

    @Test
    void marketplaceRequestIsSharedOnlyWithItsSnapshotTeam() {
        when(thread.getReferenceType()).thenReturn("MARKETPLACE_QUOTE");
        var request = new com.clenzy.marketplace.model.MarketplaceQuoteRequest();
        request.setRequesterOrganizationId(7L); request.setProviderTeamId(42L);
        when(marketplaceRequests.findById(5L)).thenReturn(Optional.of(request));
        when(scope.teamsOf(a)).thenReturn(Set.of(42L));
        when(scope.teamsOf(b)).thenReturn(Set.of(99L));
        assertThat(policy.canAccess(thread, "a")).isTrue();
        assertThat(policy.canAccess(thread, "b")).isFalse();
        when(scope.teamsOf(a)).thenReturn(Set.of());
        assertThat(policy.canAccess(thread, "a")).isFalse();
    }

    @Test
    void membersOfTheSameTeamCanReadItsThread() {
        when(thread.getReferenceType()).thenReturn("SERVICE_QUOTE_TEAM_42");
        when(scope.teamsOf(a)).thenReturn(Set.of(42L));
        when(scope.teamsOf(b)).thenReturn(Set.of(42L));
        assertThat(policy.canAccess(thread, "a")).isTrue();
        assertThat(policy.canAccess(thread, "b")).isTrue();
    }

    @Test
    void anotherTeamCannotReadEvenIfPreviouslyAddedAsParticipant() {
        when(thread.getReferenceType()).thenReturn("SERVICE_QUOTE_TEAM_42");
        when(scope.teamsOf(b)).thenReturn(Set.of(99L));
        assertThat(policy.canAccess(thread, "b")).isFalse();
    }

    @Test
    void leavingTheTeamRevokesAccess() {
        when(thread.getReferenceType()).thenReturn("SERVICE_QUOTE_TEAM_42");
        when(scope.teamsOf(a)).thenReturn(Set.of());
        assertThat(policy.canAccess(thread, "a")).isFalse();
    }

    @Test
    void independentNegotiationsRemainPrivate() {
        when(thread.getReferenceType()).thenReturn("SERVICE_QUOTE_USER_1");
        assertThat(policy.canAccess(thread, "a")).isTrue();
        assertThat(policy.canAccess(thread, "b")).isFalse();
    }

    @Test
    void mixedLegacyThreadsAreNoLongerExposedToCompetingProviders() {
        when(thread.getReferenceType()).thenReturn(QuoteDiscussionScope.LEGACY);
        ContactThreadParticipant pa = new ContactThreadParticipant(); pa.setKeycloakId("a");
        ContactThreadParticipant pb = new ContactThreadParticipant(); pb.setKeycloakId("b");
        when(participants.findByThreadId(thread.getId())).thenReturn(List.of(pa, pb));
        when(scope.teamsOf(a)).thenReturn(Set.of(42L));
        when(scope.teamsOf(b)).thenReturn(Set.of(99L));
        assertThat(policy.canAccess(thread, "a")).isFalse();
        assertThat(policy.canAccess(thread, "b")).isFalse();
    }
}
