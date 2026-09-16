package com.clenzy.marketplace.service;

import com.clenzy.marketplace.model.*;
import com.clenzy.marketplace.repository.*;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.*;
import org.springframework.security.oauth2.jwt.Jwt;
import java.time.*;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class MarketplaceReviewServiceTest {
    final MarketplaceQuoteMissionFactory access = mock(MarketplaceQuoteMissionFactory.class);
    final MarketplaceReviewRepository reviews = mock(MarketplaceReviewRepository.class);
    final MarketplaceProviderRepository providers = mock(MarketplaceProviderRepository.class);
    final InterventionRepository interventions = mock(InterventionRepository.class);
    final ProviderAccountResolver accounts = mock(ProviderAccountResolver.class);
    final TeamRepository teams = mock(TeamRepository.class);
    final TenantContext tenant = new TenantContext();
    final Clock clock = Clock.fixed(Instant.parse("2026-09-15T12:00:00Z"), ZoneOffset.UTC);
    final Jwt jwt = Jwt.withTokenValue("test").header("alg", "none").subject("owner").build();
    MarketplaceReviewService service;
    MarketplaceQuoteRequest quote;
    MarketplaceProvider provider;
    Intervention mission;
    @BeforeEach void setup() {
        tenant.setOrganizationId(7L);
        service = new MarketplaceReviewService(access, reviews, providers, interventions, accounts, teams, tenant, clock);
        quote = new MarketplaceQuoteRequest(); quote.setId(9L); quote.setRequesterOrganizationId(7L);
        quote.setProviderId(2L); quote.setStatus(QuoteRequestStatus.ACCEPTED); quote.setInterventionId(5L);
        when(access.lock(9L, 7L)).thenReturn(quote);
        provider = new MarketplaceProvider(); provider.setId(2L); provider.setUserId(12L);
        User pro = new User(); pro.setId(12L);
        mission = new Intervention(); mission.setId(5L); mission.setStatus(InterventionStatus.COMPLETED);
        mission.proposeAssignment(pro, null);
        when(interventions.findForReview(5L, 7L)).thenReturn(Optional.of(mission));
        when(providers.findForRating(2L)).thenReturn(Optional.of(provider));
        when(accounts.userIdOf("owner")).thenReturn(11L);
    }
    @AfterEach void clear() { tenant.clear(); }
    @Test void storesVerifiedReviewAndUpdatesTheAggregatedRating() {
        when(reviews.saveAndFlush(any())).thenAnswer(i -> i.getArgument(0));
        var summary = mock(MarketplaceReviewRepository.RatingSummary.class);
        when(summary.getAverage()).thenReturn(4.25); when(summary.getTotal()).thenReturn(4L);
        when(reviews.summarize(2L)).thenReturn(summary);
        var result = service.submit(9L, 5, "Très bien", jwt);
        assertThat(result.rating()).isEqualTo(5);
        assertThat(provider.getRatingAvg()).isEqualByComparingTo("4.25");
        assertThat(provider.getRatingCount()).isEqualTo(4);
        var order = inOrder(providers, reviews);
        order.verify(providers).findForRating(2L);
        order.verify(reviews).saveAndFlush(any());
        order.verify(reviews).summarize(2L);
    }
    @Test void unfinishedMissionCannotBeRated() {
        mission.setStatus(InterventionStatus.IN_PROGRESS);
        assertThatThrownBy(() -> service.submit(9L, 5, null, jwt)).hasMessageContaining("terminée");
        verify(reviews, never()).saveAndFlush(any());
    }
    @Test void reassignedMissionCannotRateTheOldProvider() {
        User other = new User(); other.setId(55L); mission.proposeAssignment(other, null);
        assertThatThrownBy(() -> service.submit(9L, 5, null, jwt)).hasMessageContaining("attribution");
        verify(reviews, never()).saveAndFlush(any());
    }
    @Test void providerCannotRateTheirOwnWork() {
        when(accounts.userIdOf("owner")).thenReturn(12L);
        assertThatThrownBy(() -> service.submit(9L, 5, null, jwt))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verify(reviews, never()).saveAndFlush(any());
    }
    @Test void anExistingReviewCannotBeOverwrittenButItsRedeliveryIsIdempotent() {
        var review = new MarketplaceReview(9L, 2L, 5L, 7L, 11L, 4, null, LocalDateTime.now(clock));
        when(reviews.findById(9L)).thenReturn(Optional.of(review));
        assertThat(service.submit(9L, 4, null, jwt).rating()).isEqualTo(4);
        assertThatThrownBy(() -> service.submit(9L, 5, null, jwt)).hasMessageContaining("déjà");
        verify(reviews, never()).saveAndFlush(any());
    }
    @Test void permissionsAreCheckedBeforeReadingOrWritingTheReview() {
        doThrow(new org.springframework.security.access.AccessDeniedException("interdit"))
                .when(access).assertCanDecide(quote, 7L, jwt);
        assertThatThrownBy(() -> service.submit(9L, 5, null, jwt)).hasMessage("interdit");
        verifyNoInteractions(reviews);
    }
}
