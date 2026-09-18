package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.ServiceQuoteRepository;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class AutomaticInterventionCancellationPolicyTest {
    @Test void acceptedAgreementCannotBeCancelledByAReservationFeed() {
        var payments = mock(InterventionPaymentCoordination.class);
        var quotes = mock(ServiceQuoteRepository.class);
        var mission = new Intervention(); mission.setId(1L); mission.setOrganizationId(7L); mission.setStatus(InterventionStatus.PENDING);
        when(payments.lockMission(7L, 1L)).thenReturn(mission);
        when(quotes.hasApprovedAgreement(1L, 7L)).thenReturn(true);
        assertThat(new AutomaticInterventionCancellationPolicy(payments, quotes).blocker(mission)).isEqualTo("AGREEMENT_REQUIRES_REASON");
        var order = inOrder(payments, quotes);
        order.verify(payments).lockMission(7L, 1L);
        order.verify(quotes).hasApprovedAgreement(1L, 7L);
        assertThat(mission.getStatus()).isEqualTo(InterventionStatus.PENDING);
    }
    @Test void refreshedStateAndPaymentAreCheckedBeforeAutomaticCancellation() {
        var payments = mock(InterventionPaymentCoordination.class);
        var quotes = mock(ServiceQuoteRepository.class);
        var mission = new Intervention(); mission.setId(1L); mission.setOrganizationId(7L);
        when(payments.lockMission(7L, 1L)).thenReturn(mission);
        var policy = new AutomaticInterventionCancellationPolicy(payments, quotes);
        mission.setStatus(InterventionStatus.COMPLETED);
        assertThat(policy.blocker(mission)).isEqualTo("CLOSED");
        mission.setStatus(InterventionStatus.PENDING);
        when(payments.cancellationNeedsPaymentReview(mission)).thenReturn(true);
        assertThat(policy.blocker(mission)).isEqualTo("PAYMENT_REVIEW_REQUIRED");
        when(payments.cancellationNeedsPaymentReview(mission)).thenReturn(false);
        assertThat(policy.blocker(mission)).isNull();
    }
}
