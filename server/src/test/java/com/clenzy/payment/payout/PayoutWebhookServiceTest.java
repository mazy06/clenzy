package com.clenzy.payment.payout;

import com.clenzy.model.NotificationKey;
import com.clenzy.model.OwnerPayout;
import com.clenzy.model.OwnerPayout.PayoutStatus;
import com.clenzy.repository.OwnerPayoutRepository;
import com.clenzy.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link PayoutWebhookService}.
 *
 * Les transitions PAID/FAILED utilisent un UPDATE conditionnel (compare-and-set) :
 * 1 ligne modifiee = cet appel a gagne la transition et notifie ; 0 ligne = payout
 * deja PAID (re-livraison at-least-once du webhook) → idempotence ou escalade.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("PayoutWebhookService")
class PayoutWebhookServiceTest {

    @Mock private OwnerPayoutRepository payoutRepository;
    @Mock private PayoutNotifier notifier;
    @Mock private NotificationService notificationService;

    private PayoutWebhookService service;

    @BeforeEach
    void setUp() {
        service = new PayoutWebhookService(payoutRepository, notifier, notificationService);
    }

    private OwnerPayout payout(Long id, Long orgId, PayoutStatus status) {
        OwnerPayout p = new OwnerPayout();
        p.setId(id);
        p.setOrganizationId(orgId);
        p.setStatus(status);
        p.setPaymentReference("WISE:123");
        return p;
    }

    @Nested
    @DisplayName("markPaid")
    class MarkPaid {

        @Test
        void whenTransitionWins_thenNotifiesSuccessWithReloadedPayout() {
            OwnerPayout stale = payout(10L, 1L, PayoutStatus.PROCESSING);
            OwnerPayout fresh = payout(10L, 1L, PayoutStatus.PAID);
            when(payoutRepository.markPaidIfNotAlreadyPaid(eq(10L), eq(PayoutStatus.PAID), any(Instant.class)))
                .thenReturn(1);
            when(payoutRepository.findById(10L)).thenReturn(Optional.of(fresh));

            service.markPaid(stale, "Wise", "123");

            verify(notifier).notifySuccess(fresh);
        }

        @Test
        void whenAlreadyPaid_thenNoNotification() {
            OwnerPayout already = payout(10L, 1L, PayoutStatus.PAID);
            when(payoutRepository.markPaidIfNotAlreadyPaid(eq(10L), eq(PayoutStatus.PAID), any(Instant.class)))
                .thenReturn(0);

            service.markPaid(already, "Wise", "123");

            verify(notifier, never()).notifySuccess(any());
            verify(payoutRepository, never()).save(any());
        }
    }

    @Nested
    @DisplayName("markFailed")
    class MarkFailed {

        @Test
        void whenTransitionWins_thenNotifiesFailure() {
            OwnerPayout stale = payout(10L, 1L, PayoutStatus.PROCESSING);
            OwnerPayout fresh = payout(10L, 1L, PayoutStatus.FAILED);
            when(payoutRepository.markFailedIfNotPaid(10L, PayoutStatus.FAILED, "raison", PayoutStatus.PAID))
                .thenReturn(1);
            when(payoutRepository.findById(10L)).thenReturn(Optional.of(fresh));

            service.markFailed(stale, "raison", "Titre revert", "Message revert");

            verify(notifier).notifyFailure(fresh, "raison");
            verify(notificationService, never()).notifyAdminsAndManagersByOrgId(
                any(), any(), anyString(), anyString(), anyString());
        }

        @Test
        void whenAlreadyPaid_thenEscalatesToAdminsWithoutOverwrite() {
            OwnerPayout paid = payout(10L, 42L, PayoutStatus.PAID);
            when(payoutRepository.markFailedIfNotPaid(10L, PayoutStatus.FAILED, "raison", PayoutStatus.PAID))
                .thenReturn(0);

            service.markFailed(paid, "raison", "Titre revert", "Message revert");

            verify(notifier, never()).notifyFailure(any(), anyString());
            verify(notificationService).notifyAdminsAndManagersByOrgId(
                eq(42L), eq(NotificationKey.PAYOUT_FAILED),
                eq("Titre revert"), eq("Message revert"), eq("/billing"));
            assertThat(paid.getStatus()).isEqualTo(PayoutStatus.PAID);
        }
    }

    @Test
    void findByPaymentReference_delegatesToRepository() {
        OwnerPayout p = payout(10L, 1L, PayoutStatus.PROCESSING);
        when(payoutRepository.findFirstByPaymentReference("WISE:123")).thenReturn(Optional.of(p));

        assertThat(service.findByPaymentReference("WISE:123")).contains(p);
    }
}
