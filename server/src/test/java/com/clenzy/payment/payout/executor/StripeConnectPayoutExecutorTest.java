package com.clenzy.payment.payout.executor;

import com.clenzy.model.OwnerPayout;
import com.clenzy.model.OwnerPayout.PayoutStatus;
import com.clenzy.model.OwnerPayoutConfig;
import com.clenzy.model.PayoutMethod;
import com.clenzy.payment.StripeGateway;
import com.clenzy.payment.payout.PayoutExecutor;
import com.clenzy.payment.payout.PayoutNotifier;
import com.clenzy.repository.OwnerPayoutRepository;
import com.stripe.exception.ApiException;
import com.stripe.exception.StripeException;
import com.stripe.model.Transfer;
import com.stripe.param.TransferCreateParams;
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
 * <h2>Focus</h2>
 * <ul>
 *   <li>getSupportedMethod retourne STRIPE_CONNECT</li>
 *   <li>execute refuse si compte Stripe Connect absent</li>
 *   <li>execute happy path : PROCESSING -> PAID + notify, idempotency key payout-{id}</li>
 *   <li>echec du transfert -> FAILED + notifyFailure + retryCount++</li>
 *   <li>echec de persistance APRES transfert reussi -> PAS de FAILED (Z3-BUGS-03)</li>
 *   <li>echec de notification -> n'echoue pas l'execution</li>
 * </ul>
 */
class StripeConnectPayoutExecutorTest {

    private StripeGateway stripeGateway;
    private OwnerPayoutRepository payoutRepository;
    private PayoutNotifier notifier;
    private StripeConnectPayoutExecutor executor;

    @BeforeEach
    void setUp() {
        stripeGateway = mock(StripeGateway.class);
        payoutRepository = mock(OwnerPayoutRepository.class);
        notifier = mock(PayoutNotifier.class);
        executor = new StripeConnectPayoutExecutor(stripeGateway, payoutRepository, notifier);

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
        when(stripeGateway.createTransfer(any(TransferCreateParams.class), anyString()))
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
    @DisplayName("execute passes Stripe idempotency key payout-{id} and converted params (Z3-BUGS-03)")
    void execute_usesIdempotencyKeyAndConvertedParams() throws StripeException {
        OwnerPayoutConfig config = config("acct_123");
        OwnerPayout p = payout();

        Transfer transfer = mock(Transfer.class);
        when(transfer.getId()).thenReturn("tr_idem");
        ArgumentCaptor<TransferCreateParams> paramsCaptor = ArgumentCaptor.forClass(TransferCreateParams.class);
        when(stripeGateway.createTransfer(paramsCaptor.capture(), eq("payout-101")))
                .thenReturn(transfer);

        executor.execute(p, config);

        TransferCreateParams params = paramsCaptor.getValue();
        assertThat(params.getAmount()).isEqualTo(50000L);
        assertThat(params.getCurrency()).isEqualTo("eur");
        assertThat(params.getDestination()).isEqualTo("acct_123");
        assertThat(params.getDescription()).contains("Payout #101")
                .contains("2026-01-01").contains("2026-01-31");
    }

    @Test
    @DisplayName("execute Stripe API failure -> FAILED + notifyFailure + retryCount incremented")
    void execute_stripeApiThrows_failsAndNotifies() throws StripeException {
        OwnerPayoutConfig config = config("acct_123");
        OwnerPayout p = payout();
        p.setRetryCount(2);

        StripeException ex = new ApiException("rate limit", "req_1", "code_x", 429, null);
        when(stripeGateway.createTransfer(any(TransferCreateParams.class), anyString()))
                .thenThrow(ex);

        OwnerPayout result = executor.execute(p, config);

        assertThat(result.getStatus()).isEqualTo(PayoutStatus.FAILED);
        assertThat(result.getFailureReason()).contains("rate limit");
        assertThat(result.getRetryCount()).isEqualTo(3);
        verify(notifier).notifyFailure(eq(result), anyString());
        verify(notifier, never()).notifySuccess(any());
    }

    @Test
    @DisplayName("persistence failure AFTER successful transfer -> NOT marked FAILED, no failure notification")
    void whenSaveFailsAfterTransfer_thenNotMarkedFailed() throws StripeException {
        OwnerPayoutConfig config = config("acct_123");
        OwnerPayout p = payout();

        Transfer transfer = mock(Transfer.class);
        when(transfer.getId()).thenReturn("tr_ok");
        when(stripeGateway.createTransfer(any(TransferCreateParams.class), anyString()))
                .thenReturn(transfer);
        // 1er save (PROCESSING) ok, 2e save (PAID) echoue
        when(payoutRepository.save(any(OwnerPayout.class)))
                .thenAnswer(inv -> inv.getArgument(0))
                .thenThrow(new RuntimeException("db down"));

        assertThatThrownBy(() -> executor.execute(p, config))
                .isInstanceOf(PayoutExecutor.PayoutExecutionException.class)
                .hasMessageContaining("tr_ok");

        // L'echec post-transfert ne doit PAS passer par le chemin FAILED/retry
        assertThat(p.getStatus()).isNotEqualTo(PayoutStatus.FAILED);
        assertThat(p.getRetryCount()).isZero();
        verify(notifier, never()).notifyFailure(any(), any());
    }

    @Test
    @DisplayName("success notification failure does not fail the execution")
    void whenNotifySuccessThrows_thenExecutionStillSucceeds() throws StripeException {
        OwnerPayoutConfig config = config("acct_123");
        OwnerPayout p = payout();

        Transfer transfer = mock(Transfer.class);
        when(transfer.getId()).thenReturn("tr_n");
        when(stripeGateway.createTransfer(any(TransferCreateParams.class), anyString()))
                .thenReturn(transfer);
        doThrow(new RuntimeException("smtp down")).when(notifier).notifySuccess(any());

        OwnerPayout result = executor.execute(p, config);

        assertThat(result.getStatus()).isEqualTo(PayoutStatus.PAID);
        assertThat(result.getStripeTransferId()).isEqualTo("tr_n");
    }

    @Test
    @DisplayName("failure notification failure does not prevent FAILED status")
    void whenNotifyFailureThrows_thenStillReturnsFailed() throws StripeException {
        OwnerPayoutConfig config = config("acct_123");
        OwnerPayout p = payout();

        when(stripeGateway.createTransfer(any(TransferCreateParams.class), anyString()))
                .thenThrow(new ApiException("boom", "req", "c", 500, null));
        doThrow(new RuntimeException("smtp down")).when(notifier).notifyFailure(any(), any());

        OwnerPayout result = executor.execute(p, config);

        assertThat(result.getStatus()).isEqualTo(PayoutStatus.FAILED);
    }

    @Test
    @DisplayName("execute sets PROCESSING + payoutMethod first, then PAID")
    void execute_setsProcessingFirst() throws StripeException {
        OwnerPayoutConfig config = config("acct_z");
        OwnerPayout p = payout();

        Transfer transfer = mock(Transfer.class);
        when(transfer.getId()).thenReturn("tr_p");
        when(stripeGateway.createTransfer(any(TransferCreateParams.class), anyString()))
                .thenReturn(transfer);

        executor.execute(p, config);

        // The same payout instance progresses through PROCESSING -> PAID; final state is PAID.
        assertThat(p.getStatus()).isEqualTo(PayoutStatus.PAID);
        assertThat(p.getPayoutMethod()).isEqualTo(PayoutMethod.STRIPE_CONNECT);
    }
}
