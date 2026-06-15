package com.clenzy.service;

import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.Property;
import com.clenzy.model.RequestStatus;
import com.clenzy.model.Reservation;
import com.clenzy.model.ServiceRequest;
import com.clenzy.model.User;
import com.clenzy.model.Wallet;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.tenant.TenantContext;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;
import org.mockito.ArgumentCaptor;
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
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests supplementaires pour {@link StripeService} couvrant les chemins de
 * resolution de devise via Property.defaultCurrency, les chemins refundPayment
 * de validation, et l'auto-invoice failure path pour reservation.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("StripeService — extra coverage")
class StripeServiceExtraTest {

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

    @BeforeEach
    void setUp() throws Exception {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(1L);
        StripeCheckoutSessionFactory checkoutSessionFactory = new StripeCheckoutSessionFactory(
            interventionRepository, reservationRepository, serviceRequestRepository,
            new com.clenzy.service.access.OrganizationAccessGuard(tenantContext), stripeGateway);
        StripePaymentConfirmationService paymentConfirmationService = new StripePaymentConfirmationService(
            interventionRepository, reservationRepository, serviceRequestRepository,
            notificationService, serviceRequestService, walletService, ledgerService,
            splitPaymentService, autoInvoiceService, kafkaTemplate, paymentStatusTransitionService,
            org.mockito.Mockito.mock(com.clenzy.service.email.BookingConfirmationEmailService.class),
            org.mockito.Mockito.mock(com.clenzy.service.WebhookEventPublisher.class));
        StripeRefundService refundService = new StripeRefundService(stripeGateway,
            paymentStatusTransitionService, org.mockito.Mockito.mock(PaymentLedgerReversalService.class),
            notificationService, kafkaTemplate);
        stripeService = new StripeService(stripeGateway, checkoutSessionFactory,
            paymentConfirmationService, refundService);
        setField(checkoutSessionFactory, "currency", "EUR");
        setField(checkoutSessionFactory, "successUrl", "https://ok.test");
        setField(checkoutSessionFactory, "cancelUrl", "https://ko.test");
        setField(paymentConfirmationService, "currency", "EUR");
        org.mockito.Mockito.lenient()
            .when(paymentStatusTransitionService.markInterventionPaid(any())).thenReturn(true);
        org.mockito.Mockito.lenient()
            .when(paymentStatusTransitionService.markReservationPaid(any())).thenReturn(true);
        org.mockito.Mockito.lenient()
            .when(paymentStatusTransitionService.markServiceRequestPaid(any())).thenReturn(true);
    }

    private void setField(Object target, String name, String value) throws Exception {
        Field f = target.getClass().getDeclaredField(name);
        f.setAccessible(true);
        f.set(target, value);
    }

    private Intervention buildInterventionWithProperty(Long id, String currency) {
        Intervention intervention = new Intervention();
        intervention.setId(id);
        intervention.setTitle("Test");
        intervention.setStatus(InterventionStatus.AWAITING_PAYMENT);
        intervention.setPaymentStatus(PaymentStatus.PROCESSING);
        intervention.setEstimatedCost(BigDecimal.valueOf(100));
        // Org alignee au tenant : OrganizationAccessGuard est fail-closed (org NULL -> refus).
        intervention.setOrganizationId(1L);
        Property p = new Property();
        p.setId(11L);
        p.setDefaultCurrency(currency);
        User owner = new User();
        owner.setId(99L);
        owner.setKeycloakId("kc-99");
        owner.setEmail("o@x.com");
        p.setOwner(owner);
        intervention.setProperty(p);
        return intervention;
    }

    private Reservation buildReservation(Long id) {
        Reservation r = new Reservation();
        r.setId(id);
        r.setGuestName("Jane");
        r.setPaymentStatus(PaymentStatus.PROCESSING);
        r.setTotalPrice(BigDecimal.valueOf(200));
        Property p = new Property();
        p.setName("Villa");
        User owner = new User();
        owner.setId(50L);
        p.setOwner(owner);
        r.setProperty(p);
        return r;
    }

    private ServiceRequest buildSr() {
        ServiceRequest sr = new ServiceRequest();
        sr.setId(1L);
        sr.setTitle("SR");
        sr.setStatus(RequestStatus.AWAITING_PAYMENT);
        sr.setPaymentStatus(PaymentStatus.PROCESSING);
        sr.setEstimatedCost(BigDecimal.valueOf(80));
        User user = new User();
        user.setId(11L);
        user.setKeycloakId("kc-u");
        user.setEmail("u@x.com");
        sr.setUser(user);
        return sr;
    }

    // ─── Currency resolution path via Property.defaultCurrency ────────────────

    @Nested
    @DisplayName("createCheckoutSession: currency resolution property -> config fallback")
    class CurrencyResolutionPath {

        private Session sessionMock() {
            Session session = org.mockito.Mockito.mock(Session.class);
            when(session.getId()).thenReturn("cs_x");
            return session;
        }

        private String capturedCurrency() throws Exception {
            ArgumentCaptor<SessionCreateParams> captor = ArgumentCaptor.forClass(SessionCreateParams.class);
            verify(stripeGateway).createSession(captor.capture());
            return captor.getValue().getLineItems().get(0).getPriceData().getCurrency();
        }

        @Test
        @DisplayName("intervention not found -> throws (resolveInterventionCurrency not even reached)")
        void interventionNotFound_throws() {
            when(interventionRepository.findById(123L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> stripeService.createCheckoutSession(123L, BigDecimal.TEN, "g@h.com"))
                .isInstanceOf(RuntimeException.class);
        }

        @Test
        @DisplayName("property has defaultCurrency USD -> session charged in usd")
        void propertyDefaultCurrency_resolved() throws Exception {
            Intervention intervention = buildInterventionWithProperty(1L, "USD");
            Session session = sessionMock();
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            when(stripeGateway.createSession(any())).thenReturn(session);

            stripeService.createCheckoutSession(1L, BigDecimal.valueOf(100), "g@h.com");

            assertThat(capturedCurrency()).isEqualTo("usd");
        }

        @Test
        @DisplayName("property has blank defaultCurrency -> fallback to config currency (eur)")
        void propertyBlankCurrency_fallsBackToConfig() throws Exception {
            Intervention intervention = buildInterventionWithProperty(1L, "");
            Session session = sessionMock();
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            when(stripeGateway.createSession(any())).thenReturn(session);

            stripeService.createCheckoutSession(1L, BigDecimal.valueOf(100), "g@h.com");

            assertThat(capturedCurrency()).isEqualTo("eur");
        }

        @Test
        @DisplayName("intervention without property -> fallback config currency (eur)")
        void interventionWithoutProperty_fallsBack() throws Exception {
            Intervention intervention = new Intervention();
            intervention.setId(2L);
            intervention.setTitle("No-prop");
            intervention.setProperty(null);
            intervention.setEstimatedCost(BigDecimal.valueOf(100));
            intervention.setOrganizationId(1L);
            Session session = sessionMock();
            when(interventionRepository.findById(2L)).thenReturn(Optional.of(intervention));
            when(stripeGateway.createSession(any())).thenReturn(session);

            stripeService.createCheckoutSession(2L, BigDecimal.valueOf(100), "g@h.com");

            assertThat(capturedCurrency()).isEqualTo("eur");
        }

        @Test
        @DisplayName("createEmbeddedCheckoutSession: same currency resolution chain (gbp)")
        void createEmbeddedCheckoutSession_currencyResolution() throws Exception {
            Intervention intervention = buildInterventionWithProperty(5L, "GBP");
            Session session = sessionMock();
            when(interventionRepository.findById(5L)).thenReturn(Optional.of(intervention));
            when(stripeGateway.createSession(any())).thenReturn(session);

            stripeService.createEmbeddedCheckoutSession(5L, BigDecimal.valueOf(100), "x@y.z");

            assertThat(capturedCurrency()).isEqualTo("gbp");
        }
    }

    // ─── refundPayment : PaymentIntent manquant ───────────────────────────────

    @Nested
    @DisplayName("refundPayment validation paths")
    class RefundValidation {

        @Test
        @DisplayName("session without PaymentIntent -> throws and never calls Refund.create")
        void paidWithSession_butNoPaymentIntent_throws() throws Exception {
            when(paymentStatusTransitionService.loadRefundableIntervention(1L)).thenReturn(
                new PaymentStatusTransitionService.InterventionRefundContext(
                    1L, "cs_xxx", "Test", "kc-99", "o@x.com"));
            Session session = org.mockito.Mockito.mock(Session.class);
            when(session.getPaymentIntent()).thenReturn(null);
            when(stripeGateway.retrieveSession("cs_xxx")).thenReturn(session);

            assertThatThrownBy(() -> stripeService.refundPayment(1L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Aucun PaymentIntent");
            verify(stripeGateway, never()).createRefund(any(), any());
        }
    }

    // ─── confirmReservationPayment edge: paymentLinkEmail vs null ─────────────

    @Nested
    @DisplayName("confirmReservationPayment Kafka emailTo")
    class ConfirmReservationKafka {

        @Test
        @DisplayName("paymentLinkEmail is null -> emailTo defaults to empty string in Kafka payload")
        void nullPaymentLinkEmail_isOk() {
            Reservation r = buildReservation(2L);
            r.setPaymentLinkEmail(null);
            when(reservationRepository.findByStripeSessionId("sess_n")).thenReturn(Optional.of(r));
            Wallet w = new Wallet();
            when(walletService.getOrCreatePlatformWallet(any(), any())).thenReturn(w);
            when(walletService.getOrCreateEscrowWallet(any(), any())).thenReturn(w);

            stripeService.confirmReservationPayment("sess_n");

            verify(kafkaTemplate, times(2)).send(anyString(), anyString(), any());
            assertThat(r.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
        }
    }

    // ─── confirmServiceRequestPayment: SR without user ────────────────────────

    @Nested
    @DisplayName("confirmServiceRequestPayment: SR without user")
    class ConfirmSrNoUser {

        @Test
        @DisplayName("SR sans user -> ok, pas de notify user, mais admin notify ok")
        void srWithoutUser_skipsUserNotification() {
            ServiceRequest sr = new ServiceRequest();
            sr.setId(7L);
            sr.setTitle("Anonymous SR");
            sr.setStatus(RequestStatus.AWAITING_PAYMENT);
            sr.setPaymentStatus(PaymentStatus.PROCESSING);
            sr.setEstimatedCost(BigDecimal.valueOf(50));
            sr.setUser(null);
            when(serviceRequestRepository.findByStripeSessionId("sess_anon")).thenReturn(Optional.of(sr));

            stripeService.confirmServiceRequestPayment("sess_anon");

            // No user notification
            verify(notificationService, never()).notify(any(), any(), any(), any(), any());
            // But admin notification still happens
            verify(notificationService).notifyAdminsAndManagers(any(), any(), any(), any());
            assertThat(sr.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
        }
    }

    // ─── markServiceRequestPaymentFailed: SR without user ─────────────────────

    @Nested
    @DisplayName("markServiceRequestPaymentFailed: edge cases")
    class MarkSrFailedEdges {

        @Test
        @DisplayName("SR sans user -> ok, pas notify user, admin notifie")
        void srWithoutUser_onlyAdminNotified() {
            ServiceRequest sr = new ServiceRequest();
            sr.setId(8L);
            sr.setTitle("X");
            sr.setStatus(RequestStatus.IN_PROGRESS);
            sr.setUser(null);
            when(serviceRequestRepository.findByStripeSessionId("sess_anon2")).thenReturn(Optional.of(sr));

            stripeService.markServiceRequestPaymentFailed("sess_anon2");

            verify(notificationService, never()).notify(any(), any(), any(), any(), any());
            verify(notificationService).notifyAdminsAndManagers(any(), any(), any(), any());
        }
    }

    // ─── markReservationPaymentFailed: notification swallowed ────────────────

    @Nested
    @DisplayName("markReservationPaymentFailed: notification swallowed")
    class MarkReservationFailedNotify {

        @Test
        @DisplayName("notification fail -> reservation still FAILED")
        void notificationFails_reservationStillFailed() {
            Reservation r = buildReservation(3L);
            when(reservationRepository.findByStripeSessionId("sess_x")).thenReturn(Optional.of(r));
            doThrow(new RuntimeException("notif err"))
                .when(notificationService).notifyAdminsAndManagers(any(), any(), any(), any());

            stripeService.markReservationPaymentFailed("sess_x");

            assertThat(r.getPaymentStatus()).isEqualTo(PaymentStatus.FAILED);
        }
    }

    // ─── confirmReservationPayment: auto-invoice failure swallowed ───────────

    @Nested
    @DisplayName("confirmReservationPayment: auto-invoice failure swallowed")
    class ConfirmResAutoInvoice {

        @Test
        @DisplayName("auto-invoice fails -> still PAID")
        void autoInvoiceFail_paidStill() {
            Reservation r = buildReservation(4L);
            when(reservationRepository.findByStripeSessionId("sess_inv")).thenReturn(Optional.of(r));
            Wallet w = new Wallet();
            when(walletService.getOrCreatePlatformWallet(any(), any())).thenReturn(w);
            when(walletService.getOrCreateEscrowWallet(any(), any())).thenReturn(w);
            doThrow(new RuntimeException("invoice err"))
                .when(autoInvoiceService).generateForReservation(any());

            stripeService.confirmReservationPayment("sess_inv");

            assertThat(r.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
        }

        @Test
        @DisplayName("split reservation payment fails -> still PAID")
        void splitReservationFails_paidStill() {
            Reservation r = buildReservation(5L);
            when(reservationRepository.findByStripeSessionId("sess_s")).thenReturn(Optional.of(r));
            Wallet w = new Wallet();
            when(walletService.getOrCreatePlatformWallet(any(), any())).thenReturn(w);
            when(walletService.getOrCreateEscrowWallet(any(), any())).thenReturn(w);
            doThrow(new RuntimeException("split err"))
                .when(splitPaymentService).splitPayment(any(), any(), any(), any());

            stripeService.confirmReservationPayment("sess_s");

            assertThat(r.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
        }

        @Test
        @DisplayName("wallet creation fails -> still PAID")
        void walletCreationFails_paidStill() {
            Reservation r = buildReservation(6L);
            when(reservationRepository.findByStripeSessionId("sess_w")).thenReturn(Optional.of(r));
            when(walletService.getOrCreatePlatformWallet(any(), any()))
                .thenThrow(new RuntimeException("wallet fail"));

            stripeService.confirmReservationPayment("sess_w");

            assertThat(r.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
        }
    }
}
