package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.TeamRepository;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class QuoteDiscussionScopeTest {
    private final TeamRepository teams = mock(TeamRepository.class);
    private final com.clenzy.marketplace.repository.MarketplaceQuoteRequestRepository requests =
            mock(com.clenzy.marketplace.repository.MarketplaceQuoteRequestRepository.class);
    private final QuoteDiscussionScope scope = new QuoteDiscussionScope(teams, requests);

    private ServiceQuote quote(long authorId) {
        ServiceQuote quote = new ServiceQuote();
        quote.setProviderUserId(authorId);
        return quote;
    }

    @Test
    void publicationCannotRedirectAQuoteToAnotherOrganizationsRequest() {
        ServiceQuote quote = quote(1L); quote.setMarketplaceRequestId(90L);
        quote.setOrganizationId(7L); quote.setInterventionId(500L);
        var request = new com.clenzy.marketplace.model.MarketplaceQuoteRequest();
        request.setRequesterOrganizationId(99L); request.setInterventionId(500L);
        when(requests.findForDiscussion(90L)).thenReturn(java.util.Optional.of(request));
        assertThatThrownBy(() -> scope.lockPublication(quote))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
    }

    @Test
    void marketplaceQuoteKeepsTheOriginalThreadAfterMissionCreation() {
        ServiceQuote quote = quote(1L);
        quote.setMarketplaceRequestId(90L);
        quote.setInterventionId(500L);
        assertThat(QuoteDiscussionScope.referenceType(quote)).isEqualTo("MARKETPLACE_QUOTE");
        assertThat(QuoteDiscussionScope.referenceId(quote)).isEqualTo(90L);
    }

    @Test
    void joiningATeamDoesNotChangeAnIndividualNegotiation() {
        ServiceQuote quote = quote(1L); quote.setMarketplaceRequestId(90L);
        User author = new User(); author.setId(1L);
        Team team = new Team(); team.setId(42L);
        when(teams.findRealTeamsForMember(1L)).thenReturn(List.of(team));
        scope.resolve(quote, new Intervention(), author);
        assertThat(quote.getProviderTeamId()).isNull();
    }

    @Test
    void teammatesShareTheSameDiscussionScope() {
        Team team = new Team();
        team.setId(42L);
        User first = new User(); first.setId(1L);
        User second = new User(); second.setId(2L);
        when(teams.findRealTeamsForMember(1L)).thenReturn(List.of(team));
        when(teams.findRealTeamsForMember(2L)).thenReturn(List.of(team));
        ServiceQuote a = quote(1L), b = quote(2L);
        scope.resolve(a, new Intervention(), first);
        scope.resolve(b, new Intervention(), second);
        assertThat(QuoteDiscussionScope.referenceType(a)).isEqualTo(QuoteDiscussionScope.referenceType(b));
    }

    @Test
    void differentTeamsAndIndependentProvidersHaveSeparateScopes() {
        ServiceQuote a = quote(1L), b = quote(2L);
        a.setProviderTeamId(10L); b.setProviderTeamId(20L);
        assertThat(QuoteDiscussionScope.referenceType(a)).isNotEqualTo(QuoteDiscussionScope.referenceType(b));
        assertThat(QuoteDiscussionScope.referenceType(quote(1L)))
                .isNotEqualTo(QuoteDiscussionScope.referenceType(quote(2L)));
    }

    @Test
    void anAuthorCannotClaimAnotherTeam() {
        User author = new User(); author.setId(1L);
        when(teams.findRealTeamsForMember(1L)).thenReturn(List.of());
        ServiceQuote quote = quote(1L); quote.setProviderTeamId(42L);
        assertThatThrownBy(() -> scope.resolve(quote, new Intervention(), author))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
    }

    @Test
    void membershipInSeveralTeamsDoesNotShareWithAnArbitraryTeam() {
        User author = new User(); author.setId(1L);
        Team a = new Team(); a.setId(10L);
        Team b = new Team(); b.setId(20L);
        when(teams.findRealTeamsForMember(1L)).thenReturn(List.of(a, b));
        ServiceQuote quote = quote(1L);
        scope.resolve(quote, new Intervention(), author);
        assertThat(quote.getProviderTeamId()).isNull();
    }
}
