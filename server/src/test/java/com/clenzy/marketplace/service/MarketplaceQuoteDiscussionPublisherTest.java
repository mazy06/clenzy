package com.clenzy.marketplace.service;

import com.clenzy.marketplace.model.*;
import com.clenzy.marketplace.repository.*;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.service.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class MarketplaceQuoteDiscussionPublisherTest {
    final MarketplaceQuoteRequestRepository requests = mock(MarketplaceQuoteRequestRepository.class);
    final MarketplaceProviderRepository providers = mock(MarketplaceProviderRepository.class);
    final UserRepository users = mock(UserRepository.class);
    final ContactThreadService threads = mock(ContactThreadService.class);
    final QuoteDiscussionScope scope = mock(QuoteDiscussionScope.class);
    final MarketplaceQuoteDiscussionPublisher publisher = new MarketplaceQuoteDiscussionPublisher(
            requests, providers, users, mock(PropertyRepository.class), threads, scope, new ObjectMapper());

    MarketplaceQuoteRequest quotedRequest() {
        var request = new MarketplaceQuoteRequest();
        request.setId(8L); request.setProviderId(12L); request.setRequestedByUserId(3L);
        request.setRequesterOrganizationId(7L); request.setTitle("Entretien");
        request.setStatus(QuoteRequestStatus.QUOTED); request.setQuotedAmount(new BigDecimal("120.00"));
        request.setQuotedCurrency("MAD"); request.setProviderTeamId(42L);
        when(requests.findForDiscussion(8L)).thenReturn(Optional.of(request));
        return request;
    }

    void participants() {
        var provider = new MarketplaceProvider(); provider.setUserId(2L); provider.setDisplayName("Atelier");
        when(providers.findById(12L)).thenReturn(Optional.of(provider));
        var pro = new User(); pro.setKeycloakId("pro");
        var customer = new User(); customer.setKeycloakId("customer");
        when(users.findById(2L)).thenReturn(Optional.of(pro));
        when(users.findById(3L)).thenReturn(Optional.of(customer));
        when(scope.members(42L)).thenReturn(Set.of("colleague"));
    }

    @Test
    void quoteCardUsesTheMarketplaceDecisionAndIncludesTheTeam() throws Exception {
        var request = quotedRequest(); participants();
        var thread = new ContactThread();
        when(threads.openThread(any(), any(), any(), any(), any(), any(), any())).thenReturn(thread);
        publisher.publish(8L);
        verify(threads).openThread(eq(7L), eq("Entretien"), any(), eq("customer"),
                eq("MARKETPLACE_QUOTE"), eq(8L), argThat(p -> p.containsAll(Set.of("pro", "customer", "colleague"))));
        var payload = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(threads).post(eq(thread), eq("pro"), isNull(), anyString(), any(), payload.capture());
        var card = new ObjectMapper().readTree(payload.getValue());
        assertThat(card.get("marketplaceRequestId").asLong()).isEqualTo(8L);
        assertThat(card.get("currency").asText()).isEqualTo("MAD");
        assertThat(request.getDiscussionPublishedStatus()).isEqualTo(QuoteRequestStatus.QUOTED);
    }

    @Test
    void alreadyPublishedStatusDoesNotDuplicateTheMessage() throws Exception {
        var request = quotedRequest(); request.setDiscussionPublishedStatus(QuoteRequestStatus.QUOTED);
        publisher.publish(8L);
        verifyNoInteractions(threads, providers);
    }

    @Test
    void failedPublicationRemainsPending() {
        var request = quotedRequest(); participants();
        when(threads.openThread(any(), any(), any(), any(), any(), any(), any()))
                .thenThrow(new IllegalStateException("unavailable"));
        assertThatThrownBy(() -> publisher.publish(8L)).isInstanceOf(IllegalStateException.class);
        assertThat(request.getDiscussionPublishedStatus()).isNull();
        verify(requests, never()).save(any());
    }
}
