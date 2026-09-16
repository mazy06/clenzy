package com.clenzy.service;

import com.clenzy.model.ServiceQuote;
import com.clenzy.repository.ServiceQuoteRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ServiceQuoteDecisionTest {
    @Mock ServiceQuoteRepository quoteRepository;
    @Mock com.clenzy.repository.InterventionRepository interventionRepository;
    @Mock InterventionAllocationGuard allocationGuard;
    @Mock java.time.Clock clock;
    @InjectMocks ServiceQuoteService service;

    private Jwt manager() {
        return Jwt.withTokenValue("test").header("alg", "none").subject("manager")
                .claim("realm_access", Map.of("roles", List.of("SUPER_MANAGER"))).build();
    }

    @Test
    void aConcurrentApprovalPreventsRejectionFromOverwritingTheDecision() {
        ServiceQuote quote = new ServiceQuote();
        quote.setId(1L);
        when(quoteRepository.findByIdAndOrganizationId(1L, 7L)).thenReturn(Optional.of(quote));
        when(quoteRepository.markRejected(1L, 7L)).thenReturn(0);

        assertThatThrownBy(() -> service.reject(1L, 7L, manager()))
                .isInstanceOf(IllegalStateException.class);
        verify(quoteRepository, never()).save(any());
    }

    @Test
    void deletionCannotRemoveAQuoteApprovedSinceItWasRead() {
        ServiceQuote quote = new ServiceQuote();
        quote.setId(1L);
        when(quoteRepository.findByIdAndOrganizationId(1L, 7L)).thenReturn(Optional.of(quote));
        when(quoteRepository.deleteUnapproved(1L, 7L)).thenReturn(0);

        assertThatThrownBy(() -> service.delete(1L, 7L)).isInstanceOf(IllegalStateException.class);
        verify(quoteRepository, never()).delete(any());
    }

    @Test
    void approvalChecksTheQuotedTeamBeforeSavingItsAssignment() {
        var quote = new ServiceQuote();
        quote.setId(1L);
        quote.setInterventionId(4L);
        quote.setProviderTeamId(8L);
        quote.setAmount(new java.math.BigDecimal("120"));
        quote.setCurrency("MAD");
        var mission = new com.clenzy.model.Intervention();
        mission.setId(4L);
        mission.setOrganizationId(7L);
        mission.setStatus(com.clenzy.model.InterventionStatus.PENDING);
        when(quoteRepository.findByIdAndOrganizationId(1L, 7L)).thenReturn(Optional.of(quote));
        when(interventionRepository.findById(4L)).thenReturn(Optional.of(mission));
        when(clock.instant()).thenReturn(java.time.Instant.EPOCH);
        when(quoteRepository.markApproved(1L, 7L, "manager", java.time.Instant.EPOCH)).thenReturn(1);
        doAnswer(invocation -> {
            var assigned = (com.clenzy.model.Intervention) invocation.getArgument(0);
            org.assertj.core.api.Assertions.assertThat(assigned.getTeamId()).isEqualTo(8L);
            org.assertj.core.api.Assertions.assertThat(assigned.getEstimatedCost()).isEqualByComparingTo("120");
            org.assertj.core.api.Assertions.assertThat(assigned.getCurrency()).isEqualTo("MAD");
            throw new com.clenzy.exception.AssignmentConflictException();
        }).when(allocationGuard).requireAvailable(mission);

        assertThatThrownBy(() -> service.approveFromSupervision(1L, 7L, "manager"))
                .isInstanceOf(com.clenzy.exception.AssignmentConflictException.class);
        verify(interventionRepository, never()).save(any());
    }
}
