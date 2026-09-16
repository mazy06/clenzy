package com.clenzy.service;

import com.clenzy.model.*;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class ServiceQuoteAmendmentDiscussionTest {
    @Test void cancellationOnlyNotifiesTheContractedTeamThread() {
        var threads = mock(ContactThreadService.class);
        var quote = new ServiceQuote(); quote.setId(1L); quote.setOrganizationId(7L);
        quote.setInterventionId(2L); quote.setProviderTeamId(8L);
        var cancellation = new ServiceQuoteCancellation(quote, "manager", "Remplacement", Instant.EPOCH, BigDecimal.TEN, "EUR");
        var thread = new ContactThread();
        when(threads.findByReference(7L, "SERVICE_QUOTE_TEAM_8", 2L)).thenReturn(Optional.of(thread));
        new ServiceQuoteAmendmentDiscussion(threads).cancelled(quote, cancellation, "manager");
        verify(threads).post(eq(thread), eq("manager"), eq("Mission annulée pour le devis #1"),
                argThat(body -> body.contains("Remplacement") && body.contains("nouvelle acceptation")), eq(ContactMessagePriority.MEDIUM));
        verify(threads).findByReference(7L, "SERVICE_QUOTE_TEAM_8", 2L);
        verifyNoMoreInteractions(threads);
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.EnumSource(value = ServiceQuoteAmendment.Status.class, names = {"PROPOSED", "REJECTED", "WITHDRAWN"})
    void proposalAndClosureUseTheExactQuoteThread(ServiceQuoteAmendment.Status status) {
        var threads = mock(ContactThreadService.class);
        var quote = new ServiceQuote(); quote.setId(1L); quote.setOrganizationId(7L); quote.setInterventionId(2L);
        String referenceType;
        long referenceId;
        if (status == ServiceQuoteAmendment.Status.PROPOSED) {
            quote.setProviderTeamId(8L); referenceType = "SERVICE_QUOTE_TEAM_8"; referenceId = 2L;
        } else if (status == ServiceQuoteAmendment.Status.REJECTED) {
            quote.setMarketplaceRequestId(9L); referenceType = "MARKETPLACE_QUOTE"; referenceId = 9L;
        } else {
            quote.setProviderUserId(3L); referenceType = "SERVICE_QUOTE_USER_3"; referenceId = 2L;
        }
        var amendment = mock(ServiceQuoteAmendment.class);
        when(amendment.getStatus()).thenReturn(status);
        when(amendment.getId()).thenReturn(4L);
        when(amendment.getProposedAmount()).thenReturn(new BigDecimal("150"));
        when(amendment.getCurrency()).thenReturn("EUR");
        when(amendment.getReason()).thenReturn("Travaux");
        var thread = new ContactThread();
        when(threads.findByReference(7L, referenceType, referenceId)).thenReturn(Optional.of(thread));
        var service = new ServiceQuoteAmendmentDiscussion(threads);
        if (status == ServiceQuoteAmendment.Status.PROPOSED) {
            when(amendment.getOriginalAmount()).thenReturn(new BigDecimal("120"));
            when(amendment.getCreatedAt()).thenReturn(Instant.EPOCH);
            service.proposed(quote, amendment, "actor");
        } else {
            when(amendment.getDecidedAt()).thenReturn(Instant.EPOCH);
            service.closed(quote, amendment, "actor");
        }
        String decision = status == ServiceQuoteAmendment.Status.PROPOSED ? "proposé" : status == ServiceQuoteAmendment.Status.REJECTED ? "refusé" : "retiré";
        verify(threads).post(eq(thread), eq("actor"), eq("Avenant " + decision + " au devis #1"),
                argThat(body -> body.contains("Avenant #4") && body.contains("150 EUR") && body.contains("Travaux")
                        && body.contains(Instant.EPOCH.toString()) && body.contains("accord courant")),
                eq(ContactMessagePriority.MEDIUM));
        verify(threads).findByReference(7L, referenceType, referenceId);
        verifyNoMoreInteractions(threads);
    }

    @Test void unsupportedClosureCannotPublishAMessage() {
        var threads = mock(ContactThreadService.class);
        var amendment = mock(ServiceQuoteAmendment.class);
        when(amendment.getStatus()).thenReturn(ServiceQuoteAmendment.Status.ACCEPTED);
        assertThatThrownBy(() -> new ServiceQuoteAmendmentDiscussion(threads).closed(new ServiceQuote(), amendment, "actor"))
                .hasMessageContaining("refus ou un retrait");
        verifyNoInteractions(threads);
    }

    @Test void usesExactProviderTeamThreadAndPreservesDecisionAmounts() {
        var threads = mock(ContactThreadService.class);
        var quote = new ServiceQuote(); quote.setId(1L); quote.setOrganizationId(7L);
        quote.setInterventionId(2L); quote.setProviderTeamId(8L);
        var proposal = mock(ServiceQuoteAmendment.class);
        when(proposal.getId()).thenReturn(3L);
        when(proposal.getOriginalAmount()).thenReturn(new BigDecimal("120"));
        when(proposal.getProposedAmount()).thenReturn(new BigDecimal("150"));
        when(proposal.getCurrency()).thenReturn("EUR");
        when(proposal.getReason()).thenReturn("Travaux");
        when(proposal.getDecidedAt()).thenReturn(Instant.EPOCH);
        var thread = new ContactThread();
        when(threads.findByReference(7L, "SERVICE_QUOTE_TEAM_8", 2L)).thenReturn(Optional.of(thread));
        new ServiceQuoteAmendmentDiscussion(threads).accepted(quote, proposal, "customer");
        verify(threads).post(eq(thread), eq("customer"), eq("Avenant accepté au devis #1"),
                argThat(body -> body.contains("120 EUR") && body.contains("150 EUR") && body.contains("Travaux")),
                eq(ContactMessagePriority.MEDIUM));
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.EnumSource(value = ServiceQuoteAmendment.Status.class, names = {"PROPOSED", "ACCEPTED", "REJECTED", "WITHDRAWN"})
    void missingMarketplaceThreadFailsWithoutOpeningAnotherThread(ServiceQuoteAmendment.Status status) {
        var threads = mock(ContactThreadService.class);
        var quote = new ServiceQuote(); quote.setOrganizationId(7L); quote.setMarketplaceRequestId(9L);
        var amendment = mock(ServiceQuoteAmendment.class);
        when(amendment.getStatus()).thenReturn(status);
        when(amendment.getOriginalAmount()).thenReturn(new BigDecimal("120"));
        when(amendment.getProposedAmount()).thenReturn(new BigDecimal("150"));
        var service = new ServiceQuoteAmendmentDiscussion(threads);
        assertThatThrownBy(() -> {
            if (status == ServiceQuoteAmendment.Status.PROPOSED) service.proposed(quote, amendment, "actor");
            else if (status == ServiceQuoteAmendment.Status.ACCEPTED) service.accepted(quote, amendment, "actor");
            else service.closed(quote, amendment, "actor");
        }).hasMessageContaining("fil du devis");
        verify(threads).findByReference(7L, "MARKETPLACE_QUOTE", 9L);
        verifyNoMoreInteractions(threads);
    }
}
