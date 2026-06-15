package com.clenzy.service;

import com.clenzy.model.SecurityDeposit;
import com.clenzy.model.SecurityDepositStatus;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.SecurityDepositRepository;
import com.stripe.exception.ApiConnectionException;
import com.stripe.model.PaymentIntent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Effet Stripe de la caution (CLZ Domaine 2 — anti-fraude) : hold/capture/release hors transaction,
 * idempotency keys, machine à états (markHeld/markFailed/release/capture), gardes de statut/montant.
 */
@ExtendWith(MockitoExtension.class)
class SecurityDepositPaymentServiceTest {

    @Mock private SecurityDepositRepository repository;
    @Mock private SecurityDepositService depositService;
    @Mock private StripeGateway stripeGateway;

    private SecurityDepositPaymentService service;

    private static final Long ORG = 1L;
    private static final Long DEPOSIT_ID = 5L;

    @BeforeEach
    void setUp() {
        service = new SecurityDepositPaymentService(repository, depositService, stripeGateway);
    }

    private SecurityDeposit deposit(SecurityDepositStatus status, String externalRef) {
        SecurityDeposit d = new SecurityDeposit();
        d.setId(DEPOSIT_ID);
        d.setOrganizationId(ORG);
        d.setReservationId(9L);
        d.setAmount(new BigDecimal("300.00"));
        d.setCurrency("EUR");
        d.setStatus(status);
        d.setExternalRef(externalRef);
        return d;
    }

    @Test
    void placeHold_success_marksHeldWithPaymentIntentId() throws Exception {
        when(repository.findByIdAndOrganizationId(DEPOSIT_ID, ORG))
            .thenReturn(Optional.of(deposit(SecurityDepositStatus.PENDING, null)));
        PaymentIntent pi = org.mockito.Mockito.mock(PaymentIntent.class);
        when(pi.getId()).thenReturn("pi_123");
        when(stripeGateway.createPaymentIntent(any(), eq("deposit-hold-5"))).thenReturn(pi);

        service.placeHold(ORG, DEPOSIT_ID);

        verify(depositService).markHeld(ORG, DEPOSIT_ID, "pi_123");
        verify(depositService, never()).markFailed(any(), any());
    }

    @Test
    void placeHold_stripeFails_marksFailed_andThrows() throws Exception {
        when(repository.findByIdAndOrganizationId(DEPOSIT_ID, ORG))
            .thenReturn(Optional.of(deposit(SecurityDepositStatus.PENDING, null)));
        when(stripeGateway.createPaymentIntent(any(), any())).thenThrow(new ApiConnectionException("boom"));

        assertThatThrownBy(() -> service.placeHold(ORG, DEPOSIT_ID))
            .isInstanceOf(IllegalStateException.class);
        verify(depositService).markFailed(ORG, DEPOSIT_ID);
        verify(depositService, never()).markHeld(any(), any(), any());
    }

    @Test
    void placeHold_wrongStatus_throws_noStripeCall() throws Exception {
        when(repository.findByIdAndOrganizationId(DEPOSIT_ID, ORG))
            .thenReturn(Optional.of(deposit(SecurityDepositStatus.HELD, "pi_1")));

        assertThatThrownBy(() -> service.placeHold(ORG, DEPOSIT_ID))
            .isInstanceOf(IllegalStateException.class);
        verify(stripeGateway, never()).createPaymentIntent(any(), any());
    }

    @Test
    void releaseHold_cancelsPaymentIntent_andReleases() throws Exception {
        when(repository.findByIdAndOrganizationId(DEPOSIT_ID, ORG))
            .thenReturn(Optional.of(deposit(SecurityDepositStatus.HELD, "pi_1")));
        PaymentIntent pi = org.mockito.Mockito.mock(PaymentIntent.class);
        when(stripeGateway.retrievePaymentIntent("pi_1")).thenReturn(pi);

        service.releaseHold(ORG, DEPOSIT_ID);

        verify(stripeGateway).cancelPaymentIntent(pi, "deposit-release-5");
        verify(depositService).release(ORG, DEPOSIT_ID);
    }

    @Test
    void captureHold_partial_capturesAndRecords() throws Exception {
        when(repository.findByIdAndOrganizationId(DEPOSIT_ID, ORG))
            .thenReturn(Optional.of(deposit(SecurityDepositStatus.HELD, "pi_1")));
        PaymentIntent pi = org.mockito.Mockito.mock(PaymentIntent.class);
        when(stripeGateway.retrievePaymentIntent("pi_1")).thenReturn(pi);

        service.captureHold(ORG, DEPOSIT_ID, new BigDecimal("120.00"), "degats cuisine");

        verify(stripeGateway).capturePaymentIntent(eq(pi), any(), eq("deposit-capture-5"));
        verify(depositService).capture(ORG, DEPOSIT_ID, new BigDecimal("120.00"), "degats cuisine");
    }

    @Test
    void captureHold_amountExceedsDeposit_throws() {
        when(repository.findByIdAndOrganizationId(DEPOSIT_ID, ORG))
            .thenReturn(Optional.of(deposit(SecurityDepositStatus.HELD, "pi_1")));

        assertThatThrownBy(() -> service.captureHold(ORG, DEPOSIT_ID, new BigDecimal("400.00"), "x"))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void unknownDeposit_throws() {
        when(repository.findByIdAndOrganizationId(DEPOSIT_ID, ORG)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.placeHold(ORG, DEPOSIT_ID))
            .isInstanceOf(IllegalArgumentException.class);
    }
}
