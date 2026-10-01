package com.clenzy.service;

import com.clenzy.dto.SecurityDepositDto;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.SecurityDeposit;
import com.clenzy.model.SecurityDepositStatus;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.SecurityDepositRepository;
import com.clenzy.service.SecurityDepositHoldService.HoldOutcome;
import com.stripe.model.PaymentIntent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Effet Stripe de la caution côté PMS (CLZ Domaine 2 — anti-fraude) : pré-autorisation sur la carte
 * enregistrée dans la fenêtre de validité, capture/libération hors transaction avec idempotency keys,
 * gardes de statut/montant, hold déjà échu chez Stripe.
 */
@ExtendWith(MockitoExtension.class)
class SecurityDepositPaymentServiceTest {

    @Mock private SecurityDepositRepository repository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private SecurityDepositService depositService;
    @Mock private SecurityDepositHoldService holdService;
    @Mock private StripeGateway stripeGateway;

    private SecurityDepositPaymentService service;

    private static final Long ORG = 1L;
    private static final Long DEPOSIT_ID = 5L;
    private static final Long RESERVATION_ID = 9L;

    @BeforeEach
    void setUp() {
        service = new SecurityDepositPaymentService(repository, reservationRepository, depositService, holdService, stripeGateway);
    }

    private SecurityDeposit deposit(SecurityDepositStatus status, String externalRef) {
        SecurityDeposit d = new SecurityDeposit();
        d.setId(DEPOSIT_ID);
        d.setOrganizationId(ORG);
        d.setReservationId(RESERVATION_ID);
        d.setAmount(new BigDecimal("300.00"));
        d.setCurrency("EUR");
        d.setStatus(status);
        d.setExternalRef(externalRef);
        return d;
    }

    private Reservation reservation(Long orgId, boolean savedCard) {
        Property property = new Property();
        property.setTimezone("Europe/Paris");
        Reservation r = new Reservation();
        r.setId(RESERVATION_ID);
        r.setOrganizationId(orgId);
        r.setProperty(property);
        r.setCheckIn(LocalDate.of(2026, 10, 30));
        r.setCheckOut(LocalDate.of(2026, 11, 2));
        r.setStatus("confirmed");
        if (savedCard) {
            r.setStripeCustomerId("cus_1");
            r.setStripePaymentMethodId("pm_1");
        }
        return r;
    }

    private static PaymentIntent paymentIntent(String status) {
        PaymentIntent pi = new PaymentIntent();
        pi.setId("pi_1");
        pi.setStatus(status);
        return pi;
    }

    // ─── Pré-autorisation ─────────────────────────────────────────────────────

    @Test
    void placeHold_onArrivalDay_delegatesToHoldServiceAndReturnsHeldDeposit() {
        SecurityDeposit pending = deposit(SecurityDepositStatus.PENDING, null);
        Reservation reservation = reservation(ORG, true);
        when(repository.findByIdAndOrganizationId(DEPOSIT_ID, ORG))
            .thenReturn(Optional.of(pending), Optional.of(deposit(SecurityDepositStatus.HELD, "pi_hold")));
        when(reservationRepository.findByIdWithGuestAndProperty(RESERVATION_ID)).thenReturn(Optional.of(reservation));
        when(holdService.placeHoldIfDue(pending, reservation)).thenReturn(HoldOutcome.PLACED);

        SecurityDepositDto result = service.placeHold(ORG, DEPOSIT_ID);

        assertThat(result.status()).isEqualTo(SecurityDepositStatus.HELD);
        assertThat(result.externalRef()).isEqualTo("pi_hold");
    }

    @Test
    void placeHold_beforeArrival_leavesDepositPendingForTheScheduler() {
        SecurityDeposit pending = deposit(SecurityDepositStatus.PENDING, null);
        Reservation reservation = reservation(ORG, true);
        when(repository.findByIdAndOrganizationId(DEPOSIT_ID, ORG)).thenReturn(Optional.of(pending));
        when(reservationRepository.findByIdWithGuestAndProperty(RESERVATION_ID)).thenReturn(Optional.of(reservation));
        when(holdService.placeHoldIfDue(pending, reservation)).thenReturn(HoldOutcome.NOT_DUE);

        SecurityDepositDto result = service.placeHold(ORG, DEPOSIT_ID);

        assertThat(result.status()).isEqualTo(SecurityDepositStatus.PENDING);
    }

    @Test
    void placeHold_withoutSavedCard_isRefusedWithoutStripeCall() {
        when(repository.findByIdAndOrganizationId(DEPOSIT_ID, ORG))
            .thenReturn(Optional.of(deposit(SecurityDepositStatus.PENDING, null)));
        when(reservationRepository.findByIdWithGuestAndProperty(RESERVATION_ID))
            .thenReturn(Optional.of(reservation(ORG, false)));

        assertThatThrownBy(() -> service.placeHold(ORG, DEPOSIT_ID))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("Aucune carte enregistrée");
        verify(holdService, never()).placeHoldIfDue(any(), any());
    }

    @Test
    void placeHold_retryAfterRefusalOutsideTheWindow_isRefused() {
        SecurityDeposit failed = deposit(SecurityDepositStatus.FAILED, null);
        Reservation reservation = reservation(ORG, true);
        when(repository.findByIdAndOrganizationId(DEPOSIT_ID, ORG)).thenReturn(Optional.of(failed));
        when(reservationRepository.findByIdWithGuestAndProperty(RESERVATION_ID)).thenReturn(Optional.of(reservation));
        when(holdService.placeHoldIfDue(failed, reservation)).thenReturn(HoldOutcome.NOT_DUE);

        assertThatThrownBy(() -> service.placeHold(ORG, DEPOSIT_ID))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("jour de l'arrivée");
    }

    @Test
    void placeHold_whenStripeIsUnavailable_throws() {
        SecurityDeposit pending = deposit(SecurityDepositStatus.PENDING, null);
        Reservation reservation = reservation(ORG, true);
        when(repository.findByIdAndOrganizationId(DEPOSIT_ID, ORG)).thenReturn(Optional.of(pending));
        when(reservationRepository.findByIdWithGuestAndProperty(RESERVATION_ID)).thenReturn(Optional.of(reservation));
        when(holdService.placeHoldIfDue(pending, reservation)).thenReturn(HoldOutcome.UNAVAILABLE);

        assertThatThrownBy(() -> service.placeHold(ORG, DEPOSIT_ID))
            .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void placeHold_reservationOfAnotherOrg_isNotFound() {
        when(repository.findByIdAndOrganizationId(DEPOSIT_ID, ORG))
            .thenReturn(Optional.of(deposit(SecurityDepositStatus.PENDING, null)));
        when(reservationRepository.findByIdWithGuestAndProperty(RESERVATION_ID))
            .thenReturn(Optional.of(reservation(2L, true)));

        assertThatThrownBy(() -> service.placeHold(ORG, DEPOSIT_ID))
            .isInstanceOf(IllegalArgumentException.class);
        verify(holdService, never()).placeHoldIfDue(any(), any());
    }

    @Test
    void placeHold_wrongStatus_throws_noStripeCall() {
        when(repository.findByIdAndOrganizationId(DEPOSIT_ID, ORG))
            .thenReturn(Optional.of(deposit(SecurityDepositStatus.HELD, "pi_1")));

        assertThatThrownBy(() -> service.placeHold(ORG, DEPOSIT_ID))
            .isInstanceOf(IllegalStateException.class);
        verify(holdService, never()).placeHoldIfDue(any(), any());
    }

    // ─── Libération / capture ──────────────────────────────────────────────────

    @Test
    void releaseHold_cancelsAuthorization_andReleases() throws Exception {
        when(repository.findByIdAndOrganizationId(DEPOSIT_ID, ORG))
            .thenReturn(Optional.of(deposit(SecurityDepositStatus.HELD, "pi_1")));

        service.releaseHold(ORG, DEPOSIT_ID);

        verify(holdService).cancelAuthorization("pi_1", "deposit-release-5");
        verify(depositService).release(ORG, DEPOSIT_ID);
    }

    @Test
    void captureHold_partial_capturesAndRecords() throws Exception {
        when(repository.findByIdAndOrganizationId(DEPOSIT_ID, ORG))
            .thenReturn(Optional.of(deposit(SecurityDepositStatus.HELD, "pi_1")));
        PaymentIntent pi = paymentIntent("requires_capture");
        when(stripeGateway.retrievePaymentIntent("pi_1")).thenReturn(pi);

        service.captureHold(ORG, DEPOSIT_ID, new BigDecimal("120.00"), "degats cuisine");

        verify(stripeGateway).capturePaymentIntent(eq(pi), any(), eq("deposit-capture-5"));
        verify(depositService).capture(ORG, DEPOSIT_ID, new BigDecimal("120.00"), "degats cuisine");
    }

    @Test
    void captureHold_onHoldStripeLetLapse_recordsLapseAndRefuses() throws Exception {
        SecurityDeposit held = deposit(SecurityDepositStatus.HELD, "pi_1");
        Reservation reservation = reservation(ORG, true);
        when(repository.findByIdAndOrganizationId(DEPOSIT_ID, ORG)).thenReturn(Optional.of(held));
        when(stripeGateway.retrievePaymentIntent("pi_1")).thenReturn(paymentIntent("canceled"));
        when(reservationRepository.findByIdWithGuestAndProperty(RESERVATION_ID)).thenReturn(Optional.of(reservation));

        assertThatThrownBy(() -> service.captureHold(ORG, DEPOSIT_ID, new BigDecimal("120.00"), "degats"))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("expiré");
        verify(holdService).recordLapse(held, reservation);
        verify(stripeGateway, never()).capturePaymentIntent(any(), any(), any());
        verify(depositService, never()).capture(any(), any(), any(), any());
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
