package com.clenzy.it;

import com.clenzy.AbstractIntegrationTest;
import com.clenzy.booking.service.BookingEngineDepositService;
import com.clenzy.model.Organization;
import com.clenzy.model.OrganizationType;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.SecurityDeposit;
import com.clenzy.model.SecurityDepositStatus;
import com.clenzy.model.User;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.SecurityDepositRepository;
import com.clenzy.repository.UserRepository;
import com.stripe.model.Charge;
import com.stripe.model.PaymentIntent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Caution du booking engine dans son VRAI contexte d'appel : {@code confirmBookingEngineCheckout}
 * est {@code @Transactional} et déclenche {@code setupCautionAfterPayment} en {@code afterCommit}.
 * À ce stade Spring garde la transaction commitée liée au thread : sans suspension explicite,
 * les écritures y « participeraient » sans jamais être commitées (et un UPDATE {@code @Modifying}
 * lèverait {@code TransactionRequiredException}). Base réelle, Stripe simulé.
 */
@EnabledIfEnvironmentVariable(named = "CLENZY_IT", matches = "true")
class BookingCautionAfterCommitIT extends AbstractIntegrationTest {

    private static final ZoneId PARIS = ZoneId.of("Europe/Paris");

    @MockBean private StripeGateway stripeGateway;

    @Autowired private BookingEngineDepositService depositService;
    @Autowired private TransactionTemplate transactionTemplate;
    @Autowired private OrganizationRepository organizationRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PropertyRepository propertyRepository;
    @Autowired private ReservationRepository reservationRepository;
    @Autowired private SecurityDepositRepository depositRepository;

    private Long orgId;
    private Property property;

    @BeforeEach
    void seed() throws Exception {
        String salt = UUID.randomUUID().toString().substring(0, 8);
        orgId = organizationRepository.save(new Organization(
                "Caution " + salt, OrganizationType.INDIVIDUAL, "caution-" + salt)).getId();
        User owner = new User("Olga", "Hote", "olga." + salt + "@test.com", "password123");
        owner.setOrganizationId(orgId);
        owner.setKeycloakId("kc-caution-" + salt);
        owner = userRepository.save(owner);
        property = new Property("Studio " + salt, "3 rue C", 1, 1, owner);
        property.setOrganizationId(orgId);
        property.setTimezone("Europe/Paris");
        property = propertyRepository.save(property);

        PaymentIntent stay = new PaymentIntent();
        stay.setPaymentMethod("pm_saved");
        when(stripeGateway.retrievePaymentIntent("pi_stay")).thenReturn(stay);
    }

    @Test
    void whenStayIsPaidThirtyDaysAhead_thenPendingDepositAndSavedCardAreCommitted() throws Exception {
        Long reservationId = seedReservation(LocalDate.now(PARIS).plusDays(30));

        setupCautionAfterCommit(reservationId);

        SecurityDeposit deposit = depositRepository.findByOrganizationIdAndReservationId(orgId, reservationId).orElseThrow();
        assertThat(deposit.getStatus()).isEqualTo(SecurityDepositStatus.PENDING);
        Reservation reloaded = reservationRepository.findById(reservationId).orElseThrow();
        assertThat(reloaded.getStripeCustomerId()).isEqualTo("cus_guest");
        assertThat(reloaded.getStripePaymentMethodId()).isEqualTo("pm_saved");
        verify(stripeGateway, never()).createPaymentIntent(any(), anyString());
    }

    @Test
    void whenStayIsPaidOnArrivalDay_thenHoldAndItsStripeExpiryAreCommitted() throws Exception {
        Long reservationId = seedReservation(LocalDate.now(PARIS));
        Instant captureBefore = Instant.now().plus(4, ChronoUnit.DAYS).truncatedTo(ChronoUnit.SECONDS);
        when(stripeGateway.createPaymentIntent(any(), anyString())).thenReturn(authorized("pi_hold", captureBefore));

        setupCautionAfterCommit(reservationId);

        SecurityDeposit deposit = depositRepository.findByOrganizationIdAndReservationId(orgId, reservationId).orElseThrow();
        assertThat(deposit.getStatus()).isEqualTo(SecurityDepositStatus.HELD);
        assertThat(deposit.getExternalRef()).isEqualTo("pi_hold");
        assertThat(deposit.getHoldExpiresAt()).isEqualTo(captureBefore);
    }

    /** Reproduit le webhook : la caution est mise en place APRÈS le commit de la transaction de paiement. */
    private void setupCautionAfterCommit(Long reservationId) {
        transactionTemplate.executeWithoutResult(status ->
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        depositService.setupCautionAfterPayment(reservationId, orgId, new BigDecimal("300.00"),
                                "EUR", "cus_guest", "pi_stay");
                    }
                }));
    }

    private Long seedReservation(LocalDate checkIn) {
        Reservation reservation = new Reservation();
        reservation.setOrganizationId(orgId);
        reservation.setProperty(property);
        reservation.setCheckIn(checkIn);
        reservation.setCheckOut(checkIn.plusDays(3));
        reservation.setStatus("confirmed");
        return reservationRepository.save(reservation).getId();
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
