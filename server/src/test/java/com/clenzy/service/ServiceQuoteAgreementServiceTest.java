package com.clenzy.service;

import com.clenzy.model.ServiceQuote;
import com.clenzy.model.ServiceQuoteAmendment;
import com.clenzy.repository.ServiceQuoteAmendmentRepository;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class ServiceQuoteAgreementServiceTest {
    private ServiceQuote quote() {
        var quote = new ServiceQuote(); quote.setId(1L); quote.setOrganizationId(7L);
        quote.setInterventionId(2L); quote.setCurrency("MAD");
        quote.setAmount(new BigDecimal("120")); quote.setStatus(ServiceQuote.Status.APPROVED);
        return quote;
    }

    @Test void initialPriceIsUsedWhenNoAmendmentHasBeenAccepted() {
        var repo = mock(ServiceQuoteAmendmentRepository.class);
        var result = new ServiceQuoteAgreementService(repo).current(quote());
        assertThat(result.originalAmount()).isEqualByComparingTo("120");
        assertThat(result.agreedAmount()).isEqualByComparingTo("120");
        assertThat(result.amendmentId()).isNull();
        verify(repo).findFirstByQuoteIdAndOrganizationIdAndStatusOrderByDecidedAtDescIdDesc(1L, 7L, ServiceQuoteAmendment.Status.ACCEPTED);
    }

    @Test void latestAcceptedPriceDoesNotRewriteOriginalQuote() {
        var repo = mock(ServiceQuoteAmendmentRepository.class);
        var amendment = mock(ServiceQuoteAmendment.class);
        when(amendment.getId()).thenReturn(8L);
        when(amendment.getInterventionId()).thenReturn(2L);
        when(amendment.getCurrency()).thenReturn("MAD");
        when(amendment.getProposedAmount()).thenReturn(new BigDecimal("150"));
        when(repo.findFirstByQuoteIdAndOrganizationIdAndStatusOrderByDecidedAtDescIdDesc(1L, 7L,
                ServiceQuoteAmendment.Status.ACCEPTED)).thenReturn(Optional.of(amendment));
        var quote = quote();
        var result = new ServiceQuoteAgreementService(repo).current(quote);
        assertThat(result.originalAmount()).isEqualByComparingTo("120");
        assertThat(result.agreedAmount()).isEqualByComparingTo("150");
        assertThat(result.amendmentId()).isEqualTo(8L);
        assertThat(quote.getAmount()).isEqualByComparingTo("120");
        when(amendment.getCurrency()).thenReturn("EUR");
        assertThatThrownBy(() -> new ServiceQuoteAgreementService(repo).current(quote))
                .hasMessageContaining("ne correspond pas");
    }

    @Test void unapprovedQuoteIsNotAnAgreement() {
        var quote = quote(); quote.setStatus(ServiceQuote.Status.REJECTED);
        var repo = mock(ServiceQuoteAmendmentRepository.class);
        assertThatThrownBy(() -> new ServiceQuoteAgreementService(repo).current(quote)).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(repo);
    }
}
