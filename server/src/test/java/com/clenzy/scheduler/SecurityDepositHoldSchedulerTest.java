package com.clenzy.scheduler;

import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.SecurityDeposit;
import com.clenzy.model.SecurityDepositStatus;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.SecurityDepositRepository;
import com.clenzy.service.NotificationService;
import com.clenzy.service.SecurityDepositHoldPolicy;
import com.clenzy.service.SecurityDepositHoldService;
import com.stripe.model.Charge;
import com.stripe.model.PaymentIntent;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Maintenance horaire des holds de caution : pose le jour de l'arrivée (jamais à la réservation),
 * renouvellement quand l'échéance tombe dans la fenêtre de réclamation, constat d'échéance.
 */
@ExtendWith(MockitoExtension.class)
class SecurityDepositHoldSchedulerTest {

    private static final Long ORG = 1L;
    private static final LocalDate ARRIVAL = LocalDate.of(2026, 10, 30);

    @Mock private SecurityDepositRepository depositRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private SecurityDepositHoldService holdService;
    @Mock private StripeGateway stripeGateway;
    @Mock private NotificationService notificationService;

    private SecurityDepositHoldScheduler schedulerAt(Instant now, SecurityDepositHoldService service) {
        return new SecurityDepositHoldScheduler(depositRepository, reservationRepository, service,
            Clock.fixed(now, ZoneOffset.UTC));
    }

    /** Scheduler branché sur le VRAI service de hold (Stripe simulé), à l'instant donné. */
    private SecurityDepositHoldScheduler realSchedulerAt(Instant now) {
        Clock clock = Clock.fixed(now, ZoneOffset.UTC);
        return new SecurityDepositHoldScheduler(depositRepository, reservationRepository,
            new SecurityDepositHoldService(depositRepository, stripeGateway, notificationService, clock), clock);
    }

    private static Reservation reservation(Long id, Long orgId, int nights) {
        Property property = new Property();
        property.setTimezone("Europe/Paris");
        Reservation r = new Reservation();
        r.setId(id);
        r.setOrganizationId(orgId);
        r.setProperty(property);
        r.setCheckIn(ARRIVAL);
        r.setCheckOut(ARRIVAL.plusDays(nights));
        r.setStatus("confirmed");
        r.setConfirmationCode("BK-" + id);
        r.setStripeCustomerId("cus_" + id);
        r.setStripePaymentMethodId("pm_" + id);
        return r;
    }

    private static SecurityDeposit deposit(Long id, Long reservationId, SecurityDepositStatus status) {
        SecurityDeposit d = new SecurityDeposit();
        d.setId(id);
        d.setOrganizationId(ORG);
        d.setReservationId(reservationId);
        d.setAmount(new BigDecimal("300.00"));
        d.setCurrency("EUR");
        d.setStatus(status);
        return d;
    }

    private static SecurityDeposit held(Long id, Long reservationId, Instant expiresAt) {
        SecurityDeposit d = deposit(id, reservationId, SecurityDepositStatus.HELD);
        d.setExternalRef("pi_" + id);
        d.setHoldExpiresAt(expiresAt);
        return d;
    }

    private static PaymentIntent authorized(String id, Instant captureBefore) {
        Charge.PaymentMethodDetails.Card card = new Charge.PaymentMethodDetails.Card();
        card.setCaptureBefore(captureBefore.getEpochSecond());
        Charge.PaymentMethodDetails details = new Charge.PaymentMethodDetails();
        details.setCard(card);
        Charge charge = new Charge();
        charge.setPaymentMethodDetails(details);
        PaymentIntent pi = new PaymentIntent();
        pi.setId(id);
        pi.setStatus("requires_capture");
        pi.setLatestChargeObject(charge);
        return pi;
    }

    // ─── Pose ─────────────────────────────────────────────────────────────────

    /**
     * Le bug d'origine : un hold posé au paiement, 30 jours avant l'arrivée, était annulé par Stripe
     * au bout de 4 j 18 h. Désormais le paiement n'enregistre que la carte, la veille ne fait rien,
     * et le hold est posé le jour J — son échéance Stripe couvre alors le séjour.
     */
    @Test
    void whenBookedThirtyDaysAhead_thenHoldIsPlacedOnArrivalDayAndNotBefore() throws Exception {
        SecurityDeposit pending = deposit(5L, 9L, SecurityDepositStatus.PENDING);
        Instant captureBefore = Instant.parse("2026-11-03T17:10:00Z");
        when(depositRepository.findPendingWithSavedCard(any(), any())).thenReturn(List.of(pending));
        when(depositRepository.findHeldExpiringBefore(any())).thenReturn(List.of());
        when(reservationRepository.findByIdWithGuestAndProperty(9L)).thenReturn(Optional.of(reservation(9L, ORG, 1)));
        when(stripeGateway.createPaymentIntent(any(), eq("deposit-hold-5"))).thenReturn(authorized("pi_hold", captureBefore));
        when(depositRepository.markHoldPlaced(5L, ORG, SecurityDepositStatus.PENDING, "pi_hold", captureBefore)).thenReturn(1);

        // Jour de la réservation (J-30), puis veille de l'arrivée à 23:30 à Paris : rien n'est posé.
        realSchedulerAt(Instant.parse("2026-09-30T10:00:00Z")).maintainHolds();
        realSchedulerAt(Instant.parse("2026-10-29T22:30:00Z")).maintainHolds();
        verify(stripeGateway, never()).createPaymentIntent(any(), anyString());

        // Jour de l'arrivée, 00:10 à Paris : hold off-session posé, échéance Stripe enregistrée.
        realSchedulerAt(Instant.parse("2026-10-29T23:10:00Z")).maintainHolds();
        verify(stripeGateway, times(1)).createPaymentIntent(any(), eq("deposit-hold-5"));
        verify(depositRepository).markHoldPlaced(5L, ORG, SecurityDepositStatus.PENDING, "pi_hold", captureBefore);
    }

    @Test
    void whenSearchingDueHolds_thenQueryWindowSpansEveryTimezone() {
        when(depositRepository.findPendingWithSavedCard(any(), any())).thenReturn(List.of());
        when(depositRepository.findHeldExpiringBefore(any())).thenReturn(List.of());

        schedulerAt(Instant.parse("2026-10-29T23:10:00Z"), holdService).maintainHolds();

        verify(depositRepository).findPendingWithSavedCard(LocalDate.of(2026, 10, 30), LocalDate.of(2026, 10, 28));
    }

    @Test
    void whenReservationBelongsToAnotherOrg_thenNoHoldIsAttempted() {
        SecurityDeposit pending = deposit(5L, 9L, SecurityDepositStatus.PENDING);
        when(depositRepository.findPendingWithSavedCard(any(), any())).thenReturn(List.of(pending));
        when(depositRepository.findHeldExpiringBefore(any())).thenReturn(List.of());
        when(reservationRepository.findByIdWithGuestAndProperty(9L)).thenReturn(Optional.of(reservation(9L, 2L, 3)));

        schedulerAt(Instant.parse("2026-10-30T08:00:00Z"), holdService).maintainHolds();

        verify(holdService, never()).placeHoldIfDue(any(), any());
    }

    @Test
    void whenOneDepositFails_thenTheOthersAreStillProcessed() {
        SecurityDeposit broken = deposit(5L, 9L, SecurityDepositStatus.PENDING);
        SecurityDeposit healthy = deposit(6L, 10L, SecurityDepositStatus.PENDING);
        Reservation healthyReservation = reservation(10L, ORG, 2);
        when(depositRepository.findPendingWithSavedCard(any(), any())).thenReturn(List.of(broken, healthy));
        when(depositRepository.findHeldExpiringBefore(any())).thenReturn(List.of());
        when(reservationRepository.findByIdWithGuestAndProperty(9L)).thenThrow(new IllegalStateException("boom"));
        when(reservationRepository.findByIdWithGuestAndProperty(10L)).thenReturn(Optional.of(healthyReservation));

        schedulerAt(Instant.parse("2026-10-30T08:00:00Z"), holdService).maintainHolds();

        verify(holdService).placeHoldIfDue(healthy, healthyReservation);
    }

    // ─── Renouvellement / échéance ──────────────────────────────────────────────

    @Test
    void whenHoldLapsesBeforeTheEndOfTheClaimWindow_thenItIsRenewed() {
        Instant now = Instant.parse("2026-11-03T07:10:00Z");
        SecurityDeposit expiring = held(5L, 9L, Instant.parse("2026-11-03T17:10:00Z"));
        Reservation fourNights = reservation(9L, ORG, 4); // réclamation possible jusqu'au 5 novembre
        when(depositRepository.findPendingWithSavedCard(any(), any())).thenReturn(List.of());
        when(depositRepository.findHeldExpiringBefore(now.plus(SecurityDepositHoldPolicy.RENEWAL_MARGIN)))
            .thenReturn(List.of(expiring));
        when(reservationRepository.findByIdWithGuestAndProperty(9L)).thenReturn(Optional.of(fourNights));

        schedulerAt(now, holdService).maintainHolds();

        verify(holdService).renewHold(expiring, fourNights);
    }

    @Test
    void whenHoldOutlivesTheClaimWindow_thenItIsNotRenewed() {
        Instant now = Instant.parse("2026-11-03T07:10:00Z");
        SecurityDeposit expiring = held(5L, 9L, Instant.parse("2026-11-03T17:10:00Z"));
        when(depositRepository.findPendingWithSavedCard(any(), any())).thenReturn(List.of());
        when(depositRepository.findHeldExpiringBefore(any())).thenReturn(List.of(expiring));
        // Une nuit : départ le 31 octobre, réclamation close le 2 novembre.
        when(reservationRepository.findByIdWithGuestAndProperty(9L)).thenReturn(Optional.of(reservation(9L, ORG, 1)));

        schedulerAt(now, holdService).maintainHolds();

        verify(holdService, never()).renewHold(any(), any());
        verify(holdService, never()).reconcileLapsedHold(any(), any());
    }

    @Test
    void whenRenewalWasAlreadyRefused_thenItIsNotRetried() {
        Instant now = Instant.parse("2026-11-03T07:10:00Z");
        SecurityDeposit expiring = held(5L, 9L, Instant.parse("2026-11-03T17:10:00Z"));
        expiring.setHoldError("card_declined");
        when(depositRepository.findPendingWithSavedCard(any(), any())).thenReturn(List.of());
        when(depositRepository.findHeldExpiringBefore(any())).thenReturn(List.of(expiring));
        when(reservationRepository.findByIdWithGuestAndProperty(9L)).thenReturn(Optional.of(reservation(9L, ORG, 4)));

        schedulerAt(now, holdService).maintainHolds();

        verify(holdService, never()).renewHold(any(), any());
    }

    @Test
    void whenHoldIsPastItsExpiry_thenItsLapseIsReconciled() {
        Instant now = Instant.parse("2026-11-03T18:10:00Z");
        SecurityDeposit lapsed = held(5L, 9L, Instant.parse("2026-11-03T17:10:00Z"));
        Reservation reservation = reservation(9L, ORG, 4);
        when(depositRepository.findPendingWithSavedCard(any(), any())).thenReturn(List.of());
        when(depositRepository.findHeldExpiringBefore(any())).thenReturn(List.of(lapsed));
        when(reservationRepository.findByIdWithGuestAndProperty(9L)).thenReturn(Optional.of(reservation));

        schedulerAt(now, holdService).maintainHolds();

        verify(holdService).reconcileLapsedHold(lapsed, reservation);
        verify(holdService, never()).renewHold(any(), any());
    }
}
