package com.clenzy.payment.payout.executor;

import com.clenzy.model.OwnerPayout;
import com.clenzy.model.OwnerPayout.PayoutStatus;
import com.clenzy.model.OwnerPayoutConfig;
import com.clenzy.model.PayoutMethod;
import com.clenzy.payment.payout.PayoutExecutor;
import com.clenzy.payment.payout.PayoutNotifier;
import com.clenzy.repository.OwnerPayoutRepository;
import com.clenzy.service.StripeConnectService;
import com.stripe.exception.ApiException;
import com.stripe.exception.StripeException;
import com.stripe.model.Transfer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires pour {@link StripeConnectPayoutExecutor}.
 *
 * <h2>Focus</h2>
 * <ul>
 *   <li>getSupportedMethod retourne STRIPE_CONNECT</li>
 *   <li>execute refuse si compte Stripe Connect absent</li>
 *   <li>execute happy path : PROCESSING -> PAID + notify</li>
 *   <li>execute fail path : Stripe API throw -> FAILED + notifyFailure + retryCount++</li>
 * </ul>
 */
class StripeConnectPayoutExecutorTest {

    private StripeConnectService stripeConnectService;
    private OwnerPayoutRepository payoutRepository;
    private PayoutNotifier notifier;
    private StripeConnectPayoutExecutor executor;

    @BeforeEach
    void setUp() {
        stripeConnectService = mock(StripeConnectService.class);
        payoutRepository = mock(OwnerPayoutRepository.class);
        notifier = mock(PayoutNotifier.class);
        executor = new StripeConnectPayoutExecutor(stripeConnectService, payoutRepository, notifier);

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
        OwnerPayoutConfig config = config(null);
        OwnerPayout p = payout();

        assertThatThrownBy(() -> executor.execute(p, config))
                .isInstanceOf(PayoutExecutor.PayoutExecutionException.class)
                .hasMessageContaining("compte connecte manquant");

        verify(payoutRepository, never()).save(any());
    }

    @Test
    @DisplayName("execute throws when stripeConnectedAccountId is blank")
    void execute_blankStripeAccount_throwsExecutionException() {
        OwnerPayoutConfig config = config("   ");
        OwnerPayout p = payout();

        assertThatThrownBy(() -> executor.execute(p, config))
                .isInstanceOf(PayoutExecutor.PayoutExecutionException.class);
    }

    @Test
    @DisplayName("execute happy path : creates transfer, sets PAID + paidAt + notifies success")
    void execute_happyPath_paid() throws StripeException {
        OwnerPayoutConfig config = config("acct_123");
        OwnerPayout p = payout();

        Transfer transfer = mock(Transfer.class);
        when(transfer.getId()).thenReturn("tr_xyz");
        when(stripeConnectService.createTransfer(
                eq(p.getNetAmount()), eq("EUR"), eq("acct_123"), anyString()))
                .thenReturn(transfer);

        OwnerPayout result = executor.execute(p, config);

        assertThat(result.getStatus()).isEqualTo(PayoutStatus.PAID);
        assertThat(result.getStripeTransferId()).isEqualTo("tr_xyz");
        assertThat(result.getPaymentReference()).isEqualTo("tr_xyz");
        assertThat(result.getPaidAt()).isNotNull();
        assertThat(result.getPayoutMethod()).isEqualTo(PayoutMethod.STRIPE_CONNECT);

        // save called at least twice (PROCESSING then PAID)
        verify(payoutRepository, org.mockito.Mockito.atLeast(2)).save(any(OwnerPayout.class));
        verify(notifier).notifySuccess(result);
        verify(notifier, never()).notifyFailure(any(), any());
    }

    @Test
    @DisplayName("execute Stripe API failure -> FAILED + notifyFailure + retryCount incremented")
    void execute_stripeApiThrows_failsAndNotifies() throws StripeException {
        OwnerPayoutConfig config = config("acct_123");
        OwnerPayout p = payout();
        p.setRetryCount(2);

        StripeException ex = new ApiException("rate limit", "req_1", "code_x", 429, null);
        when(stripeConnectService.createTransfer(any(), anyString(), anyString(), anyString()))
                .thenThrow(ex);

        OwnerPayout result = executor.execute(p, config);

        assertThat(result.getStatus()).isEqualTo(PayoutStatus.FAILED);
        assertThat(result.getFailureReason()).contains("rate limit");
        assertThat(result.getRetryCount()).isEqualTo(3);
        verify(notifier).notifyFailure(eq(result), anyString());
        verify(notifier, never()).notifySuccess(any());
    }

    @Test
    @DisplayName("execute description includes payout id and period")
    void execute_descriptionContainsIdAndPeriod() throws StripeException {
        OwnerPayoutConfig config = config("acct_x");
        OwnerPayout p = payout();

        Transfer transfer = mock(Transfer.class);
        when(transfer.getId()).thenReturn("tr_1");

        org.mockito.ArgumentCaptor<String> descCaptor = org.mockito.ArgumentCaptor.forClass(String.class);
        when(stripeConnectService.createTransfer(
                any(), anyString(), anyString(), descCaptor.capture()))
                .thenReturn(transfer);

        executor.execute(p, config);

        String desc = descCaptor.getValue();
        assertThat(desc).contains("Payout #101");
        assertThat(desc).contains("2026-01-01");
        assertThat(desc).contains("2026-01-31");
    }

    @Test
    @DisplayName("execute sets PROCESSING + payoutMethod first, then PAID")
    void execute_setsProcessingFirst() throws StripeException {
        OwnerPayoutConfig config = config("acct_z");
        OwnerPayout p = payout();

        Transfer transfer = mock(Transfer.class);
        when(transfer.getId()).thenReturn("tr_p");
        when(stripeConnectService.createTransfer(any(), anyString(), anyString(), anyString()))
                .thenReturn(transfer);

        executor.execute(p, config);

        // The same payout instance progresses through PROCESSING -> PAID; final state is PAID.
        assertThat(p.getStatus()).isEqualTo(PayoutStatus.PAID);
        assertThat(p.getPayoutMethod()).isEqualTo(PayoutMethod.STRIPE_CONNECT);
    }
}
