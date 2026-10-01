package com.clenzy.service;

import com.clenzy.model.NotificationKey;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.SecurityDeposit;
import com.clenzy.model.SecurityDepositStatus;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.SecurityDepositRepository;
import com.clenzy.service.SecurityDepositHoldService.HoldOutcome;
import com.stripe.exception.ApiConnectionException;
import com.stripe.exception.CardException;
import com.stripe.model.Charge;
import com.stripe.model.PaymentIntent;
import com.stripe.param.PaymentIntentCreateParams;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Pré-autorisation de caution : pose off-session le jour de l'arrivée avec l'échéance lue chez
 * Stripe, refus explicites (FAILED + notification), renouvellement avant échéance, constat d'échéance.
 */
@ExtendWith(MockitoExtension.class)
class SecurityDepositHoldServiceTest {

    private static final Long ORG = 1L;
    private static final Long DEPOSIT_ID = 5L;
    private static final Long RESERVATION_ID = 9L;
    private static final LocalDate ARRIVAL = LocalDate.of(2026, 10, 30);
    /** 00:10 le jour de l'arrivée à Paris (UTC+1). */
    private static final Instant ARRIVAL_DAY = Instant.parse("2026-10-29T23:10:00Z");
    private static final long CAPTURE_BEFORE = Instant.parse("2026-11-03T17:10:00Z").getEpochSecond();

    @Mock private SecurityDepositRepository repository;
    @Mock private StripeGateway stripeGateway;
    @Mock private NotificationService notificationService;

    private SecurityDepositHoldService serviceAt(Instant now) {
        return new SecurityDepositHoldService(repository, stripeGateway, notificationService,
            Clock.fixed(now, ZoneOffset.UTC));
    }

    private static Reservation reservation(int nights) {
        Property property = new Property();
        property.setTimezone("Europe/Paris");
        Reservation r = new Reservation();
        r.setId(RESERVATION_ID);
        r.setOrganizationId(ORG);
        r.setProperty(property);
        r.setCheckIn(ARRIVAL);
        r.setCheckOut(ARRIVAL.plusDays(nights));
        r.setStatus("confirmed");
        r.setConfirmationCode("BK-42");
        r.setStripeCustomerId("cus_1");
        r.setStripePaymentMethodId("pm_1");
        return r;
    }

    private static SecurityDeposit deposit(SecurityDepositStatus status) {
        SecurityDeposit d = new SecurityDeposit();
        d.setId(DEPOSIT_ID);
        d.setOrganizationId(ORG);
        d.setReservationId(RESERVATION_ID);
        d.setAmount(new BigDecimal("300.00"));
        d.setCurrency("EUR");
        d.setStatus(status);
        return d;
    }

    private static SecurityDeposit held(String ref, Instant expiresAt) {
        SecurityDeposit d = deposit(SecurityDepositStatus.HELD);
        d.setExternalRef(ref);
        d.setHoldExpiresAt(expiresAt);
        return d;
    }

    private static PaymentIntent paymentIntent(String id, String status, Long captureBefore) {
        PaymentIntent pi = new PaymentIntent();
        pi.setId(id);
        pi.setStatus(status);
        if (captureBefore != null) {
            Charge.PaymentMethodDetails.Card card = new Charge.PaymentMethodDetails.Card();
            card.setCaptureBefore(captureBefore);
            Charge.PaymentMethodDetails details = new Charge.PaymentMethodDetails();
            details.setCard(card);
            Charge charge = new Charge();
            charge.setPaymentMethodDetails(details);
            pi.setLatestChargeObject(charge);
        }
        return pi;
    }

    private static CardException cardError(String code, String declineCode) {
        return new CardException("refus", "req_1", code, null, declineCode, null, 402, null);
    }

    // ─── Pose ─────────────────────────────────────────────────────────────────

    @Test
    void whenBookingIsThirtyDaysBeforeArrival_thenNoHoldIsPlaced() {
        HoldOutcome outcome = serviceAt(Instant.parse("2026-09-30T10:00:00Z"))
            .placeHoldIfDue(deposit(SecurityDepositStatus.PENDING), reservation(3));

        assertThat(outcome).isEqualTo(HoldOutcome.NOT_DUE);
        verifyNoInteractions(stripeGateway, repository, notificationService);
    }

    @Test
    void whenArrivalDayCame_thenOffSessionManualHoldIsPlacedWithStripeCaptureBefore() throws Exception {
        when(stripeGateway.createPaymentIntent(any(), eq("deposit-hold-5")))
            .thenReturn(paymentIntent("pi_hold", "requires_capture", CAPTURE_BEFORE));
        when(repository.markHoldPlaced(DEPOSIT_ID, ORG, SecurityDepositStatus.PENDING, "pi_hold",
            Instant.ofEpochSecond(CAPTURE_BEFORE))).thenReturn(1);

        HoldOutcome outcome = serviceAt(ARRIVAL_DAY).placeHoldIfDue(deposit(SecurityDepositStatus.PENDING), reservation(3));

        assertThat(outcome).isEqualTo(HoldOutcome.PLACED);
        ArgumentCaptor<PaymentIntentCreateParams> params = ArgumentCaptor.forClass(PaymentIntentCreateParams.class);
        verify(stripeGateway).createPaymentIntent(params.capture(), eq("deposit-hold-5"));
        assertThat(params.getValue().getCaptureMethod()).isEqualTo(PaymentIntentCreateParams.CaptureMethod.MANUAL);
        assertThat(params.getValue().getOffSession()).isEqualTo(true);
        assertThat(params.getValue().getConfirm()).isTrue();
        assertThat(params.getValue().getCustomer()).isEqualTo("cus_1");
        assertThat(params.getValue().getPaymentMethod()).isEqualTo("pm_1");
        assertThat(params.getValue().getAmount()).isEqualTo(30000L);
        assertThat(params.getValue().getExpand()).contains("latest_charge");
    }

    @Test
    void whenStripeOmitsCaptureBefore_thenShortestVisaWindowIsAssumed() throws Exception {
        when(stripeGateway.createPaymentIntent(any(), anyString()))
            .thenReturn(paymentIntent("pi_hold", "requires_capture", null));
        when(repository.markHoldPlaced(any(), any(), any(), any(), any())).thenReturn(1);

        serviceAt(ARRIVAL_DAY).placeHoldIfDue(deposit(SecurityDepositStatus.PENDING), reservation(3));

        verify(repository).markHoldPlaced(DEPOSIT_ID, ORG, SecurityDepositStatus.PENDING, "pi_hold",
            ARRIVAL_DAY.plus(SecurityDepositHoldPolicy.SHORTEST_VALIDITY));
    }

    @Test
    void whenCardIsDeclined_thenDepositFailsWithStripeReasonAndOrgIsNotified() throws Exception {
        when(stripeGateway.createPaymentIntent(any(), anyString()))
            .thenThrow(cardError("card_declined", "insufficient_funds"));
        when(repository.markHoldFailed(DEPOSIT_ID, ORG, SecurityDepositStatus.PENDING, "card_declined/insufficient_funds"))
            .thenReturn(1);

        HoldOutcome outcome = serviceAt(ARRIVAL_DAY).placeHoldIfDue(deposit(SecurityDepositStatus.PENDING), reservation(3));

        assertThat(outcome).isEqualTo(HoldOutcome.DECLINED);
        verify(notificationService).notifyAdminsAndManagersByOrgId(eq(ORG),
            eq(NotificationKey.SECURITY_DEPOSIT_HOLD_FAILED), anyString(),
            contains("BK-42"), eq("/reservations?highlight=" + RESERVATION_ID));
        verify(repository, never()).markHoldPlaced(any(), any(), any(), any(), any());
    }

    @Test
    void whenBankRequiresAuthentication_thenHostIsToldTheGuestMustAuthenticate() throws Exception {
        when(stripeGateway.createPaymentIntent(any(), anyString()))
            .thenThrow(cardError("authentication_required", "authentication_required"));
        when(repository.markHoldFailed(DEPOSIT_ID, ORG, SecurityDepositStatus.PENDING, "authentication_required"))
            .thenReturn(1);

        serviceAt(ARRIVAL_DAY).placeHoldIfDue(deposit(SecurityDepositStatus.PENDING), reservation(3));

        verify(notificationService).notifyAdminsAndManagersByOrgId(eq(ORG),
            eq(NotificationKey.SECURITY_DEPOSIT_HOLD_FAILED), anyString(), contains("3-D Secure"), anyString());
    }

    @Test
    void whenStripeIsUnreachable_thenDepositStaysPendingForTheNextRun() throws Exception {
        when(stripeGateway.createPaymentIntent(any(), anyString())).thenThrow(new ApiConnectionException("timeout"));

        HoldOutcome outcome = serviceAt(ARRIVAL_DAY).placeHoldIfDue(deposit(SecurityDepositStatus.PENDING), reservation(3));

        assertThat(outcome).isEqualTo(HoldOutcome.UNAVAILABLE);
        verify(repository, never()).markHoldFailed(any(), any(), any(), any());
        verifyNoInteractions(notificationService);
    }

    @Test
    void whenRetryingAfterARefusal_thenANewIdempotencyKeyIsUsed() throws Exception {
        SecurityDeposit failed = deposit(SecurityDepositStatus.FAILED);
        failed.setHoldAttempts(1);
        when(stripeGateway.createPaymentIntent(any(), eq("deposit-hold-5-1")))
            .thenReturn(paymentIntent("pi_retry", "requires_capture", CAPTURE_BEFORE));
        when(repository.markHoldPlaced(DEPOSIT_ID, ORG, SecurityDepositStatus.FAILED, "pi_retry",
            Instant.ofEpochSecond(CAPTURE_BEFORE))).thenReturn(1);

        assertThat(serviceAt(ARRIVAL_DAY).placeHoldIfDue(failed, reservation(3))).isEqualTo(HoldOutcome.PLACED);
    }

    @Test
    void whenReservationHasNoSavedCard_thenDepositFailsExplicitly() throws Exception {
        Reservation reservation = reservation(3);
        reservation.setStripePaymentMethodId(null);
        when(repository.markHoldFailed(DEPOSIT_ID, ORG, SecurityDepositStatus.PENDING, "no_saved_card")).thenReturn(1);

        HoldOutcome outcome = serviceAt(ARRIVAL_DAY).placeHoldIfDue(deposit(SecurityDepositStatus.PENDING), reservation);

        assertThat(outcome).isEqualTo(HoldOutcome.DECLINED);
        verify(stripeGateway, never()).createPaymentIntent(any(), anyString());
    }

    @Test
    void whenAConcurrentRunAlreadyRecordedTheSameHold_thenItIsKept() throws Exception {
        when(stripeGateway.createPaymentIntent(any(), anyString()))
            .thenReturn(paymentIntent("pi_hold", "requires_capture", CAPTURE_BEFORE));
        when(repository.markHoldPlaced(any(), any(), any(), any(), any())).thenReturn(0);
        when(repository.findById(DEPOSIT_ID)).thenReturn(Optional.of(held("pi_hold", Instant.ofEpochSecond(CAPTURE_BEFORE))));

        HoldOutcome outcome = serviceAt(ARRIVAL_DAY).placeHoldIfDue(deposit(SecurityDepositStatus.PENDING), reservation(3));

        assertThat(outcome).isEqualTo(HoldOutcome.PLACED);
        verify(stripeGateway, never()).cancelPaymentIntent(any(), anyString());
    }

    @Test
    void whenDepositChangedDuringTheHold_thenTheOrphanHoldIsCancelled() throws Exception {
        PaymentIntent orphan = paymentIntent("pi_orphan", "requires_capture", CAPTURE_BEFORE);
        when(stripeGateway.createPaymentIntent(any(), anyString())).thenReturn(orphan);
        when(repository.markHoldPlaced(any(), any(), any(), any(), any())).thenReturn(0);
        when(repository.findById(DEPOSIT_ID)).thenReturn(Optional.of(deposit(SecurityDepositStatus.FAILED)));
        when(stripeGateway.retrievePaymentIntent("pi_orphan")).thenReturn(orphan);

        serviceAt(ARRIVAL_DAY).placeHoldIfDue(deposit(SecurityDepositStatus.PENDING), reservation(3));

        verify(stripeGateway).cancelPaymentIntent(orphan, "deposit-orphan-pi_orphan");
    }

    // ─── Renouvellement ─────────────────────────────────────────────────────────

    @Test
    void whenRenewing_thenNewHoldIsRecordedBeforeTheOldOneIsCancelled() throws Exception {
        Instant oldExpiry = Instant.parse("2026-11-03T17:10:00Z");
        long newCaptureBefore = Instant.parse("2026-11-07T15:00:00Z").getEpochSecond();
        PaymentIntent old = paymentIntent("pi_old", "requires_capture", null);
        when(stripeGateway.createPaymentIntent(any(), eq("deposit-renew-pi_old")))
            .thenReturn(paymentIntent("pi_new", "requires_capture", newCaptureBefore));
        when(repository.markHoldRenewed(DEPOSIT_ID, ORG, "pi_old", "pi_new", Instant.ofEpochSecond(newCaptureBefore)))
            .thenReturn(1);
        when(stripeGateway.retrievePaymentIntent("pi_old")).thenReturn(old);

        serviceAt(oldExpiry.minusSeconds(3600)).renewHold(held("pi_old", oldExpiry), reservation(4));

        verify(stripeGateway).cancelPaymentIntent(old, "deposit-release-pi_old");
    }

    @Test
    void whenRenewalIsDeclined_thenCurrentHoldIsKeptAndHostIsWarnedOfItsExpiry() throws Exception {
        Instant oldExpiry = Instant.parse("2026-11-03T17:10:00Z");
        when(stripeGateway.createPaymentIntent(any(), eq("deposit-renew-pi_old")))
            .thenThrow(cardError("card_declined", "generic_decline"));
        when(repository.markRenewalFailed(DEPOSIT_ID, ORG, "pi_old", "card_declined/generic_decline")).thenReturn(1);

        serviceAt(oldExpiry.minusSeconds(3600)).renewHold(held("pi_old", oldExpiry), reservation(4));

        verify(notificationService).notifyAdminsAndManagersByOrgId(eq(ORG),
            eq(NotificationKey.SECURITY_DEPOSIT_HOLD_FAILED), anyString(), contains("03/11/2026 18:10"), anyString());
        verify(stripeGateway, never()).cancelPaymentIntent(any(), anyString());
    }

    @Test
    void whenDepositWasCapturedDuringRenewal_thenTheNewHoldIsCancelled() throws Exception {
        Instant oldExpiry = Instant.parse("2026-11-03T17:10:00Z");
        PaymentIntent renewed = paymentIntent("pi_new", "requires_capture", CAPTURE_BEFORE + 400_000);
        when(stripeGateway.createPaymentIntent(any(), anyString())).thenReturn(renewed);
        when(repository.markHoldRenewed(any(), any(), any(), any(), any())).thenReturn(0);
        when(stripeGateway.retrievePaymentIntent("pi_new")).thenReturn(renewed);

        serviceAt(oldExpiry.minusSeconds(3600)).renewHold(held("pi_old", oldExpiry), reservation(4));

        verify(stripeGateway).cancelPaymentIntent(renewed, "deposit-orphan-pi_new");
        verify(stripeGateway, never()).retrievePaymentIntent("pi_old");
    }

    // ─── Échéance ─────────────────────────────────────────────────────────────

    @Test
    void whenHoldLapsedDuringTheClaimWindow_thenDepositExpiresAndOrgIsAlerted() throws Exception {
        Instant expiry = Instant.parse("2026-11-03T17:10:00Z");
        when(stripeGateway.retrievePaymentIntent("pi_old")).thenReturn(paymentIntent("pi_old", "canceled", null));
        when(repository.markHoldLapsed(DEPOSIT_ID, ORG, SecurityDepositStatus.EXPIRED)).thenReturn(1);

        // Séjour de 4 nuits : fenêtre de réclamation jusqu'au 5 novembre.
        serviceAt(expiry.plusSeconds(600)).reconcileLapsedHold(held("pi_old", expiry), reservation(4));

        verify(notificationService).notifyAdminsAndManagersByOrgId(eq(ORG),
            eq(NotificationKey.SECURITY_DEPOSIT_HOLD_EXPIRED), anyString(), contains("BK-42"), anyString());
    }

    @Test
    void whenHoldLapsedAfterTheClaimWindow_thenDepositIsSimplyReleased() throws Exception {
        Instant expiry = Instant.parse("2026-11-03T17:10:00Z");
        when(stripeGateway.retrievePaymentIntent("pi_old")).thenReturn(paymentIntent("pi_old", "canceled", null));
        when(repository.markHoldLapsed(DEPOSIT_ID, ORG, SecurityDepositStatus.RELEASED)).thenReturn(1);

        // Séjour d'une nuit : fenêtre de réclamation close le 1er novembre.
        serviceAt(expiry.plusSeconds(600)).reconcileLapsedHold(held("pi_old", expiry), reservation(1));

        verifyNoInteractions(notificationService);
    }

    @Test
    void whenStripeHasNotYetCancelledTheHold_thenNothingChanges() throws Exception {
        Instant expiry = Instant.parse("2026-11-03T17:10:00Z");
        when(stripeGateway.retrievePaymentIntent("pi_old")).thenReturn(paymentIntent("pi_old", "requires_capture", null));

        serviceAt(expiry.plusSeconds(60)).reconcileLapsedHold(held("pi_old", expiry), reservation(4));

        verify(repository, never()).markHoldLapsed(any(), any(), any());
    }

    @Test
    void whenCancellingAnAlreadyLapsedHold_thenStripeCancelIsNotCalled() throws Exception {
        when(stripeGateway.retrievePaymentIntent("pi_old")).thenReturn(paymentIntent("pi_old", "canceled", null));

        boolean alreadyLapsed = serviceAt(ARRIVAL_DAY).cancelAuthorization("pi_old", "deposit-release-5");

        assertThat(alreadyLapsed).isTrue();
        verify(stripeGateway, never()).cancelPaymentIntent(any(), anyString());
    }
}
