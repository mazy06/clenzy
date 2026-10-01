package com.clenzy.booking.service;

import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.SecurityDeposit;
import com.clenzy.model.SecurityDepositStatus;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.SecurityDepositRepository;
import com.clenzy.service.NotificationService;
import com.clenzy.service.SecurityDepositHoldService;
import com.stripe.model.Charge;
import com.stripe.model.PaymentIntent;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Caution du booking engine au paiement du séjour : la carte est enregistrée et la caution reste
 * en attente — la pré-autorisation n'est posée tout de suite que pour une arrivée le jour même.
 */
@ExtendWith(MockitoExtension.class)
class BookingEngineDepositServiceTest {

    private static final Long ORG = 1L;
    private static final Long RESERVATION_ID = 9L;
    private static final Long DEPOSIT_ID = 5L;
    private static final LocalDate ARRIVAL = LocalDate.of(2026, 10, 30);

    @Mock private SecurityDepositRepository depositRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private StripeGateway stripeGateway;
    @Mock private NotificationService notificationService;
    @Mock private ObjectProvider<BookingEngineDepositService> self;

    private BookingEngineDepositService serviceAt(Instant now) {
        SecurityDepositHoldService holdService = new SecurityDepositHoldService(
            depositRepository, stripeGateway, notificationService, Clock.fixed(now, ZoneOffset.UTC));
        BookingEngineDepositService service = new BookingEngineDepositService(
            depositRepository, reservationRepository, stripeGateway, holdService, self);
        when(self.getObject()).thenReturn(service);
        return service;
    }

    private Reservation stubPaidReservation() throws Exception {
        Property property = new Property();
        property.setTimezone("Europe/Paris");
        Reservation reservation = new Reservation();
        reservation.setId(RESERVATION_ID);
        reservation.setOrganizationId(ORG);
        reservation.setProperty(property);
        reservation.setCheckIn(ARRIVAL);
        reservation.setCheckOut(ARRIVAL.plusDays(3));
        reservation.setStatus("confirmed");

        PaymentIntent stay = new PaymentIntent();
        stay.setPaymentMethod("pm_1");
        when(stripeGateway.retrievePaymentIntent("pi_stay")).thenReturn(stay);
        when(depositRepository.findByOrganizationIdAndReservationId(ORG, RESERVATION_ID)).thenReturn(Optional.empty());
        when(depositRepository.save(any(SecurityDeposit.class))).thenAnswer(invocation -> {
            SecurityDeposit saved = invocation.getArgument(0);
            saved.setId(DEPOSIT_ID);
            return saved;
        });
        when(reservationRepository.findById(RESERVATION_ID)).thenReturn(Optional.of(reservation));
        when(reservationRepository.findByIdWithGuestAndProperty(RESERVATION_ID)).thenReturn(Optional.of(reservation));
        return reservation;
    }

    @Test
    void whenStayIsPaidThirtyDaysBeforeArrival_thenCardIsSavedButNoHoldIsPlaced() throws Exception {
        BookingEngineDepositService service = serviceAt(Instant.parse("2026-09-30T10:00:00Z"));
        Reservation reservation = stubPaidReservation();

        service.setupCautionAfterPayment(RESERVATION_ID, ORG, new BigDecimal("300.00"), "EUR", "cus_1", "pi_stay");

        ArgumentCaptor<SecurityDeposit> saved = ArgumentCaptor.forClass(SecurityDeposit.class);
        verify(depositRepository).save(saved.capture());
        assertThat(saved.getValue().getStatus()).isEqualTo(SecurityDepositStatus.PENDING);
        assertThat(reservation.getStripeCustomerId()).isEqualTo("cus_1");
        assertThat(reservation.getStripePaymentMethodId()).isEqualTo("pm_1");
        verify(stripeGateway, never()).createPaymentIntent(any(), anyString());
    }

    @Test
    void whenStayIsPaidOnArrivalDay_thenHoldIsPlacedRightAway() throws Exception {
        BookingEngineDepositService service = serviceAt(Instant.parse("2026-10-30T09:00:00Z"));
        stubPaidReservation();
        Instant captureBefore = Instant.parse("2026-11-04T03:00:00Z");
        when(stripeGateway.createPaymentIntent(any(), eq("deposit-hold-5")))
            .thenReturn(authorized("pi_hold", captureBefore));
        when(depositRepository.markHoldPlaced(DEPOSIT_ID, ORG, SecurityDepositStatus.PENDING, "pi_hold", captureBefore))
            .thenReturn(1);

        service.setupCautionAfterPayment(RESERVATION_ID, ORG, new BigDecimal("300.00"), "EUR", "cus_1", "pi_stay");

        verify(depositRepository).markHoldPlaced(DEPOSIT_ID, ORG, SecurityDepositStatus.PENDING, "pi_hold", captureBefore);
    }

    @Test
    void whenReleasingAHoldStripeAlreadyLetLapse_thenDepositIsReleasedWithoutCancelling() throws Exception {
        BookingEngineDepositService service = serviceAt(Instant.parse("2026-11-05T04:30:00Z"));
        PaymentIntent lapsed = new PaymentIntent();
        lapsed.setId("pi_old");
        lapsed.setStatus("canceled");
        when(stripeGateway.retrievePaymentIntent("pi_old")).thenReturn(lapsed);
        when(depositRepository.transitionStatus(DEPOSIT_ID, ORG,
            SecurityDepositStatus.HELD, SecurityDepositStatus.RELEASED, null)).thenReturn(1);
        SecurityDeposit deposit = new SecurityDeposit();
        deposit.setId(DEPOSIT_ID);
        deposit.setOrganizationId(ORG);
        deposit.setStatus(SecurityDepositStatus.HELD);
        deposit.setExternalRef("pi_old");

        boolean released = service.releaseHold(deposit);

        assertThat(released).isTrue();
        verify(stripeGateway, never()).cancelPaymentIntent(any(), anyString());
        verify(depositRepository).transitionStatus(eq(DEPOSIT_ID), eq(ORG),
            eq(SecurityDepositStatus.HELD), eq(SecurityDepositStatus.RELEASED), isNull());
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
}
