package com.clenzy.payment.payout.executor;

import com.clenzy.model.OwnerPayout;
import com.clenzy.model.OwnerPayout.PayoutStatus;
import com.clenzy.model.OwnerPayoutConfig;
import com.clenzy.model.PayoutMethod;
import com.clenzy.payment.payout.PayoutExecutor;
import com.clenzy.payment.payout.PayoutNotifier;
import com.clenzy.payment.payout.StripeConnectTransferClient;
import com.clenzy.repository.OwnerPayoutRepository;
import com.stripe.exception.ApiException;
import com.stripe.exception.StripeException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires pour {@link StripeConnectPayoutExecutor}.
 *
 * <p>Le transfert Stripe est encapsulé dans {@link StripeConnectTransferClient}
 * (mocké ici) ; la conversion des montants / params Stripe est testée dans
 * {@code StripeConnectTransferClientTest}.</p>
 */
class StripeConnectPayoutExecutorTest {

    private StripeConnectTransferClient transferClient;
    private OwnerPayoutRepository payoutRepository;
    private PayoutNotifier notifier;
    private StripeConnectPayoutExecutor executor;

    @BeforeEach
    void setUp() {
        transferClient = mock(StripeConnectTransferClient.class);
        payoutRepository = mock(OwnerPayoutRepository.class);
        notifier = mock(PayoutNotifier.class);
        executor = new StripeConnectPayoutExecutor(transferClient, payoutRepository, notifier);

        when(payoutRepository.save(any(OwnerPayout.class)))
                .thenAnswer(inv -> inv.getArgument(0));
    }

    private OwnerPayout payout() {
        OwnerPayout p = new OwnerPayout();
        p.setId(101L);
        p.setOrganizationId(7L);
        p.setOwnerId(11L);
        p.setNetAmount(BigDecimal.valueOf(500));
        p.setCurrency("EUR");
        p.setPeriodStart(LocalDate.of(2026, 1, 1));
        p.setPeriodEnd(LocalDate.of(2026, 1, 31));
        return p;
    }

    private OwnerPayoutConfig config(String stripeAccount) {
        OwnerPayoutConfig c = new OwnerPayoutConfig();
        c.setOrganizationId(7L);
        c.setOwnerId(11L);
        c.setStripeConnectedAccountId(stripeAccount);
        return c;
    }

    @Test
    @DisplayName("getSupportedMethod returns STRIPE_CONNECT")
    void supportedMethod_isStripeConnect() {
        assertThat(executor.getSupportedMethod()).isEqualTo(PayoutMethod.STRIPE_CONNECT);
    }

    @Test
    @DisplayName("execute throws when stripeConnectedAccountId is null")
    void execute_nullStripeAccount_throwsExecutionException() {
        assertThatThrownBy(() -> executor.execute(payout(), config(null)))
                .isInstanceOf(PayoutExecutor.PayoutExecutionException.class)
                .hasMessageContaining("compte connecte manquant");

        verify(payoutRepository, never()).save(any());
    }

    @Test
    @DisplayName("execute throws when stripeConnectedAccountId is blank")
    void execute_blankStripeAccount_throwsExecutionException() {
        assertThatThrownBy(() -> executor.execute(payout(), config("   ")))
                .isInstanceOf(PayoutExecutor.PayoutExecutionException.class);
    }

    @Test
    @DisplayName("execute happy path : creates transfer, sets PAID + paidAt + notifies success")
    void execute_happyPath_paid() throws StripeException {
        OwnerPayout p = payout();
        when(transferClient.createTransfer(any(), any(), any(), any(), anyString())).thenReturn("tr_xyz");

        OwnerPayout result = executor.execute(p, config("acct_123"));

        assertThat(result.getStatus()).isEqualTo(PayoutStatus.PAID);
        assertThat(result.getStripeTransferId()).isEqualTo("tr_xyz");
        assertThat(result.getPaymentReference()).isEqualTo("tr_xyz");
        assertThat(result.getPaidAt()).isNotNull();
        assertThat(result.getPayoutMethod()).isEqualTo(PayoutMethod.STRIPE_CONNECT);

        verify(payoutRepository, org.mockito.Mockito.atLeast(2)).save(any(OwnerPayout.class));
        verify(notifier).notifySuccess(result);
        verify(notifier, never()).notifyFailure(any(), any());
    }

    @Test
    @DisplayName("execute passes idempotency key payout-{id} + montant/devise/destination/description")
    void execute_usesIdempotencyKeyAndArgs() throws StripeException {
        when(transferClient.createTransfer(any(), any(), any(), any(), eq("payout-101"))).thenReturn("tr_idem");

        executor.execute(payout(), config("acct_123"));

        ArgumentCaptor<BigDecimal> amount = ArgumentCaptor.forClass(BigDecimal.class);
        ArgumentCaptor<String> currency = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> destination = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> description = ArgumentCaptor.forClass(String.class);
        verify(transferClient).createTransfer(amount.capture(), currency.capture(),
                destination.capture(), description.capture(), eq("payout-101"));
        assertThat(amount.getValue()).isEqualByComparingTo("500");
        assertThat(currency.getValue()).isEqualTo("EUR");
        assertThat(destination.getValue()).isEqualTo("acct_123");
        assertThat(description.getValue()).contains("Payout #101")
                .contains("2026-01-01").contains("2026-01-31");
    }

    @Test
    @DisplayName("execute Stripe API failure -> FAILED + notifyFailure + retryCount incremented")
    void execute_stripeApiThrows_failsAndNotifies() throws StripeException {
        OwnerPayout p = payout();
        p.setRetryCount(2);
        when(transferClient.createTransfer(any(), any(), any(), any(), anyString()))
                .thenThrow(new ApiException("rate limit", "req_1", "code_x", 429, null));

        OwnerPayout result = executor.execute(p, config("acct_123"));

        assertThat(result.getStatus()).isEqualTo(PayoutStatus.FAILED);
        assertThat(result.getFailureReason()).contains("rate limit");
        assertThat(result.getRetryCount()).isEqualTo(3);
        verify(notifier).notifyFailure(eq(result), anyString());
        verify(notifier, never()).notifySuccess(any());
    }

    @Test
    @DisplayName("persistence failure AFTER successful transfer -> NOT marked FAILED, no failure notification")
    void whenSaveFailsAfterTransfer_thenNotMarkedFailed() throws StripeException {
        OwnerPayout p = payout();
        when(transferClient.createTransfer(any(), any(), any(), any(), anyString())).thenReturn("tr_ok");
        when(payoutRepository.save(any(OwnerPayout.class)))
                .thenAnswer(inv -> inv.getArgument(0))
                .thenThrow(new RuntimeException("db down"));

        assertThatThrownBy(() -> executor.execute(p, config("acct_123")))
                .isInstanceOf(PayoutExecutor.PayoutExecutionException.class)
                .hasMessageContaining("tr_ok");

        assertThat(p.getStatus()).isNotEqualTo(PayoutStatus.FAILED);
        assertThat(p.getRetryCount()).isZero();
        verify(notifier, never()).notifyFailure(any(), any());
    }

    @Test
    @DisplayName("persistence failure AFTER successful transfer -> raises a structured reconciliation alert")
    void whenSaveFailsAfterTransfer_thenReconciliationAlertRaised() throws StripeException {
        OwnerPayout p = payout();
        when(transferClient.createTransfer(any(), any(), any(), any(), anyString())).thenReturn("tr_recon");
        when(payoutRepository.save(any(OwnerPayout.class)))
                .thenAnswer(inv -> inv.getArgument(0))
                .thenThrow(new RuntimeException("db down"));

        assertThatThrownBy(() -> executor.execute(p, config("acct_123")))
                .isInstanceOf(PayoutExecutor.PayoutExecutionException.class);

        verify(notifier).notifyReconciliationRequired(p, "tr_recon");
        verify(notifier, never()).notifyFailure(any(), any());
        verify(notifier, never()).notifySuccess(any());
    }

    @Test
    @DisplayName("reconciliation alert failure does not mask the original persistence incident")
    void whenReconciliationAlertThrows_thenOriginalIncidentStillPropagates() throws StripeException {
        OwnerPayout p = payout();
        when(transferClient.createTransfer(any(), any(), any(), any(), anyString())).thenReturn("tr_mask");
        when(payoutRepository.save(any(OwnerPayout.class)))
                .thenAnswer(inv -> inv.getArgument(0))
                .thenThrow(new RuntimeException("db down"));
        doThrow(new RuntimeException("notif down"))
                .when(notifier).notifyReconciliationRequired(any(), anyString());

        assertThatThrownBy(() -> executor.execute(p, config("acct_123")))
                .isInstanceOf(PayoutExecutor.PayoutExecutionException.class)
                .hasMessageContaining("tr_mask");
    }

    @Test
    @DisplayName("success notification failure does not fail the execution")
    void whenNotifySuccessThrows_thenExecutionStillSucceeds() throws StripeException {
        OwnerPayout p = payout();
        when(transferClient.createTransfer(any(), any(), any(), any(), anyString())).thenReturn("tr_n");
        doThrow(new RuntimeException("smtp down")).when(notifier).notifySuccess(any());

        OwnerPayout result = executor.execute(p, config("acct_123"));

        assertThat(result.getStatus()).isEqualTo(PayoutStatus.PAID);
        assertThat(result.getStripeTransferId()).isEqualTo("tr_n");
    }

    @Test
    @DisplayName("failure notification failure does not prevent FAILED status")
    void whenNotifyFailureThrows_thenStillReturnsFailed() throws StripeException {
        OwnerPayout p = payout();
        when(transferClient.createTransfer(any(), any(), any(), any(), anyString()))
                .thenThrow(new ApiException("boom", "req", "c", 500, null));
        doThrow(new RuntimeException("smtp down")).when(notifier).notifyFailure(any(), any());

        OwnerPayout result = executor.execute(p, config("acct_123"));

        assertThat(result.getStatus()).isEqualTo(PayoutStatus.FAILED);
    }

    @Test
    @DisplayName("execute sets PROCESSING + payoutMethod first, then PAID")
    void execute_setsProcessingFirst() throws StripeException {
        OwnerPayout p = payout();
        when(transferClient.createTransfer(any(), any(), any(), any(), anyString())).thenReturn("tr_p");

        executor.execute(p, config("acct_z"));

        assertThat(p.getStatus()).isEqualTo(PayoutStatus.PAID);
        assertThat(p.getPayoutMethod()).isEqualTo(PayoutMethod.STRIPE_CONNECT);
    }
}
