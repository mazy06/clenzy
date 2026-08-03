package com.clenzy.service.agent.supervision;

import com.clenzy.model.Guest;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.SecurityDeposit;
import com.clenzy.model.SecurityDepositStatus;
import com.clenzy.model.ServiceRequest;
import com.clenzy.model.SupervisionSuggestion;
import com.stripe.exception.StripeException;
import com.clenzy.booking.service.BookingBalanceService;
import com.clenzy.repository.CalendarDayRepository;
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
    @Mock private CalendarDayRepository calendarDayRepository;
    @Mock private YieldAdjustmentRepository yieldAdjustmentRepository;
    @Mock private ServiceRequestService serviceRequestService;
    @Mock private ReservationRepository reservationRepository;
    @Mock private BookingBalanceService bookingBalanceService;
    @Mock private EmailService emailService;
    @Mock private ReviewReplyDraftService reviewReplyDraftService;
    @Mock private com.clenzy.service.ICalImportService icalImportService;
    @Mock private com.clenzy.integration.channex.service.ChannexSyncService channexSyncService;
    @Mock private com.clenzy.repository.NoiseAlertRepository noiseAlertRepository;
    @Mock private com.clenzy.service.NoiseAlertNotificationService noiseAlertNotificationService;
    @Mock private com.clenzy.scheduler.AbandonedBookingRecoveryScheduler cartRecoveryScheduler;
    @Mock private com.clenzy.service.WelcomeGuideService welcomeGuideService;
    @Mock private com.clenzy.service.payout.HousekeeperPayoutService housekeeperPayoutService;
    @Mock private com.clenzy.service.ReservationService reservationService;
    @Mock private com.clenzy.integration.compliance.submission.ComplianceSubmissionService complianceSubmissionService;
    @Mock private com.clenzy.repository.ManagementContractRepository managementContractRepository;
    @Mock private com.clenzy.service.signature.ContractSignatureService contractSignatureService;
    @Mock private com.clenzy.repository.UserRepository userRepository;
    @Mock private com.clenzy.repository.OrganizationRepository organizationRepository;
    @Mock private com.clenzy.service.OwnerStatementService ownerStatementService;
    @Mock private com.clenzy.repository.MinNightsOverrideRepository minNightsOverrideRepository;
    @Mock private com.clenzy.repository.RatePlanRepository ratePlanRepository;

    private final Clock clock = Clock.fixed(Instant.parse("2026-07-02T10:00:00Z"), ZoneId.of("UTC"));

    private SuggestionActionExecutor executor;

    /** ObjectProvider minimal (les vrais beans sont injectés paresseusement pour casser les cycles). */
    private static <T> org.springframework.beans.factory.ObjectProvider<T> provider(T bean) {
        return new org.springframework.beans.factory.ObjectProvider<>() {
            @Override public T getObject() { return bean; }
        };
    }

    @BeforeEach
    void setUp() {
        executor = new SuggestionActionExecutor(priceEngine, rateOverrideRepository,
                propertyRepository, searchCacheInvalidator, securityDepositRepository,
                securityDepositPaymentService, calendarEngine, calendarDayRepository,
                yieldAdjustmentRepository, serviceRequestService, reservationRepository,
                bookingBalanceService, emailService, reviewReplyDraftService,
                provider(icalImportService), provider(channexSyncService),
                noiseAlertRepository, provider(noiseAlertNotificationService),
                provider(cartRecoveryScheduler), provider(welcomeGuideService),
                provider(housekeeperPayoutService), provider(reservationService),
                provider(complianceSubmissionService), managementContractRepository,
                provider(contractSignatureService), provider(userRepository),
                provider(organizationRepository), provider(ownerStatementService),
                minNightsOverrideRepository, ratePlanRepository,
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
    @DisplayName("brouillon de reponse avis : delegue au service LLM (effet externe, brouillon-seul)")
    void reviewDraftReply_delegatesToDraftService() {
        executor.execute(suggestion(SupervisionActionType.REVIEW_DRAFT_REPLY, "{\"reviewId\":77}"));
        verify(reviewReplyDraftService).generateDraft(ORG_ID, 77L);
    }

    @Test
    @DisplayName("brouillon de reponse avis : reviewId manquant -> echec explicite")
    void reviewDraftReply_throwsWithoutReviewId() {
        assertThatThrownBy(() -> executor.execute(
                suggestion(SupervisionActionType.REVIEW_DRAFT_REPLY, "{}")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("reviewId");
        verifyNoInteractions(reviewReplyDraftService);
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

    @Test
    @DisplayName("relance iCal : delegue a ICalImportService avec l'org de la suggestion")
    void icalRetry_delegatesWithSuggestionOrg() {
        executor.execute(suggestion(SupervisionActionType.ICAL_RETRY, "{\"feedId\":42}"));
        verify(icalImportService).retryFeedForSupervision(42L, ORG_ID);
    }

    @Test
    @DisplayName("relance iCal : feedId manquant -> echec explicite (rien de relance)")
    void icalRetry_throwsWithoutFeedId() {
        assertThatThrownBy(() -> executor.execute(
                suggestion(SupervisionActionType.ICAL_RETRY, "{}")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("feedId");
        verifyNoInteractions(icalImportService);
    }

    @Test
    @DisplayName("republication parite : pousse l'ARI sur la fenetre bornee via ChannexSyncService")
    void parityRepublish_pushesBoundedWindow() {
        when(channexSyncService.pushProperty(eq(PROPERTY_ID), eq(ORG_ID), any(), any()))
                .thenReturn(new com.clenzy.integration.channex.service.ChannexSyncService
                        .ChannexSyncResult(true, "ok", 0, 12));

        executor.execute(suggestion(SupervisionActionType.PARITY_REPUBLISH, "{\"days\":30}"));

        LocalDate today = LocalDate.now(clock);
        verify(channexSyncService).pushProperty(PROPERTY_ID, ORG_ID, today, today.plusDays(30));
    }

    @Test
    @DisplayName("republication parite : echec Channex -> l'apply echoue (carte reste PENDING)")
    void parityRepublish_throwsOnChannexFailure() {
        when(channexSyncService.pushProperty(eq(PROPERTY_ID), eq(ORG_ID), any(), any()))
                .thenReturn(new com.clenzy.integration.channex.service.ChannexSyncService
                        .ChannexSyncResult(false, "mapping disabled", 0, 0));

        assertThatThrownBy(() -> executor.execute(
                suggestion(SupervisionActionType.PARITY_REPUBLISH, "{\"days\":30}")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Republication Channex");
    }

    @Test
    @DisplayName("avertissement bruit : org validee puis envoi delegue au service de notification")
    void noiseWarningSend_validatesOrgAndSends() {
        com.clenzy.model.NoiseAlert alert = new com.clenzy.model.NoiseAlert();
        alert.setOrganizationId(ORG_ID);
        when(noiseAlertRepository.findById(66L)).thenReturn(Optional.of(alert));
        when(noiseAlertNotificationService.sendGuestWarning(alert)).thenReturn(
                new com.clenzy.service.NoiseAlertNotificationService.GuestWarningOutcome(
                        true, "whatsapp", null));

        executor.execute(suggestion(SupervisionActionType.NOISE_WARNING_SEND, "{\"alertId\":66}"));

        verify(noiseAlertNotificationService).sendGuestWarning(alert);
    }

    @Test
    @DisplayName("avertissement bruit : alerte d'une autre org -> echec explicite, rien d'envoye")
    void noiseWarningSend_rejectsForeignOrg() {
        com.clenzy.model.NoiseAlert alert = new com.clenzy.model.NoiseAlert();
        alert.setOrganizationId(999L);
        when(noiseAlertRepository.findById(66L)).thenReturn(Optional.of(alert));

        assertThatThrownBy(() -> executor.execute(
                suggestion(SupervisionActionType.NOISE_WARNING_SEND, "{\"alertId\":66}")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("organisation");
        verifyNoInteractions(noiseAlertNotificationService);
    }

    @Test
    @DisplayName("avertissement bruit : envoi ignore par le service -> echec explicite (carte PENDING)")
    void noiseWarningSend_throwsWhenSkipped() {
        com.clenzy.model.NoiseAlert alert = new com.clenzy.model.NoiseAlert();
        alert.setOrganizationId(ORG_ID);
        when(noiseAlertRepository.findById(66L)).thenReturn(Optional.of(alert));
        when(noiseAlertNotificationService.sendGuestWarning(alert)).thenReturn(
                new com.clenzy.service.NoiseAlertNotificationService.GuestWarningOutcome(
                        false, null, "deja averti sous 24 h"));

        assertThatThrownBy(() -> executor.execute(
                suggestion(SupervisionActionType.NOISE_WARNING_SEND, "{\"alertId\":66}")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("deja averti");
    }

    @Test
    @DisplayName("relance panier : delegue au scheduler avec l'org de la suggestion")
    void cartRecoverySend_delegatesWithSuggestionOrg() {
        executor.execute(suggestion(SupervisionActionType.CART_RECOVERY_SEND,
                "{\"abandonedBookingId\":31}"));
        verify(cartRecoveryScheduler).sendRecoveryForSupervision(31L, ORG_ID);
    }

    private Reservation guestReservation(String email) {
        Reservation reservation = mock(Reservation.class);
        when(reservation.getOrganizationId()).thenReturn(ORG_ID);
        // lenient : le nom n'est lu que sur le chemin d'envoi réussi.
        org.mockito.Mockito.lenient().when(reservation.getGuestName()).thenReturn("Amina Benali");
        Guest guest = mock(Guest.class);
        when(guest.getEmail()).thenReturn(email);
        when(reservation.getGuest()).thenReturn(guest);
        when(reservationRepository.findById(RESERVATION_ID)).thenReturn(Optional.of(reservation));
        return reservation;
    }

    @Test
    @DisplayName("envoi livret : genere le lien borne au sejour et envoie l'email au voyageur")
    void guideSend_generatesLinkAndSendsEmail() {
        Reservation reservation = guestReservation("amina@example.com");
        when(welcomeGuideService.linkForReservation(reservation))
                .thenReturn(Optional.of("https://app/guide/tok-1"));

        executor.execute(suggestion(SupervisionActionType.GUIDE_SEND, "{\"reservationId\":100}"));

        verify(emailService).sendSimpleHtmlEmail(eq("amina@example.com"), anyString(),
                contains("https://app/guide/tok-1"));
    }

    @Test
    @DisplayName("envoi livret : aucun livret publie -> echec explicite, rien d'envoye")
    void guideSend_throwsWithoutPublishedGuide() {
        Reservation reservation = guestReservation("amina@example.com");
        when(welcomeGuideService.linkForReservation(reservation)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> executor.execute(
                suggestion(SupervisionActionType.GUIDE_SEND, "{\"reservationId\":100}")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("livret");
        verifyNoInteractions(emailService);
    }

    @Test
    @DisplayName("demande d'avis : genere le lien d'avis borne et envoie l'email au voyageur")
    void reviewRequestSend_generatesReviewLinkAndSendsEmail() {
        Reservation reservation = guestReservation("amina@example.com");
        when(welcomeGuideService.reviewLinkForReservation(reservation))
                .thenReturn(Optional.of("https://app/guide/tok-review"));

        executor.execute(suggestion(SupervisionActionType.REVIEW_REQUEST_SEND,
                "{\"reservationId\":100}"));

        verify(emailService).sendSimpleHtmlEmail(eq("amina@example.com"), anyString(),
                contains("https://app/guide/tok-review"));
    }

    @Test
    @DisplayName("versement menage : delegue a retryPayout (re-gate complet cote service)")
    void cleaningPayout_delegatesToRetryPayout() {
        executor.execute(suggestion(SupervisionActionType.CLEANING_PAYOUT, "{\"recordId\":12}"));
        verify(housekeeperPayoutService).retryPayout(12L, ORG_ID);
    }

    @Test
    @DisplayName("blocage fraude : reservation pending -> annulation via ReservationService")
    void fraudBlock_cancelsPendingReservation() {
        Reservation reservation = mock(Reservation.class);
        when(reservation.getOrganizationId()).thenReturn(ORG_ID);
        when(reservation.getStatus()).thenReturn("pending");
        when(reservation.getId()).thenReturn(RESERVATION_ID);
        when(reservationRepository.findById(RESERVATION_ID)).thenReturn(Optional.of(reservation));

        executor.execute(suggestion(SupervisionActionType.FRAUD_BLOCK, "{\"reservationId\":100}"));

        verify(reservationService).cancel(RESERVATION_ID);
    }

    @Test
    @DisplayName("blocage fraude : reservation deja confirmee -> refus explicite, pas d'annulation")
    void fraudBlock_refusesConfirmedReservation() {
        Reservation reservation = mock(Reservation.class);
        when(reservation.getOrganizationId()).thenReturn(ORG_ID);
        when(reservation.getStatus()).thenReturn("confirmed");
        when(reservationRepository.findById(RESERVATION_ID)).thenReturn(Optional.of(reservation));

        assertThatThrownBy(() -> executor.execute(
                suggestion(SupervisionActionType.FRAUD_BLOCK, "{\"reservationId\":100}")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("fiche réservation");
        verifyNoInteractions(reservationService);
    }

    @Test
    @DisplayName("fiche police : org validee puis soumission de toutes les fiches du sejour")
    void policeDeclare_submitsForReservation() {
        Reservation reservation = mock(Reservation.class);
        when(reservation.getOrganizationId()).thenReturn(ORG_ID);
        when(reservation.getId()).thenReturn(RESERVATION_ID);
        when(reservationRepository.findById(RESERVATION_ID)).thenReturn(Optional.of(reservation));

        executor.execute(suggestion(SupervisionActionType.POLICE_DECLARE, "{\"reservationId\":100}"));

        verify(complianceSubmissionService).submitForReservation(RESERVATION_ID, ORG_ID);
    }

    @Test
    @DisplayName("mandat : proprietaire sans email -> echec explicite, aucune demande emise")
    void mandateSignSend_throwsWithoutOwnerEmail() {
        com.clenzy.model.ManagementContract contract = new com.clenzy.model.ManagementContract();
        contract.setOwnerId(9L);
        when(managementContractRepository.findByIdAndOrgId(5L, ORG_ID))
                .thenReturn(Optional.of(contract));
        when(userRepository.findById(9L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> executor.execute(
                suggestion(SupervisionActionType.MANDATE_SIGN_SEND, "{\"contractId\":5}")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("email");
        verifyNoInteractions(contractSignatureService);
    }

    @Test
    @DisplayName("releve proprietaire : periode parsee puis delegation a sendStatement")
    void ownerStatementSend_delegatesWithPeriod() {
        when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.empty());

        executor.execute(suggestion(SupervisionActionType.OWNER_STATEMENT_SEND,
                "{\"ownerId\":9,\"from\":\"2026-07-01\",\"to\":\"2026-07-31\"}"));

        verify(ownerStatementService).sendStatement(9L, ORG_ID,
                LocalDate.parse("2026-07-01"), LocalDate.parse("2026-07-31"), "Votre conciergerie");
    }

    @Test
    @DisplayName("min-stay : ecrit les vendredis/samedis de la fenetre, jamais par-dessus une autre source")
    void minStayRestriction_writesWeekendsOnly_respectsForeignSources() {
        Property property = new Property();
        property.setId(PROPERTY_ID);
        property.setOrganizationId(ORG_ID);
        when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property));
        // ven 2026-07-03 : override MANUAL existant → jamais écrasé.
        com.clenzy.model.MinNightsOverride manual = new com.clenzy.model.MinNightsOverride(
                property, LocalDate.parse("2026-07-03"), 3, "MANUAL", ORG_ID);
        when(minNightsOverrideRepository.findByPropertyIdAndDate(
                eq(PROPERTY_ID), any(), eq(ORG_ID))).thenReturn(Optional.empty());
        when(minNightsOverrideRepository.findByPropertyIdAndDate(
                PROPERTY_ID, LocalDate.parse("2026-07-03"), ORG_ID)).thenReturn(Optional.of(manual));

        executor.execute(suggestion(SupervisionActionType.MIN_STAY_RESTRICTION,
                "{\"from\":\"2026-07-03\",\"to\":\"2026-07-10\",\"minNights\":2,\"weekendsOnly\":true}"));

        // Fenêtre 03→10 : ven 03 (MANUAL, sauté), sam 04, ven 10 exclu → 1 seule écriture (04).
        verify(minNightsOverrideRepository, org.mockito.Mockito.times(1))
                .save(any(com.clenzy.model.MinNightsOverride.class));
    }

    @Test
    @DisplayName("desactivation promo : org validee puis isActive=false")
    void promoDeactivate_validatesOrgAndDisables() {
        com.clenzy.model.RatePlan plan = new com.clenzy.model.RatePlan();
        org.springframework.test.util.ReflectionTestUtils.setField(plan, "organizationId", ORG_ID);
        when(ratePlanRepository.findById(4L)).thenReturn(Optional.of(plan));

        executor.execute(suggestion(SupervisionActionType.PROMO_DEACTIVATE, "{\"ratePlanId\":4}"));

        verify(ratePlanRepository).save(plan);
        assertThat(plan.getIsActive()).isFalse();
    }
}
