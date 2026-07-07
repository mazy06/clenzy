package com.clenzy.service.agent.supervision;

import com.clenzy.model.Reservation;
import com.clenzy.model.SecurityDeposit;
import com.clenzy.model.SecurityDepositStatus;
import com.clenzy.model.ServiceRequest;
import com.clenzy.model.SupervisionSuggestion;
import com.stripe.exception.StripeException;
import com.clenzy.booking.service.BookingBalanceService;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.RateOverrideRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.SecurityDepositRepository;
import com.clenzy.repository.YieldAdjustmentRepository;
import com.clenzy.service.CalendarEngine;
import com.clenzy.service.EmailService;
import com.clenzy.service.PriceEngine;
import com.clenzy.service.SearchCacheInvalidator;
import com.clenzy.service.SecurityDepositPaymentService;
import com.clenzy.service.ServiceRequestService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("SuggestionActionExecutor (apply des suggestions vague 3)")
class SuggestionActionExecutorTest {

    private static final Long ORG_ID = 1L;
    private static final Long PROPERTY_ID = 7L;
    private static final Long RESERVATION_ID = 100L;
    private static final Long DEPOSIT_ID = 9L;

    @Mock private PriceEngine priceEngine;
    @Mock private RateOverrideRepository rateOverrideRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private SearchCacheInvalidator searchCacheInvalidator;
    @Mock private SecurityDepositRepository securityDepositRepository;
    @Mock private SecurityDepositPaymentService securityDepositPaymentService;
    @Mock private CalendarEngine calendarEngine;
    @Mock private YieldAdjustmentRepository yieldAdjustmentRepository;
    @Mock private ServiceRequestService serviceRequestService;
    @Mock private ReservationRepository reservationRepository;
    @Mock private BookingBalanceService bookingBalanceService;
    @Mock private EmailService emailService;

    private final Clock clock = Clock.fixed(Instant.parse("2026-07-02T10:00:00Z"), ZoneId.of("UTC"));

    private SuggestionActionExecutor executor;

    @BeforeEach
    void setUp() {
        executor = new SuggestionActionExecutor(priceEngine, rateOverrideRepository,
                propertyRepository, searchCacheInvalidator, securityDepositRepository,
                securityDepositPaymentService, calendarEngine, yieldAdjustmentRepository,
                serviceRequestService, reservationRepository, bookingBalanceService, emailService,
                new ObjectMapper(), clock);
    }

    private static SupervisionSuggestion suggestion(String actionType, String params) {
        SupervisionSuggestion s = new SupervisionSuggestion(
                ORG_ID, PROPERTY_ID, "fin", null, "titre", "motif", Instant.now());
        s.setId(50L);
        s.setActionType(actionType);
        s.setActionParams(params);
        s.setReservationId(RESERVATION_ID);
        return s;
    }

    private static SecurityDeposit deposit(SecurityDepositStatus status) {
        SecurityDeposit deposit = new SecurityDeposit();
        deposit.setId(DEPOSIT_ID);
        deposit.setOrganizationId(ORG_ID);
        deposit.setReservationId(RESERVATION_ID);
        deposit.setAmount(new BigDecimal("350.00"));
        deposit.setStatus(status);
        return deposit;
    }

    // ── hasExternalEffect : routage transactionnel ────────────────────────────

    @Test
    @DisplayName("hasExternalEffect : vrai pour les actions Stripe caution, faux pour les actions DB")
    void externalEffectRouting() {
        assertThat(executor.hasExternalEffect(SupervisionActionType.DEPOSIT_REFUND)).isTrue();
        assertThat(executor.hasExternalEffect(SupervisionActionType.DEPOSIT_RELEASE)).isTrue();
        assertThat(executor.hasExternalEffect(SupervisionActionType.PRICE_DROP)).isFalse();
        assertThat(executor.hasExternalEffect(SupervisionActionType.CALENDAR_BLOCK)).isFalse();
    }

    // ── DEPOSIT_REFUND / DEPOSIT_RELEASE ─────────────────────────────────────

    @Test
    @DisplayName("caution : etat RE-verifie a l'apply, hold libere via le service Stripe (idempotency deterministe)")
    void depositRefund_reloadsAndReleasesHold() {
        when(securityDepositRepository.findByOrganizationIdAndReservationId(ORG_ID, RESERVATION_ID))
                .thenReturn(Optional.of(deposit(SecurityDepositStatus.HELD)));

        executor.execute(suggestion(SupervisionActionType.DEPOSIT_REFUND, null));

        // Le montant/etat vient du rechargement, jamais de la suggestion ; l'effet
        // Stripe passe par releaseHold (clé idempotente deposit-release-<id> + CAS).
        verify(securityDepositPaymentService).releaseHold(ORG_ID, DEPOSIT_ID);
    }

    @Test
    @DisplayName("caution deja liberee entre-temps -> refus explicite, aucun appel Stripe (recalcul a l'apply)")
    void depositAlreadyReleased_throwsWithoutStripeCall() {
        when(securityDepositRepository.findByOrganizationIdAndReservationId(ORG_ID, RESERVATION_ID))
                .thenReturn(Optional.of(deposit(SecurityDepositStatus.RELEASED)));

        assertThatThrownBy(() -> executor.execute(
                suggestion(SupervisionActionType.DEPOSIT_RELEASE, null)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("RELEASED");
        verifyNoInteractions(securityDepositPaymentService);
    }

    @Test
    @DisplayName("caution introuvable dans l'org de la suggestion -> refus (cross-org impossible)")
    void depositNotFoundInOrg_throws() {
        when(securityDepositRepository.findByOrganizationIdAndReservationId(ORG_ID, RESERVATION_ID))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> executor.execute(
                suggestion(SupervisionActionType.DEPOSIT_REFUND, null)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Aucune caution");
        verifyNoInteractions(securityDepositPaymentService);
    }

    @Test
    @DisplayName("reservationId absent de l'entite -> repli sur les params JSON")
    void reservationIdFallbackFromParams() {
        SupervisionSuggestion s = suggestion(SupervisionActionType.DEPOSIT_REFUND,
                "{\"reservationId\":100,\"depositId\":9}");
        s.setReservationId(null);
        when(securityDepositRepository.findByOrganizationIdAndReservationId(ORG_ID, RESERVATION_ID))
                .thenReturn(Optional.of(deposit(SecurityDepositStatus.HELD)));

        executor.execute(s);

        verify(securityDepositPaymentService).releaseHold(ORG_ID, DEPOSIT_ID);
    }

    // ── CALENDAR_BLOCK ────────────────────────────────────────────────────────

    @Test
    @DisplayName("blocage calendrier : plage [aujourd'hui, +days) via CalendarEngine.block (source SUPERVISION)")
    void calendarBlock_blocksRequestedRange() {
        executor.execute(suggestion(SupervisionActionType.CALENDAR_BLOCK, "{\"days\":10}"));

        LocalDate today = LocalDate.now(clock);
        verify(calendarEngine).block(eq(PROPERTY_ID), eq(today), eq(today.plusDays(10)),
                eq(ORG_ID), eq("SUPERVISION"), anyString(), eq("system:supervisor"));
    }

    @Test
    @DisplayName("blocage calendrier : 7 jours par defaut sans params")
    void calendarBlock_defaultsToSevenDays() {
        executor.execute(suggestion(SupervisionActionType.CALENDAR_BLOCK, null));

        LocalDate today = LocalDate.now(clock);
        verify(calendarEngine).block(eq(PROPERTY_ID), eq(today), eq(today.plusDays(7)),
                eq(ORG_ID), eq("SUPERVISION"), anyString(), eq("system:supervisor"));
    }

    @Test
    @DisplayName("blocage calendrier : duree hors bornes refusee (garde-fou)")
    void calendarBlock_rejectsOutOfBoundsDuration() {
        assertThatThrownBy(() -> executor.execute(
                suggestion(SupervisionActionType.CALENDAR_BLOCK, "{\"days\":90}")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("bornes");
        verifyNoInteractions(calendarEngine);
    }

    @Test
    @DisplayName("type d'action inconnu -> refus explicite")
    void unknownActionType_throws() {
        assertThatThrownBy(() -> executor.execute(suggestion("UNKNOWN_TYPE", null)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("non supporté");
    }

    @Test
    @DisplayName("menage manquant : planifie via createAutomaticCleaningRequest (DB-only)")
    void cleaningRequest_schedulesCleaning() {
        when(serviceRequestService.createAutomaticCleaningRequest(
                eq(ORG_ID), eq(PROPERTY_ID), eq(LocalDate.parse("2026-07-01")),
                eq(LocalDate.parse("2026-07-05")), eq(RESERVATION_ID)))
                .thenReturn(new ServiceRequestService.AutoCleaningOutcome(mock(ServiceRequest.class), null));

        executor.execute(suggestion(SupervisionActionType.CLEANING_REQUEST,
                "{\"reservationId\":100,\"checkIn\":\"2026-07-01\",\"checkOut\":\"2026-07-05\"}"));

        verify(serviceRequestService).createAutomaticCleaningRequest(
                eq(ORG_ID), eq(PROPERTY_ID), any(), eq(LocalDate.parse("2026-07-05")), eq(RESERVATION_ID));
    }

    @Test
    @DisplayName("menage manquant : deja planifie (idempotent) -> pas d'echec")
    void cleaningRequest_idempotentWhenAlreadyExists() {
        when(serviceRequestService.createAutomaticCleaningRequest(anyLong(), anyLong(), any(), any(), any()))
                .thenReturn(new ServiceRequestService.AutoCleaningOutcome(null, "demande deja existante (cle X)"));

        // Ne lève pas : l'objectif (un ménage existe) est atteint.
        executor.execute(suggestion(SupervisionActionType.CLEANING_REQUEST,
                "{\"reservationId\":100,\"checkOut\":\"2026-07-05\"}"));
    }

    @Test
    @DisplayName("menage manquant : skip non idempotent -> echec explicite (carte reste PENDING)")
    void cleaningRequest_throwsOnHardSkip() {
        when(serviceRequestService.createAutomaticCleaningRequest(anyLong(), anyLong(), any(), any(), any()))
                .thenReturn(new ServiceRequestService.AutoCleaningOutcome(null, "propriete sans proprietaire"));

        assertThatThrownBy(() -> executor.execute(suggestion(SupervisionActionType.CLEANING_REQUEST,
                "{\"checkOut\":\"2026-07-05\"}")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("non planifiable");
    }

    @Test
    @DisplayName("relance paiement : lien de solde regenere + email voyageur (effet externe)")
    void paymentReminder_sendsBalanceLinkEmail() throws StripeException {
        Reservation reservation = mock(Reservation.class);
        when(reservation.getOrganizationId()).thenReturn(ORG_ID);
        when(reservation.getPaymentLinkEmail()).thenReturn("guest@example.com");
        when(reservation.getConfirmationCode()).thenReturn("ABC123");
        when(reservation.getGuestName()).thenReturn("Alice");
        when(reservationRepository.findById(RESERVATION_ID)).thenReturn(Optional.of(reservation));
        when(bookingBalanceService.createBalanceCheckoutUrl(ORG_ID, "ABC123"))
                .thenReturn("https://checkout.stripe/abc");

        executor.execute(suggestion(SupervisionActionType.PAYMENT_REMINDER, "{\"reservationId\":100}"));

        verify(emailService).sendSimpleHtmlEmail(eq("guest@example.com"), anyString(),
                contains("https://checkout.stripe/abc"));
    }

    @Test
    @DisplayName("relance paiement : email introuvable -> echec explicite (rien d'envoye)")
    void paymentReminder_throwsWhenNoEmail() {
        Reservation reservation = mock(Reservation.class);
        when(reservation.getOrganizationId()).thenReturn(ORG_ID);
        when(reservation.getPaymentLinkEmail()).thenReturn(null);
        when(reservation.getGuest()).thenReturn(null);
        when(reservationRepository.findById(RESERVATION_ID)).thenReturn(Optional.of(reservation));

        assertThatThrownBy(() -> executor.execute(
                suggestion(SupervisionActionType.PAYMENT_REMINDER, "{\"reservationId\":100}")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("email de paiement");
        verifyNoInteractions(emailService);
    }
}
