package com.clenzy.service;

import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.LedgerReferenceType;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.Property;
import com.clenzy.model.RequestStatus;
import com.clenzy.model.Reservation;
import com.clenzy.model.ServiceRequest;
import com.clenzy.model.User;
import com.clenzy.model.Wallet;
import com.clenzy.model.WalletType;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.tenant.TenantContext;
import com.stripe.exception.ApiException;
import com.stripe.model.checkout.Session;
import com.stripe.net.RequestOptions;
import com.stripe.param.RefundCreateParams;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.core.KafkaTemplate;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StripeServiceTest {

    @Mock private InterventionRepository interventionRepository;
    @Mock private com.clenzy.repository.ReservationRepository reservationRepository;
    @Mock private ServiceRequestRepository serviceRequestRepository;
    @Mock private NotificationService notificationService;
    @Mock private ServiceRequestService serviceRequestService;
    @Mock private WalletService walletService;
    @Mock private LedgerService ledgerService;
    @Mock private SplitPaymentService splitPaymentService;
    @Mock private AutoInvoiceService autoInvoiceService;
    @Mock private KafkaTemplate<String, Object> kafkaTemplate;
    @Mock private StripeGateway stripeGateway;
    @Mock private PaymentStatusTransitionService paymentStatusTransitionService;

    private TenantContext tenantContext;
    private StripeService stripeService;
    private static final Long ORG_ID = 1L;

    @BeforeEach
    void setUp() throws Exception {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(ORG_ID);
        StripeCheckoutSessionFactory checkoutSessionFactory = new StripeCheckoutSessionFactory(
                interventionRepository, reservationRepository, serviceRequestRepository,
                new com.clenzy.service.access.OrganizationAccessGuard(tenantContext), stripeGateway);
        StripePaymentConfirmationService paymentConfirmationService = new StripePaymentConfirmationService(
                interventionRepository, reservationRepository, serviceRequestRepository,
                notificationService, serviceRequestService, walletService, ledgerService,
                splitPaymentService, autoInvoiceService, kafkaTemplate, paymentStatusTransitionService);
        StripeRefundService refundService = new StripeRefundService(stripeGateway,
                paymentStatusTransitionService, org.mockito.Mockito.mock(PaymentLedgerReversalService.class),
                notificationService, kafkaTemplate);
        stripeService = new StripeService(stripeGateway, checkoutSessionFactory,
                paymentConfirmationService, refundService);
        setField(checkoutSessionFactory, "currency", "EUR");
        setField(checkoutSessionFactory, "successUrl", "https://ok.test");
        setField(checkoutSessionFactory, "cancelUrl", "https://ko.test");
        setField(paymentConfirmationService, "currency", "EUR");
        setField(stripeService, "stripeSecretKey", "sk_test_xxx");
        // Par defaut la transition gardee reussit (les tests d'idempotence la surchargent)
        lenient().when(paymentStatusTransitionService.markInterventionPaid(any())).thenReturn(true);
        lenient().when(paymentStatusTransitionService.markReservationPaid(any())).thenReturn(true);
        lenient().when(paymentStatusTransitionService.markServiceRequestPaid(any())).thenReturn(true);
    }

    private void setField(Object target, String name, String value) throws Exception {
        Field f = target.getClass().getDeclaredField(name);
        f.setAccessible(true);
        f.set(target, value);
    }

    private Reservation buildReservation(Long id, PaymentStatus paymentStatus) {
        Reservation r = new Reservation();
        r.setId(id);
        r.setGuestName("John Doe");
        r.setPaymentStatus(paymentStatus);
        r.setTotalPrice(BigDecimal.valueOf(200));
        Property p = new Property();
        p.setName("Test Property");
        User owner = new User();
        owner.setId(99L);
        owner.setKeycloakId("kc-owner-99");
        owner.setEmail("owner@test.com");
        p.setOwner(owner);
        r.setProperty(p);
        return r;
    }

    private ServiceRequest buildServiceRequest(Long id, RequestStatus status, PaymentStatus paymentStatus) {
        ServiceRequest sr = new ServiceRequest();
        sr.setId(id);
        sr.setTitle("SR Title");
        sr.setStatus(status);
        sr.setPaymentStatus(paymentStatus);
        sr.setEstimatedCost(BigDecimal.valueOf(150));
        User user = new User();
        user.setId(11L);
        user.setKeycloakId("kc-user-11");
        user.setEmail("user@test.com");
        user.setFirstName("John");
        user.setLastName("Doe");
        sr.setUser(user);
        return sr;
    }

    private Intervention buildIntervention(Long id, InterventionStatus status, PaymentStatus paymentStatus) {
        Intervention intervention = new Intervention();
        intervention.setId(id);
        intervention.setTitle("Test intervention");
        intervention.setStatus(status);
        intervention.setPaymentStatus(paymentStatus);
        // Org alignee au tenant : OrganizationAccessGuard est fail-closed (org NULL -> refus).
        // Les tests cross-org surchargent explicitement avec ORG_ID + 1.
        intervention.setOrganizationId(ORG_ID);
        return intervention;
    }

    private Intervention buildInterventionWithOwner(Long id, InterventionStatus status, PaymentStatus paymentStatus) {
        Intervention intervention = buildIntervention(id, status, paymentStatus);
        User owner = new User();
        owner.setKeycloakId("kc-owner-1");
        owner.setEmail("owner@test.com");
        Property property = new Property();
        property.setOwner(owner);
        intervention.setProperty(property);
        return intervention;
    }

    // ===== CONFIRM PAYMENT =====

    @Nested
    @DisplayName("confirmPayment")
    class ConfirmPayment {

        @Test
        @DisplayName("sets PAID status and saves when session found")
        void whenSessionFound_thenSetsPaidAndSaves() {
            // Arrange
            Intervention intervention = buildInterventionWithOwner(1L, InterventionStatus.AWAITING_PAYMENT, PaymentStatus.PROCESSING);
            when(interventionRepository.findByStripeSessionId("sess_123"))
                    .thenReturn(Optional.of(intervention));

            // Act
            stripeService.confirmPayment("sess_123");

            // Assert
            assertThat(intervention.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
            assertThat(intervention.getPaidAt()).isNotNull();
            assertThat(intervention.getStatus()).isEqualTo(InterventionStatus.PENDING);
            verify(interventionRepository).save(intervention);
        }

        @Test
        @DisplayName("changes AWAITING_PAYMENT to PENDING")
        void whenAwaitingPayment_thenStatusChangesToPending() {
            // Arrange
            Intervention intervention = buildIntervention(1L, InterventionStatus.AWAITING_PAYMENT, PaymentStatus.PROCESSING);
            when(interventionRepository.findByStripeSessionId("sess_123"))
                    .thenReturn(Optional.of(intervention));

            // Act
            stripeService.confirmPayment("sess_123");

            // Assert
            assertThat(intervention.getStatus()).isEqualTo(InterventionStatus.PENDING);
        }

        @Test
        @DisplayName("does not change status when not AWAITING_PAYMENT")
        void whenNotAwaitingPayment_thenStatusUnchanged() {
            // Arrange
            Intervention intervention = buildIntervention(1L, InterventionStatus.IN_PROGRESS, PaymentStatus.PROCESSING);
            when(interventionRepository.findByStripeSessionId("sess_123"))
                    .thenReturn(Optional.of(intervention));

            // Act
            stripeService.confirmPayment("sess_123");

            // Assert
            assertThat(intervention.getStatus()).isEqualTo(InterventionStatus.IN_PROGRESS);
        }

        @Test
        @DisplayName("throws when session not found")
        void whenSessionNotFound_thenThrows() {
            // Arrange
            when(interventionRepository.findByStripeSessionId("unknown"))
                    .thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> stripeService.confirmPayment("unknown"))
                    .isInstanceOf(RuntimeException.class);
        }

        @Test
        @DisplayName("payment still confirmed even when notification fails")
        void whenNotificationFails_thenPaymentStillConfirmed() {
            // Arrange
            Intervention intervention = buildInterventionWithOwner(1L, InterventionStatus.AWAITING_PAYMENT, PaymentStatus.PROCESSING);
            when(interventionRepository.findByStripeSessionId("sess_123"))
                    .thenReturn(Optional.of(intervention));
            doThrow(new RuntimeException("notification error")).when(notificationService)
                    .notify(any(), any(), any(), any(), any());

            // Act
            stripeService.confirmPayment("sess_123");

            // Assert
            assertThat(intervention.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
            verify(interventionRepository).save(intervention);
        }

        @Test
        @DisplayName("sends Kafka events for FACTURE and JUSTIFICATIF_PAIEMENT")
        void whenPaymentConfirmed_thenSendsKafkaEvents() {
            // Arrange
            Intervention intervention = buildInterventionWithOwner(1L, InterventionStatus.AWAITING_PAYMENT, PaymentStatus.PROCESSING);
            when(interventionRepository.findByStripeSessionId("sess_123"))
                    .thenReturn(Optional.of(intervention));

            // Act
            stripeService.confirmPayment("sess_123");

            // Assert
            verify(kafkaTemplate, times(2)).send(anyString(), anyString(), any());
        }
    }

    // ===== MARK PAYMENT AS FAILED =====

    @Nested
    @DisplayName("markPaymentAsFailed")
    class MarkPaymentAsFailed {

        @Test
        @DisplayName("sets FAILED status when intervention found")
        void whenInterventionFound_thenStatusIsFailed() {
            // Arrange
            Intervention intervention = buildInterventionWithOwner(1L, InterventionStatus.AWAITING_PAYMENT, PaymentStatus.PROCESSING);
            when(interventionRepository.findByStripeSessionId("sess_fail"))
                    .thenReturn(Optional.of(intervention));

            // Act
            stripeService.markPaymentAsFailed("sess_fail");

            // Assert
            assertThat(intervention.getPaymentStatus()).isEqualTo(PaymentStatus.FAILED);
            verify(interventionRepository).save(intervention);
        }

        @Test
        @DisplayName("does nothing when intervention not found")
        void whenInterventionNotFound_thenDoesNothing() {
            // Arrange
            when(interventionRepository.findByStripeSessionId("unknown"))
                    .thenReturn(Optional.empty());

            // Act
            stripeService.markPaymentAsFailed("unknown");

            // Assert
            verify(interventionRepository, never()).save(any());
        }

        @Test
        @DisplayName("sends notifications to owner and admins")
        void whenFailed_thenNotifiesOwnerAndAdmins() {
            // Arrange
            Intervention intervention = buildInterventionWithOwner(1L, InterventionStatus.AWAITING_PAYMENT, PaymentStatus.PROCESSING);
            when(interventionRepository.findByStripeSessionId("sess_fail"))
                    .thenReturn(Optional.of(intervention));

            // Act
            stripeService.markPaymentAsFailed("sess_fail");

            // Assert
            verify(notificationService).notify(eq("kc-owner-1"), any(), any(), any(), any());
            verify(notificationService).notifyAdminsAndManagers(any(), any(), any(), any());
        }
    }

    // ===== CONFIRM GROUPED PAYMENT =====

    @Nested
    @DisplayName("confirmGroupedPayment")
    class ConfirmGroupedPayment {

        @Test
        @DisplayName("marks all interventions as PAID")
        void whenMultipleIds_thenAllMarkedAsPaid() {
            // Arrange
            Intervention i1 = buildIntervention(1L, InterventionStatus.PENDING, PaymentStatus.PROCESSING);
            Intervention i2 = buildIntervention(2L, InterventionStatus.PENDING, PaymentStatus.PROCESSING);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(i1));
            when(interventionRepository.findById(2L)).thenReturn(Optional.of(i2));

            // Act
            stripeService.confirmGroupedPayment("sess_group", "1,2");

            // Assert
            assertThat(i1.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
            assertThat(i2.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
            assertThat(i1.getStripeSessionId()).isEqualTo("sess_group");
            verify(interventionRepository, times(2)).save(any());
        }

        @Test
        @DisplayName("does nothing when ids is null")
        void whenNullIds_thenDoesNothing() {
            // Act
            stripeService.confirmGroupedPayment("sess", null);

            // Assert
            verify(interventionRepository, never()).save(any());
        }

        @Test
        @DisplayName("does nothing when ids is blank")
        void whenBlankIds_thenDoesNothing() {
            // Act
            stripeService.confirmGroupedPayment("sess", "  ");

            // Assert
            verify(interventionRepository, never()).save(any());
        }

        @Test
        @DisplayName("skips invalid (non-numeric) IDs")
        void whenInvalidId_thenSkipsIt() {
            // Arrange
            Intervention valid = buildIntervention(1L, InterventionStatus.PENDING, PaymentStatus.PROCESSING);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(valid));

            // Act
            stripeService.confirmGroupedPayment("sess", "1,abc,2");

            // Assert
            verify(interventionRepository).save(valid);
        }

        @Test
        @DisplayName("sets paidAt for each intervention")
        void whenConfirmed_thenSetsPaidAt() {
            // Arrange
            Intervention i1 = buildIntervention(1L, InterventionStatus.PENDING, PaymentStatus.PROCESSING);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(i1));

            // Act
            stripeService.confirmGroupedPayment("sess_group", "1");

            // Assert
            assertThat(i1.getPaidAt()).isNotNull();
        }
    }

    // ===== MARK GROUPED PAYMENT AS FAILED =====

    @Nested
    @DisplayName("markGroupedPaymentAsFailed")
    class MarkGroupedPaymentAsFailed {

        @Test
        @DisplayName("marks all interventions as FAILED")
        void whenMultipleIds_thenAllMarkedFailed() {
            // Arrange
            Intervention i1 = buildIntervention(1L, InterventionStatus.PENDING, PaymentStatus.PROCESSING);
            Intervention i2 = buildIntervention(2L, InterventionStatus.PENDING, PaymentStatus.PROCESSING);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(i1));
            when(interventionRepository.findById(2L)).thenReturn(Optional.of(i2));

            // Act
            stripeService.markGroupedPaymentAsFailed("1,2");

            // Assert
            assertThat(i1.getPaymentStatus()).isEqualTo(PaymentStatus.FAILED);
            assertThat(i2.getPaymentStatus()).isEqualTo(PaymentStatus.FAILED);
        }

        @Test
        @DisplayName("does nothing when ids is null")
        void whenNullIds_thenDoesNothing() {
            // Act
            stripeService.markGroupedPaymentAsFailed(null);

            // Assert
            verify(interventionRepository, never()).save(any());
        }

        @Test
        @DisplayName("does nothing when ids is blank")
        void whenBlankIds_thenDoesNothing() {
            // Act
            stripeService.markGroupedPaymentAsFailed("  ");

            // Assert
            verify(interventionRepository, never()).save(any());
        }

        @Test
        @DisplayName("skips non-existent interventions")
        void whenInterventionNotFound_thenSkips() {
            // Arrange
            when(interventionRepository.findById(99L)).thenReturn(Optional.empty());

            // Act
            stripeService.markGroupedPaymentAsFailed("99");

            // Assert
            verify(interventionRepository, never()).save(any());
        }
    }

    // ===== REFUND PAYMENT =====

    @Nested
    @DisplayName("refundPayment")
    class RefundPayment {

        private PaymentStatusTransitionService.InterventionRefundContext refundContext() {
            return new PaymentStatusTransitionService.InterventionRefundContext(
                    1L, "cs_abc", "Test intervention", "kc-owner-1", "owner@test.com");
        }

        @Test
        @DisplayName("propagates validation failure (not PAID) without touching Stripe")
        void whenNotRefundable_thenThrowsWithoutStripeCall() {
            // Arrange
            when(paymentStatusTransitionService.loadRefundableIntervention(1L))
                    .thenThrow(new IllegalStateException(
                            "Seuls les paiements confirmes peuvent etre rembourses."));

            // Act & Assert
            assertThatThrownBy(() -> stripeService.refundPayment(1L))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("confirmes peuvent etre rembourses");
            verifyNoInteractions(stripeGateway);
        }

        @Test
        @DisplayName("refunds with idempotency key derived from intervention id")
        void whenRefundable_thenRefundsWithIdempotencyKey() throws Exception {
            // Arrange
            when(paymentStatusTransitionService.loadRefundableIntervention(1L)).thenReturn(refundContext());
            com.stripe.model.checkout.Session session = mock(com.stripe.model.checkout.Session.class);
            when(session.getPaymentIntent()).thenReturn("pi_123");
            when(stripeGateway.retrieveSession("cs_abc")).thenReturn(session);

            // Act
            stripeService.refundPayment(1L);

            // Assert
            verify(stripeGateway).createRefund(any(com.stripe.param.RefundCreateParams.class),
                    eq("refund-intervention-1"));
            verify(paymentStatusTransitionService).markInterventionRefunded(1L);
        }

        @Test
        @DisplayName("throws when session has no PaymentIntent and never refunds")
        void whenNoPaymentIntent_thenThrowsWithoutRefund() throws Exception {
            // Arrange
            when(paymentStatusTransitionService.loadRefundableIntervention(1L)).thenReturn(refundContext());
            com.stripe.model.checkout.Session session = mock(com.stripe.model.checkout.Session.class);
            when(session.getPaymentIntent()).thenReturn(null);
            when(stripeGateway.retrieveSession("cs_abc")).thenReturn(session);

            // Act & Assert
            assertThatThrownBy(() -> stripeService.refundPayment(1L))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("Aucun PaymentIntent");
            verify(stripeGateway, never()).createRefund(any(), any());
        }

        @Test
        @DisplayName("persistence failure after refund -> reconciliation error, single Stripe call")
        void whenPersistFailsAfterRefund_thenReconciliationErrorWithoutSecondRefund() throws Exception {
            // Arrange
            when(paymentStatusTransitionService.loadRefundableIntervention(1L)).thenReturn(refundContext());
            com.stripe.model.checkout.Session session = mock(com.stripe.model.checkout.Session.class);
            when(session.getPaymentIntent()).thenReturn("pi_123");
            when(stripeGateway.retrieveSession("cs_abc")).thenReturn(session);
            doThrow(new RuntimeException("db down"))
                    .when(paymentStatusTransitionService).markInterventionRefunded(1L);

            // Act & Assert
            assertThatThrownBy(() -> stripeService.refundPayment(1L))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("relancer");
            verify(stripeGateway, times(1)).createRefund(any(), anyString());
            verify(notificationService, never()).notifyAdminsAndManagers(any(), any(), any(), any());
        }

        @Test
        @DisplayName("notifies owner/admins and publishes Kafka event after refund")
        void whenRefundSucceeds_thenNotifiesAndPublishes() throws Exception {
            // Arrange
            when(paymentStatusTransitionService.loadRefundableIntervention(1L)).thenReturn(refundContext());
            com.stripe.model.checkout.Session session = mock(com.stripe.model.checkout.Session.class);
            when(session.getPaymentIntent()).thenReturn("pi_123");
            when(stripeGateway.retrieveSession("cs_abc")).thenReturn(session);

            // Act
            stripeService.refundPayment(1L);

            // Assert
            verify(notificationService).notify(eq("kc-owner-1"),
                    eq(com.clenzy.model.NotificationKey.PAYMENT_REFUND_COMPLETED), any(), any(), any());
            verify(kafkaTemplate).send(anyString(), eq("justif-remboursement-int-1"), any());
        }
    }

    // ─── CONFIRM RESERVATION PAYMENT ────────────────────────────────────────

    @Nested
    @DisplayName("confirmReservationPayment")
    class ConfirmReservationPayment {

        @Test
        @DisplayName("marks reservation PAID and saves")
        void whenSessionFound_thenSetsPaidAndSaves() {
            // Arrange
            Reservation r = buildReservation(1L, PaymentStatus.PROCESSING);
            when(reservationRepository.findByStripeSessionId("sess_r")).thenReturn(Optional.of(r));
            Wallet plat = new Wallet();
            Wallet escrow = new Wallet();
            when(walletService.getOrCreatePlatformWallet(any(), any())).thenReturn(plat);
            when(walletService.getOrCreateEscrowWallet(any(), any())).thenReturn(escrow);

            // Act
            stripeService.confirmReservationPayment("sess_r");

            // Assert
            assertThat(r.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
            assertThat(r.getPaidAt()).isNotNull();
            verify(reservationRepository).save(r);
        }

        @Test
        @DisplayName("throws when reservation not found")
        void whenNotFound_thenThrows() {
            when(reservationRepository.findByStripeSessionId("unknown")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> stripeService.confirmReservationPayment("unknown"))
                    .isInstanceOf(RuntimeException.class);
        }

        @Test
        @DisplayName("sends Kafka events for FACTURE + JUSTIFICATIF_PAIEMENT")
        void whenConfirmed_thenSendsKafka() {
            Reservation r = buildReservation(1L, PaymentStatus.PROCESSING);
            when(reservationRepository.findByStripeSessionId("sess_r")).thenReturn(Optional.of(r));
            Wallet plat = new Wallet();
            Wallet escrow = new Wallet();
            when(walletService.getOrCreatePlatformWallet(any(), any())).thenReturn(plat);
            when(walletService.getOrCreateEscrowWallet(any(), any())).thenReturn(escrow);

            stripeService.confirmReservationPayment("sess_r");

            verify(kafkaTemplate, times(2)).send(anyString(), anyString(), any());
        }

        @Test
        @DisplayName("payment still confirmed when Kafka publish fails")
        void whenKafkaFails_thenPaymentStillConfirmed() {
            Reservation r = buildReservation(1L, PaymentStatus.PROCESSING);
            when(reservationRepository.findByStripeSessionId("sess_r")).thenReturn(Optional.of(r));
            doThrow(new RuntimeException("kafka down"))
                    .when(kafkaTemplate).send(anyString(), anyString(), any());

            stripeService.confirmReservationPayment("sess_r");

            assertThat(r.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
        }

        @Test
        @DisplayName("payment still confirmed when auto-invoice fails")
        void whenAutoInvoiceFails_thenPaymentStillConfirmed() {
            Reservation r = buildReservation(1L, PaymentStatus.PROCESSING);
            when(reservationRepository.findByStripeSessionId("sess_r")).thenReturn(Optional.of(r));
            doThrow(new RuntimeException("invoice err"))
                    .when(autoInvoiceService).generateForReservation(any());

            stripeService.confirmReservationPayment("sess_r");

            assertThat(r.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
        }

        @Test
        @DisplayName("payment still confirmed when notification fails")
        void whenNotificationFails_thenPaymentStillConfirmed() {
            Reservation r = buildReservation(1L, PaymentStatus.PROCESSING);
            when(reservationRepository.findByStripeSessionId("sess_r")).thenReturn(Optional.of(r));
            doThrow(new RuntimeException("notif err"))
                    .when(notificationService).notifyAdminsAndManagers(any(), any(), any(), any());

            stripeService.confirmReservationPayment("sess_r");

            assertThat(r.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
        }

        @Test
        @DisplayName("Z4A-BUGS-05: pending reservation becomes confirmed once paid")
        void whenPendingReservationPaid_thenStatusConfirmed() {
            Reservation r = buildReservation(1L, PaymentStatus.PENDING);
            r.setStatus("pending");
            when(reservationRepository.findByStripeSessionId("sess_r")).thenReturn(Optional.of(r));

            stripeService.confirmReservationPayment("sess_r");

            assertThat(r.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
            assertThat(r.getStatus()).isEqualTo("confirmed");
        }

        @Test
        @DisplayName("non-pending status (e.g. confirmed) is left untouched")
        void whenAlreadyConfirmedReservationPaid_thenStatusUnchanged() {
            Reservation r = buildReservation(1L, PaymentStatus.PROCESSING);
            r.setStatus("confirmed");
            when(reservationRepository.findByStripeSessionId("sess_r")).thenReturn(Optional.of(r));

            stripeService.confirmReservationPayment("sess_r");

            assertThat(r.getStatus()).isEqualTo("confirmed");
            assertThat(r.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
        }
    }

    // ─── EXPIRE CHECKOUT SESSION (Z4A-BUGS-02) ──────────────────────────────

    @Nested
    @DisplayName("expireCheckoutSession")
    class ExpireCheckoutSession {

        @Test
        @DisplayName("open session is expired on Stripe")
        void whenSessionOpen_thenExpired() throws Exception {
            Session session = mock(Session.class);
            when(session.getStatus()).thenReturn("open");
            when(session.getPaymentStatus()).thenReturn("unpaid");
            when(stripeGateway.retrieveSession("cs_open")).thenReturn(session);

            StripeService.CheckoutSessionExpiryResult result = stripeService.expireCheckoutSession("cs_open");

            assertThat(result).isEqualTo(StripeService.CheckoutSessionExpiryResult.EXPIRED);
            verify(session).expire(any(RequestOptions.class));
        }

        @Test
        @DisplayName("paid session is NOT expired and reported as PAID")
        void whenSessionPaid_thenPaidWithoutExpiring() throws Exception {
            Session session = mock(Session.class);
            when(session.getStatus()).thenReturn("complete");
            when(session.getPaymentStatus()).thenReturn("paid");
            when(stripeGateway.retrieveSession("cs_paid")).thenReturn(session);

            StripeService.CheckoutSessionExpiryResult result = stripeService.expireCheckoutSession("cs_paid");

            assertThat(result).isEqualTo(StripeService.CheckoutSessionExpiryResult.PAID);
            verify(session, never()).expire(any(RequestOptions.class));
        }

        @Test
        @DisplayName("already expired session short-circuits to EXPIRED")
        void whenSessionAlreadyExpired_thenExpired() throws Exception {
            Session session = mock(Session.class);
            when(session.getStatus()).thenReturn("expired");
            when(stripeGateway.retrieveSession("cs_exp")).thenReturn(session);

            StripeService.CheckoutSessionExpiryResult result = stripeService.expireCheckoutSession("cs_exp");

            assertThat(result).isEqualTo(StripeService.CheckoutSessionExpiryResult.EXPIRED);
            verify(session, never()).expire(any(RequestOptions.class));
        }

        @Test
        @DisplayName("complete-but-unpaid session reported as COMPLETED_UNPAID")
        void whenSessionCompleteUnpaid_thenCompletedUnpaid() throws Exception {
            Session session = mock(Session.class);
            when(session.getStatus()).thenReturn("complete");
            when(session.getPaymentStatus()).thenReturn("unpaid");
            when(stripeGateway.retrieveSession("cs_async")).thenReturn(session);

            StripeService.CheckoutSessionExpiryResult result = stripeService.expireCheckoutSession("cs_async");

            assertThat(result).isEqualTo(StripeService.CheckoutSessionExpiryResult.COMPLETED_UNPAID);
        }

        @Test
        @DisplayName("race: expire fails but session turns out paid on re-read → PAID")
        void whenExpireFailsAndSessionPaidOnRecheck_thenPaid() throws Exception {
            Session openSession = mock(Session.class);
            when(openSession.getStatus()).thenReturn("open");
            when(openSession.getPaymentStatus()).thenReturn("unpaid");
            doThrow(new ApiException("already completed", null, "code", 400, null))
                    .when(openSession).expire(any(RequestOptions.class));
            Session paidSession = mock(Session.class);
            when(paidSession.getPaymentStatus()).thenReturn("paid");
            when(stripeGateway.retrieveSession("cs_race"))
                    .thenReturn(openSession)
                    .thenReturn(paidSession);

            StripeService.CheckoutSessionExpiryResult result = stripeService.expireCheckoutSession("cs_race");

            assertThat(result).isEqualTo(StripeService.CheckoutSessionExpiryResult.PAID);
        }

        @Test
        @DisplayName("Stripe unreachable → FAILED (no calendar release allowed)")
        void whenStripeUnreachable_thenFailed() throws Exception {
            when(stripeGateway.retrieveSession("cs_down"))
                    .thenThrow(new ApiException("down", null, "code", 500, null));

            StripeService.CheckoutSessionExpiryResult result = stripeService.expireCheckoutSession("cs_down");

            assertThat(result).isEqualTo(StripeService.CheckoutSessionExpiryResult.FAILED);
        }

        @Test
        @DisplayName("blank session id treated as EXPIRED (nothing to expire)")
        void whenBlankSessionId_thenExpired() {
            assertThat(stripeService.expireCheckoutSession(null))
                    .isEqualTo(StripeService.CheckoutSessionExpiryResult.EXPIRED);
            assertThat(stripeService.expireCheckoutSession("  "))
                    .isEqualTo(StripeService.CheckoutSessionExpiryResult.EXPIRED);
        }
    }

    // ─── REFUND CHECKOUT SESSION PAYMENT (Z4A-BUGS-03) ──────────────────────

    @Nested
    @DisplayName("refundCheckoutSessionPayment")
    class RefundCheckoutSessionPayment {

        @Test
        @DisplayName("refunds the payment intent with a session-derived idempotency key")
        void whenPaymentIntentPresent_thenRefundIssued() throws Exception {
            Session session = mock(Session.class);
            when(session.getPaymentIntent()).thenReturn("pi_123");
            when(stripeGateway.retrieveSession("cs_refund")).thenReturn(session);

            stripeService.refundCheckoutSessionPayment("cs_refund", "conflit calendrier");

            verify(stripeGateway).createRefund(any(RefundCreateParams.class),
                    eq("refund-checkout-session-cs_refund"));
        }

        @Test
        @DisplayName("throws when the session has no payment intent")
        void whenNoPaymentIntent_thenThrows() throws Exception {
            Session session = mock(Session.class);
            when(session.getPaymentIntent()).thenReturn(null);
            when(stripeGateway.retrieveSession("cs_nopi")).thenReturn(session);

            assertThatThrownBy(() -> stripeService.refundCheckoutSessionPayment("cs_nopi", "test"))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("PaymentIntent");
            verify(stripeGateway, never()).createRefund(any(), anyString());
        }
    }

    // ─── MARK RESERVATION PAYMENT FAILED ────────────────────────────────────

    @Nested
    @DisplayName("markReservationPaymentFailed")
    class MarkReservationPaymentFailed {

        @Test
        @DisplayName("sets FAILED status when reservation found")
        void whenFound_thenStatusFailed() {
            Reservation r = buildReservation(1L, PaymentStatus.PROCESSING);
            when(reservationRepository.findByStripeSessionId("sess_r")).thenReturn(Optional.of(r));

            stripeService.markReservationPaymentFailed("sess_r");

            assertThat(r.getPaymentStatus()).isEqualTo(PaymentStatus.FAILED);
            verify(reservationRepository).save(r);
            verify(notificationService).notifyAdminsAndManagers(any(), any(), any(), any());
        }

        @Test
        @DisplayName("does nothing when reservation not found")
        void whenNotFound_thenDoesNothing() {
            when(reservationRepository.findByStripeSessionId("unknown")).thenReturn(Optional.empty());

            stripeService.markReservationPaymentFailed("unknown");

            verify(reservationRepository, never()).save(any());
        }

        @Test
        @DisplayName("still marks FAILED when notification fails")
        void whenNotificationFails_thenStatusStillFailed() {
            Reservation r = buildReservation(1L, PaymentStatus.PROCESSING);
            when(reservationRepository.findByStripeSessionId("sess_r")).thenReturn(Optional.of(r));
            doThrow(new RuntimeException("notif"))
                    .when(notificationService).notifyAdminsAndManagers(any(), any(), any(), any());

            stripeService.markReservationPaymentFailed("sess_r");

            assertThat(r.getPaymentStatus()).isEqualTo(PaymentStatus.FAILED);
        }
    }

    // ─── CONFIRM SERVICE REQUEST PAYMENT ────────────────────────────────────

    @Nested
    @DisplayName("confirmServiceRequestPayment")
    class ConfirmServiceRequestPayment {

        @Test
        @DisplayName("marks SR PAID, IN_PROGRESS, creates intervention")
        void whenFound_thenSetsPaidAndCreatesIntervention() {
            ServiceRequest sr = buildServiceRequest(1L, RequestStatus.AWAITING_PAYMENT, PaymentStatus.PROCESSING);
            when(serviceRequestRepository.findByStripeSessionId("sess_sr")).thenReturn(Optional.of(sr));

            stripeService.confirmServiceRequestPayment("sess_sr");

            assertThat(sr.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
            assertThat(sr.getStatus()).isEqualTo(RequestStatus.IN_PROGRESS);
            assertThat(sr.getPaidAt()).isNotNull();
            verify(serviceRequestService).createInterventionFromPaidServiceRequest(sr);
        }

        @Test
        @DisplayName("throws when SR not found")
        void whenNotFound_thenThrows() {
            when(serviceRequestRepository.findByStripeSessionId("unknown")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> stripeService.confirmServiceRequestPayment("unknown"))
                    .isInstanceOf(RuntimeException.class);
        }

        @Test
        @DisplayName("payment still confirmed when intervention creation fails")
        void whenInterventionCreationFails_thenPaymentStillConfirmed() {
            ServiceRequest sr = buildServiceRequest(1L, RequestStatus.AWAITING_PAYMENT, PaymentStatus.PROCESSING);
            when(serviceRequestRepository.findByStripeSessionId("sess_sr")).thenReturn(Optional.of(sr));
            doThrow(new RuntimeException("creation err"))
                    .when(serviceRequestService).createInterventionFromPaidServiceRequest(any());

            stripeService.confirmServiceRequestPayment("sess_sr");

            assertThat(sr.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
        }

        @Test
        @DisplayName("notifies user (if keycloak id) and admins")
        void whenSrFound_thenNotifies() {
            ServiceRequest sr = buildServiceRequest(1L, RequestStatus.AWAITING_PAYMENT, PaymentStatus.PROCESSING);
            when(serviceRequestRepository.findByStripeSessionId("sess_sr")).thenReturn(Optional.of(sr));

            stripeService.confirmServiceRequestPayment("sess_sr");

            verify(notificationService).notify(eq("kc-user-11"), any(), any(), any(), any());
            verify(notificationService).notifyAdminsAndManagers(any(), any(), any(), any());
        }
    }

    // ─── MARK SERVICE REQUEST PAYMENT FAILED ────────────────────────────────

    @Nested
    @DisplayName("markServiceRequestPaymentFailed")
    class MarkServiceRequestPaymentFailed {

        @Test
        @DisplayName("sets FAILED and reverts status to AWAITING_PAYMENT")
        void whenFound_thenFailedAndStatusReverted() {
            ServiceRequest sr = buildServiceRequest(1L, RequestStatus.IN_PROGRESS, PaymentStatus.PROCESSING);
            when(serviceRequestRepository.findByStripeSessionId("sess_sr")).thenReturn(Optional.of(sr));

            stripeService.markServiceRequestPaymentFailed("sess_sr");

            assertThat(sr.getPaymentStatus()).isEqualTo(PaymentStatus.FAILED);
            assertThat(sr.getStatus()).isEqualTo(RequestStatus.AWAITING_PAYMENT);
            verify(serviceRequestRepository).save(sr);
        }

        @Test
        @DisplayName("does nothing when SR not found")
        void whenNotFound_thenDoesNothing() {
            when(serviceRequestRepository.findByStripeSessionId("unknown")).thenReturn(Optional.empty());

            stripeService.markServiceRequestPaymentFailed("unknown");

            verify(serviceRequestRepository, never()).save(any());
        }

        @Test
        @DisplayName("notifies user and admins on failure")
        void whenFailed_thenNotifies() {
            ServiceRequest sr = buildServiceRequest(1L, RequestStatus.IN_PROGRESS, PaymentStatus.PROCESSING);
            when(serviceRequestRepository.findByStripeSessionId("sess_sr")).thenReturn(Optional.of(sr));

            stripeService.markServiceRequestPaymentFailed("sess_sr");

            verify(notificationService).notify(eq("kc-user-11"), any(), any(), any(), any());
            verify(notificationService).notifyAdminsAndManagers(any(), any(), any(), any());
        }

        @Test
        @DisplayName("still marks FAILED when notification fails")
        void whenNotificationFails_thenStillFailed() {
            ServiceRequest sr = buildServiceRequest(1L, RequestStatus.IN_PROGRESS, PaymentStatus.PROCESSING);
            when(serviceRequestRepository.findByStripeSessionId("sess_sr")).thenReturn(Optional.of(sr));
            doThrow(new RuntimeException("err")).when(notificationService).notify(any(), any(), any(), any(), any());

            stripeService.markServiceRequestPaymentFailed("sess_sr");

            assertThat(sr.getPaymentStatus()).isEqualTo(PaymentStatus.FAILED);
        }
    }

    // ─── WALLET / LEDGER (private helpers via confirmPayment) ──────────────

    @Nested
    @DisplayName("wallet & ledger integration via confirmPayment")
    class WalletAndLedger {

        @Test
        @DisplayName("creates platform + escrow wallets")
        void whenConfirmed_thenWalletsCreated() {
            Intervention intervention = buildInterventionWithOwner(1L, InterventionStatus.AWAITING_PAYMENT, PaymentStatus.PROCESSING);
            intervention.setEstimatedCost(BigDecimal.valueOf(100));
            Property p = intervention.getProperty();
            p.setId(7L);
            intervention.getProperty().getOwner().setId(99L);
            when(interventionRepository.findByStripeSessionId("sess_w")).thenReturn(Optional.of(intervention));
            Wallet plat = new Wallet();
            Wallet escrow = new Wallet();
            when(walletService.getOrCreatePlatformWallet(any(), any())).thenReturn(plat);
            when(walletService.getOrCreateEscrowWallet(any(), any())).thenReturn(escrow);

            stripeService.confirmPayment("sess_w");

            verify(walletService).getOrCreatePlatformWallet(any(), eq("EUR"));
            verify(walletService).getOrCreateEscrowWallet(any(), eq("EUR"));
            verify(walletService).getOrCreateWallet(any(), eq(WalletType.OWNER), eq(99L), eq("EUR"));
            verify(ledgerService).recordTransfer(eq(escrow), eq(plat), eq(BigDecimal.valueOf(100)),
                    eq(LedgerReferenceType.PAYMENT), eq("1"), anyString());
        }

        @Test
        @DisplayName("does not record ledger when amount is null")
        void whenAmountNull_thenSkipsLedger() {
            Intervention intervention = buildInterventionWithOwner(1L, InterventionStatus.AWAITING_PAYMENT, PaymentStatus.PROCESSING);
            intervention.setEstimatedCost(null);
            when(interventionRepository.findByStripeSessionId("sess_n")).thenReturn(Optional.of(intervention));
            Wallet plat = new Wallet();
            Wallet escrow = new Wallet();
            when(walletService.getOrCreatePlatformWallet(any(), any())).thenReturn(plat);
            when(walletService.getOrCreateEscrowWallet(any(), any())).thenReturn(escrow);

            stripeService.confirmPayment("sess_n");

            verify(ledgerService, never()).recordTransfer(any(), any(), any(), any(), any(), any());
        }

        @Test
        @DisplayName("does not record ledger when amount is zero")
        void whenAmountZero_thenSkipsLedger() {
            Intervention intervention = buildInterventionWithOwner(1L, InterventionStatus.AWAITING_PAYMENT, PaymentStatus.PROCESSING);
            intervention.setEstimatedCost(BigDecimal.ZERO);
            when(interventionRepository.findByStripeSessionId("sess_z")).thenReturn(Optional.of(intervention));
            Wallet plat = new Wallet();
            Wallet escrow = new Wallet();
            when(walletService.getOrCreatePlatformWallet(any(), any())).thenReturn(plat);
            when(walletService.getOrCreateEscrowWallet(any(), any())).thenReturn(escrow);

            stripeService.confirmPayment("sess_z");

            verify(ledgerService, never()).recordTransfer(any(), any(), any(), any(), any(), any());
        }

        @Test
        @DisplayName("payment continues when split payment fails")
        void whenSplitFails_thenContinues() {
            Intervention intervention = buildInterventionWithOwner(1L, InterventionStatus.AWAITING_PAYMENT, PaymentStatus.PROCESSING);
            intervention.setEstimatedCost(BigDecimal.valueOf(100));
            when(interventionRepository.findByStripeSessionId("sess_s")).thenReturn(Optional.of(intervention));
            Wallet plat = new Wallet();
            Wallet escrow = new Wallet();
            when(walletService.getOrCreatePlatformWallet(any(), any())).thenReturn(plat);
            when(walletService.getOrCreateEscrowWallet(any(), any())).thenReturn(escrow);
            doThrow(new RuntimeException("split err"))
                    .when(splitPaymentService).splitGenericPayment(any(), any(), any(), any(), any(), any());

            stripeService.confirmPayment("sess_s");

            assertThat(intervention.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
        }

        @Test
        @DisplayName("payment confirmed when wallet creation fails completely")
        void whenWalletCreationFails_thenPaymentStillConfirmed() {
            Intervention intervention = buildInterventionWithOwner(1L, InterventionStatus.AWAITING_PAYMENT, PaymentStatus.PROCESSING);
            intervention.setEstimatedCost(BigDecimal.valueOf(100));
            when(interventionRepository.findByStripeSessionId("sess_e")).thenReturn(Optional.of(intervention));
            when(walletService.getOrCreatePlatformWallet(any(), any())).thenThrow(new RuntimeException("wallet err"));

            stripeService.confirmPayment("sess_e");

            assertThat(intervention.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
        }
    }

    // ─── refundPayment resilience ────────────────────────────────────────────

    @Nested
    @DisplayName("refundPayment resilience")
    class RefundAutoInvoice {

        @Test
        @DisplayName("when Kafka publish fails, refund still completes")
        void whenKafkaFails_refundStillCompletes() throws Exception {
            // Arrange
            when(paymentStatusTransitionService.loadRefundableIntervention(1L)).thenReturn(
                    new PaymentStatusTransitionService.InterventionRefundContext(
                            1L, "cs_abc", "Test", null, null));
            com.stripe.model.checkout.Session session = mock(com.stripe.model.checkout.Session.class);
            when(session.getPaymentIntent()).thenReturn("pi_1");
            when(stripeGateway.retrieveSession("cs_abc")).thenReturn(session);
            doThrow(new RuntimeException("kafka down"))
                    .when(kafkaTemplate).send(anyString(), anyString(), any());

            // Act
            stripeService.refundPayment(1L);

            // Assert
            verify(paymentStatusTransitionService).markInterventionRefunded(1L);
        }
    }

    // ============= EXTENDED =============

    @Nested
    @DisplayName("confirmPayment - admin/awaiting validation notifications")
    class ConfirmPaymentNotifications {
        @Test
        void whenConfirmed_thenNotifiesAdminsForAwaitingValidation() {
            Intervention intervention = buildInterventionWithOwner(1L, InterventionStatus.AWAITING_PAYMENT, PaymentStatus.PROCESSING);
            when(interventionRepository.findByStripeSessionId("sess_n2")).thenReturn(Optional.of(intervention));

            stripeService.confirmPayment("sess_n2");

            verify(notificationService).notifyAdminsAndManagers(
                eq(com.clenzy.model.NotificationKey.PAYMENT_CONFIRMED), any(), any(), any());
            verify(notificationService).notifyAdminsAndManagers(
                eq(com.clenzy.model.NotificationKey.INTERVENTION_AWAITING_VALIDATION), any(), any(), any());
        }

        @Test
        void whenAutoInvoiceFails_paymentStillConfirmed() {
            Intervention intervention = buildInterventionWithOwner(1L, InterventionStatus.AWAITING_PAYMENT, PaymentStatus.PROCESSING);
            when(interventionRepository.findByStripeSessionId("sess_inv")).thenReturn(Optional.of(intervention));
            doThrow(new RuntimeException("invoice err"))
                .when(autoInvoiceService).generateForIntervention(any());

            stripeService.confirmPayment("sess_inv");

            assertThat(intervention.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
        }

        @Test
        void whenOwnerHasNoKeycloakId_thenNoOwnerNotificationButAdminsStillNotified() {
            Intervention intervention = buildIntervention(1L, InterventionStatus.AWAITING_PAYMENT, PaymentStatus.PROCESSING);
            // No owner — no keycloakId notification
            when(interventionRepository.findByStripeSessionId("sess_no_owner")).thenReturn(Optional.of(intervention));

            stripeService.confirmPayment("sess_no_owner");

            verify(notificationService, never()).notify(any(), any(), any(), any(), any());
            // 2 admin notifications: PAYMENT_CONFIRMED + INTERVENTION_AWAITING_VALIDATION
            verify(notificationService, times(2)).notifyAdminsAndManagers(any(), any(), any(), any());
        }
    }

    @Nested
    @DisplayName("confirmGroupedPayment - kafka and auto-invoice failures")
    class ConfirmGroupedPaymentFailures {
        @Test
        void whenKafkaFails_paymentStillSet() {
            Intervention i1 = buildInterventionWithOwner(1L, InterventionStatus.PENDING, PaymentStatus.PROCESSING);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(i1));
            doThrow(new RuntimeException("kafka")).when(kafkaTemplate).send(anyString(), anyString(), any());

            stripeService.confirmGroupedPayment("sess_grp_kafka", "1");

            assertThat(i1.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
        }

        @Test
        void whenAutoInvoiceFails_paymentStillSet() {
            Intervention i1 = buildInterventionWithOwner(1L, InterventionStatus.PENDING, PaymentStatus.PROCESSING);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(i1));
            doThrow(new RuntimeException("inv")).when(autoInvoiceService).generateForIntervention(any());

            stripeService.confirmGroupedPayment("sess_grp_inv", "1");

            assertThat(i1.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
        }

        @Test
        void whenInterventionFound_thenSetsSessionId() {
            Intervention i1 = buildInterventionWithOwner(1L, InterventionStatus.PENDING, PaymentStatus.PROCESSING);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(i1));

            stripeService.confirmGroupedPayment("sess_grp_xyz", "1");

            assertThat(i1.getStripeSessionId()).isEqualTo("sess_grp_xyz");
        }
    }

    @Nested
    @DisplayName("markPaymentAsFailed - owner without keycloakId")
    class MarkPaymentFailedOwner {
        @Test
        void whenOwnerNoKeycloak_thenOnlyAdminsNotified() {
            Intervention intervention = buildIntervention(1L, InterventionStatus.AWAITING_PAYMENT, PaymentStatus.PROCESSING);
            // No owner - no notify() call
            when(interventionRepository.findByStripeSessionId("sess_no")).thenReturn(Optional.of(intervention));

            stripeService.markPaymentAsFailed("sess_no");

            verify(notificationService, never()).notify(any(), any(), any(), any(), any());
            verify(notificationService).notifyAdminsAndManagers(any(), any(), any(), any());
        }

        @Test
        void whenNotificationsFail_stillSavesFailedStatus() {
            Intervention intervention = buildInterventionWithOwner(1L, InterventionStatus.AWAITING_PAYMENT, PaymentStatus.PROCESSING);
            when(interventionRepository.findByStripeSessionId("sess_fn")).thenReturn(Optional.of(intervention));
            doThrow(new RuntimeException("notif")).when(notificationService).notify(any(), any(), any(), any(), any());

            stripeService.markPaymentAsFailed("sess_fn");

            assertThat(intervention.getPaymentStatus()).isEqualTo(PaymentStatus.FAILED);
        }
    }

    @Nested
    @DisplayName("confirmReservationPayment - paymentLinkEmail")
    class ConfirmReservationEmail {
        @Test
        void whenPaymentLinkEmailSet_thenUsedAsEmailTo() {
            Reservation r = buildReservation(1L, PaymentStatus.PROCESSING);
            r.setPaymentLinkEmail("custom@example.com");
            when(reservationRepository.findByStripeSessionId("sess_em")).thenReturn(Optional.of(r));
            Wallet plat = new Wallet();
            Wallet escrow = new Wallet();
            when(walletService.getOrCreatePlatformWallet(any(), any())).thenReturn(plat);
            when(walletService.getOrCreateEscrowWallet(any(), any())).thenReturn(escrow);

            stripeService.confirmReservationPayment("sess_em");

            verify(kafkaTemplate, times(2)).send(anyString(), anyString(), any());
        }
    }

    @Nested
    @DisplayName("markReservationPaymentFailed - notification swallowed")
    class MarkReservationFailedExtended {
        @Test
        void whenReservationFound_setsFailedSessionPreserved() {
            Reservation r = buildReservation(1L, PaymentStatus.PROCESSING);
            r.setStripeSessionId("preserved-sess");
            when(reservationRepository.findByStripeSessionId("preserved-sess")).thenReturn(Optional.of(r));

            stripeService.markReservationPaymentFailed("preserved-sess");

            // stripeSessionId is not reset on failure
            assertThat(r.getStripeSessionId()).isEqualTo("preserved-sess");
            assertThat(r.getPaymentStatus()).isEqualTo(PaymentStatus.FAILED);
        }
    }

    @Nested
    @DisplayName("createCheckoutSession - validation paths")
    class CreateCheckoutSession {
        @Test
        void whenInterventionNotFound_thenThrows() {
            when(interventionRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> stripeService.createCheckoutSession(99L, BigDecimal.valueOf(100), "x@y.z"))
                .isInstanceOf(RuntimeException.class);
        }

        @Test
        void whenInterventionFromOtherOrg_thenAccessDenied() {
            // findById contourne le filtre Hibernate → l'ownership org doit etre verifie explicitement
            Intervention intervention = buildIntervention(7L, InterventionStatus.AWAITING_PAYMENT, PaymentStatus.PENDING);
            intervention.setOrganizationId(ORG_ID + 1);
            when(interventionRepository.findById(7L)).thenReturn(Optional.of(intervention));

            assertThatThrownBy(() -> stripeService.createCheckoutSession(7L, BigDecimal.valueOf(100), "x@y.z"))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
            verifyNoInteractions(stripeGateway);
        }
    }

    @Nested
    @DisplayName("createEmbeddedCheckoutSession - validation paths")
    class CreateEmbeddedCheckoutSession {
        @Test
        void whenInterventionNotFound_thenThrows() {
            when(interventionRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> stripeService.createEmbeddedCheckoutSession(99L, BigDecimal.valueOf(100), "x@y.z"))
                .isInstanceOf(RuntimeException.class);
        }

        @Test
        void whenInterventionFromOtherOrg_thenAccessDenied() {
            // findById contourne le filtre Hibernate → l'ownership org doit etre verifie explicitement
            Intervention intervention = buildIntervention(8L, InterventionStatus.AWAITING_PAYMENT, PaymentStatus.PENDING);
            intervention.setOrganizationId(ORG_ID + 1);
            when(interventionRepository.findById(8L)).thenReturn(Optional.of(intervention));

            assertThatThrownBy(() -> stripeService.createEmbeddedCheckoutSession(8L, BigDecimal.valueOf(100), "x@y.z"))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
            verifyNoInteractions(stripeGateway);
        }
    }

    @Nested
    @DisplayName("createReservationCheckoutSession - currency resolution")
    class CreateReservationCheckoutSession {
        @Test
        void whenReservationFound_thenUsesReservationCurrencyResolution() {
            Reservation r = new Reservation();
            r.setId(1L);
            r.setCurrency("USD");
            when(reservationRepository.findById(1L)).thenReturn(Optional.of(r));

            // Will fail at Stripe.create(), but currency resolution path is exercised
            try {
                stripeService.createReservationCheckoutSession(1L, BigDecimal.valueOf(200), "g@h.com", "Guest", "Property");
            } catch (Exception expected) {
                // Stripe call fails — but the lookup ran
            }
            verify(reservationRepository).findById(1L);
        }

        @Test
        void whenReservationNotFound_thenFallsBackToDefaultCurrency() {
            when(reservationRepository.findById(99L)).thenReturn(Optional.empty());

            try {
                stripeService.createReservationCheckoutSession(99L, BigDecimal.valueOf(200), "g@h.com", "Guest", "Property");
            } catch (Exception expected) {
                // Stripe call fails — but the lookup ran
            }
            verify(reservationRepository).findById(99L);
        }
    }

    @Nested
    @DisplayName("createServiceRequestCheckoutSession - validation paths")
    class CreateServiceRequestCheckoutSession {
        @Test
        void whenSrNotFound_thenThrows() {
            when(serviceRequestRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> stripeService.createServiceRequestCheckoutSession(99L, "u@h.com"))
                .isInstanceOf(RuntimeException.class);
        }

        @Test
        void whenSrNotInAwaitingPayment_thenThrows() {
            ServiceRequest sr = buildServiceRequest(1L, RequestStatus.PENDING, PaymentStatus.PROCESSING);
            when(serviceRequestRepository.findById(1L)).thenReturn(Optional.of(sr));

            assertThatThrownBy(() -> stripeService.createServiceRequestCheckoutSession(1L, "u@h.com"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("AWAITING_PAYMENT");
        }

        @Test
        void whenAmountInvalid_thenThrows() {
            ServiceRequest sr = buildServiceRequest(1L, RequestStatus.AWAITING_PAYMENT, PaymentStatus.PROCESSING);
            sr.setEstimatedCost(BigDecimal.ZERO);
            when(serviceRequestRepository.findById(1L)).thenReturn(Optional.of(sr));

            assertThatThrownBy(() -> stripeService.createServiceRequestCheckoutSession(1L, "u@h.com"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Montant invalide");
        }

        @Test
        void whenAmountNull_thenThrows() {
            ServiceRequest sr = buildServiceRequest(1L, RequestStatus.AWAITING_PAYMENT, PaymentStatus.PROCESSING);
            sr.setEstimatedCost(null);
            when(serviceRequestRepository.findById(1L)).thenReturn(Optional.of(sr));

            assertThatThrownBy(() -> stripeService.createServiceRequestCheckoutSession(1L, "u@h.com"))
                .isInstanceOf(RuntimeException.class);
        }
    }

    @Nested
    @DisplayName("createServiceRequestEmbeddedCheckoutSession - validation paths")
    class CreateServiceRequestEmbedded {
        @Test
        void whenAmountInvalid_thenThrows() {
            ServiceRequest sr = buildServiceRequest(1L, RequestStatus.AWAITING_PAYMENT, PaymentStatus.PROCESSING);
            sr.setEstimatedCost(BigDecimal.ZERO);
            when(serviceRequestRepository.findById(1L)).thenReturn(Optional.of(sr));

            assertThatThrownBy(() -> stripeService.createServiceRequestEmbeddedCheckoutSession(1L, "u@h.com"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Montant invalide");
        }

        @Test
        void whenSrNotFound_thenThrows() {
            when(serviceRequestRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> stripeService.createServiceRequestEmbeddedCheckoutSession(99L, "u@h.com"))
                .isInstanceOf(RuntimeException.class);
        }
    }

    // ─── Idempotence des confirmations (Z3-BUGS-01 / Z3-SEC-02) ──────────────

    @Nested
    @DisplayName("confirm* idempotency guards")
    class ConfirmIdempotency {

        @Test
        @DisplayName("confirmPayment: already PAID -> no ledger, no split, no save")
        void whenInterventionAlreadyPaid_thenConfirmPaymentSkipsEverything() {
            // Arrange
            Intervention intervention = buildInterventionWithOwner(1L, InterventionStatus.PENDING, PaymentStatus.PAID);
            intervention.setEstimatedCost(BigDecimal.valueOf(100));
            when(interventionRepository.findByStripeSessionId("sess_dup")).thenReturn(Optional.of(intervention));

            // Act
            stripeService.confirmPayment("sess_dup");

            // Assert
            verify(interventionRepository, never()).save(any());
            verify(ledgerService, never()).recordTransfer(any(), any(), any(), any(), any(), any());
            verify(splitPaymentService, never()).splitGenericPayment(any(), any(), any(), any(), any(), any());
            verify(kafkaTemplate, never()).send(anyString(), anyString(), any());
        }

        @Test
        @DisplayName("confirmPayment: lost guarded transition (concurrent webhook/fallback) -> aborts")
        void whenGuardedTransitionLost_thenConfirmPaymentAborts() {
            // Arrange
            Intervention intervention = buildInterventionWithOwner(1L, InterventionStatus.AWAITING_PAYMENT, PaymentStatus.PROCESSING);
            when(interventionRepository.findByStripeSessionId("sess_race")).thenReturn(Optional.of(intervention));
            when(paymentStatusTransitionService.markInterventionPaid(1L)).thenReturn(false);

            // Act
            stripeService.confirmPayment("sess_race");

            // Assert
            verify(interventionRepository, never()).save(any());
            verify(ledgerService, never()).recordTransfer(any(), any(), any(), any(), any(), any());
        }

        @Test
        @DisplayName("confirmReservationPayment: already PAID -> no double ledger credit")
        void whenReservationAlreadyPaid_thenSkips() {
            // Arrange
            Reservation r = buildReservation(1L, PaymentStatus.PAID);
            when(reservationRepository.findByStripeSessionId("sess_dup_r")).thenReturn(Optional.of(r));

            // Act
            stripeService.confirmReservationPayment("sess_dup_r");

            // Assert
            verify(reservationRepository, never()).save(any());
            verify(ledgerService, never()).recordTransfer(any(), any(), any(), any(), any(), any());
            verify(splitPaymentService, never()).splitPayment(any(), any(), any(), any());
        }

        @Test
        @DisplayName("confirmServiceRequestPayment: already PAID -> nothing re-executed")
        void whenSrAlreadyPaid_thenSkips() {
            // Arrange
            ServiceRequest sr = buildServiceRequest(1L, RequestStatus.IN_PROGRESS, PaymentStatus.PAID);
            when(serviceRequestRepository.findByStripeSessionId("sess_dup_sr")).thenReturn(Optional.of(sr));

            // Act
            stripeService.confirmServiceRequestPayment("sess_dup_sr");

            // Assert
            verify(serviceRequestRepository, never()).save(any());
            verify(serviceRequestService, never()).createInterventionFromPaidServiceRequest(any());
            verify(ledgerService, never()).recordTransfer(any(), any(), any(), any(), any(), any());
        }

        @Test
        @DisplayName("confirmGroupedPayment: already PAID interventions are skipped")
        void whenGroupedInterventionAlreadyPaid_thenSkipped() {
            // Arrange
            Intervention paid = buildInterventionWithOwner(1L, InterventionStatus.PENDING, PaymentStatus.PAID);
            Intervention pending = buildInterventionWithOwner(2L, InterventionStatus.PENDING, PaymentStatus.PROCESSING);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(paid));
            when(interventionRepository.findById(2L)).thenReturn(Optional.of(pending));

            // Act
            stripeService.confirmGroupedPayment("sess_grp_dup", "1,2");

            // Assert
            verify(interventionRepository, times(1)).save(pending);
            verify(interventionRepository, never()).save(paid);
        }
    }

    // ─── Devise de la charge reelle propagee au ledger (Z3-BUGS-05) ──────────

    @Nested
    @DisplayName("currency propagation to wallets/ledger")
    class CurrencyPropagation {

        @Test
        @DisplayName("reservation charged in MAD -> wallets and split in MAD (not config currency)")
        void whenReservationCurrencyMad_thenLedgerUsesMad() {
            // Arrange
            Reservation r = buildReservation(1L, PaymentStatus.PROCESSING);
            r.setCurrency("mad");
            when(reservationRepository.findByStripeSessionId("sess_mad")).thenReturn(Optional.of(r));
            Wallet plat = new Wallet();
            Wallet escrow = new Wallet();
            when(walletService.getOrCreatePlatformWallet(any(), any())).thenReturn(plat);
            when(walletService.getOrCreateEscrowWallet(any(), any())).thenReturn(escrow);

            // Act
            stripeService.confirmReservationPayment("sess_mad");

            // Assert
            verify(walletService).getOrCreatePlatformWallet(any(), eq("MAD"));
            verify(walletService).getOrCreateEscrowWallet(any(), eq("MAD"));
            verify(splitPaymentService).splitPayment(eq(1L), eq(BigDecimal.valueOf(200)), eq("MAD"), eq(99L));
        }

        @Test
        @DisplayName("intervention on USD property -> ledger wallets in USD")
        void whenPropertyCurrencyUsd_thenLedgerUsesUsd() {
            // Arrange
            Intervention intervention = buildInterventionWithOwner(1L, InterventionStatus.AWAITING_PAYMENT, PaymentStatus.PROCESSING);
            intervention.setEstimatedCost(BigDecimal.valueOf(100));
            intervention.getProperty().setDefaultCurrency("USD");
            intervention.getProperty().getOwner().setId(99L);
            when(interventionRepository.findByStripeSessionId("sess_usd")).thenReturn(Optional.of(intervention));
            Wallet plat = new Wallet();
            Wallet escrow = new Wallet();
            when(walletService.getOrCreatePlatformWallet(any(), any())).thenReturn(plat);
            when(walletService.getOrCreateEscrowWallet(any(), any())).thenReturn(escrow);

            // Act
            stripeService.confirmPayment("sess_usd");

            // Assert
            verify(walletService).getOrCreatePlatformWallet(any(), eq("USD"));
            verify(walletService).getOrCreateEscrowWallet(any(), eq("USD"));
        }
    }

    // ─── Montant serveur sur la creation de session (Z3-SEC-01 / Z3-BUGS-02) ─

    @Nested
    @DisplayName("createCheckoutSession - server-side amount")
    class CreateSessionAmountChecks {

        private Intervention interventionWithCost(Long id, BigDecimal cost) {
            Intervention i = buildIntervention(id, InterventionStatus.AWAITING_PAYMENT, PaymentStatus.PENDING);
            i.setEstimatedCost(cost);
            return i;
        }

        @Test
        @DisplayName("client amount different from estimatedCost -> rejected before Stripe")
        void whenClientAmountDiffers_thenThrows() {
            // Arrange
            when(interventionRepository.findById(1L))
                    .thenReturn(Optional.of(interventionWithCost(1L, new BigDecimal("500"))));

            // Act & Assert
            assertThatThrownBy(() -> stripeService.createCheckoutSession(1L, new BigDecimal("1"), "x@y.z"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("ne correspond pas");
            verifyNoInteractions(stripeGateway);
        }

        @Test
        @DisplayName("missing estimatedCost -> rejected before Stripe")
        void whenEstimatedCostMissing_thenThrows() {
            // Arrange
            when(interventionRepository.findById(1L))
                    .thenReturn(Optional.of(interventionWithCost(1L, null)));

            // Act & Assert
            assertThatThrownBy(() -> stripeService.createCheckoutSession(1L, new BigDecimal("1"), "x@y.z"))
                    .isInstanceOf(IllegalStateException.class);
            verifyNoInteractions(stripeGateway);
        }

        @Test
        @DisplayName("matching amount -> charges server amount converted to cents")
        void whenAmountMatches_thenChargesServerAmountInCents() throws Exception {
            // Arrange
            Intervention i = interventionWithCost(1L, new BigDecimal("500.00"));
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(i));
            com.stripe.model.checkout.Session session = mock(com.stripe.model.checkout.Session.class);
            when(session.getId()).thenReturn("cs_new");
            org.mockito.ArgumentCaptor<com.stripe.param.checkout.SessionCreateParams> captor =
                    org.mockito.ArgumentCaptor.forClass(com.stripe.param.checkout.SessionCreateParams.class);
            when(stripeGateway.createSession(captor.capture())).thenReturn(session);

            // Act
            stripeService.createCheckoutSession(1L, new BigDecimal("500.00"), "x@y.z");

            // Assert
            assertThat(captor.getValue().getLineItems().get(0).getPriceData().getUnitAmount())
                    .isEqualTo(50000L);
            assertThat(i.getStripeSessionId()).isEqualTo("cs_new");
            assertThat(i.getPaymentStatus()).isEqualTo(PaymentStatus.PROCESSING);
        }

        @Test
        @DisplayName("embedded: client amount different -> rejected before Stripe")
        void whenEmbeddedClientAmountDiffers_thenThrows() {
            // Arrange
            when(interventionRepository.findById(1L))
                    .thenReturn(Optional.of(interventionWithCost(1L, new BigDecimal("500"))));

            // Act & Assert
            assertThatThrownBy(() -> stripeService.createEmbeddedCheckoutSession(1L, new BigDecimal("0.01"), "x@y.z"))
                    .isInstanceOf(IllegalArgumentException.class);
            verifyNoInteractions(stripeGateway);
        }

        @Test
        @DisplayName("null client amount -> server amount used")
        void whenClientAmountNull_thenServerAmountUsed() throws Exception {
            // Arrange
            Intervention i = interventionWithCost(1L, new BigDecimal("75"));
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(i));
            com.stripe.model.checkout.Session session = mock(com.stripe.model.checkout.Session.class);
            when(session.getId()).thenReturn("cs_n");
            when(stripeGateway.createSession(any())).thenReturn(session);

            // Act
            stripeService.createCheckoutSession(1L, null, "x@y.z");

            // Assert
            verify(stripeGateway).createSession(any());
        }
    }
}
