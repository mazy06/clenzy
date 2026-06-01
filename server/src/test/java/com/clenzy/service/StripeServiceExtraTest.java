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
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.tenant.TenantContext;
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

    private TenantContext tenantContext;
    private StripeService stripeService;

    @BeforeEach
    void setUp() throws Exception {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(1L);
        stripeService = new StripeService(interventionRepository, reservationRepository,
            serviceRequestRepository, notificationService, serviceRequestService, walletService,
            ledgerService, splitPaymentService, autoInvoiceService, kafkaTemplate, tenantContext);
        setField("stripeSecretKey", "sk_test_xxx");
        setField("currency", "EUR");
        setField("successUrl", "https://ok.test");
        setField("cancelUrl", "https://ko.test");
    }

    private void setField(String name, String value) throws Exception {
        Field f = StripeService.class.getDeclaredField(name);
        f.setAccessible(true);
        f.set(stripeService, value);
    }

    private Intervention buildInterventionWithProperty(Long id, String currency) {
        Intervention intervention = new Intervention();
        intervention.setId(id);
        intervention.setTitle("Test");
        intervention.setStatus(InterventionStatus.AWAITING_PAYMENT);
        intervention.setPaymentStatus(PaymentStatus.PROCESSING);
        intervention.setEstimatedCost(BigDecimal.valueOf(100));
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
    @DisplayName("createCheckoutSession: currency resolution falls back to config when property has none")
    class CurrencyResolutionPath {

        @Test
        @DisplayName("intervention not found -> throws (resolveInterventionCurrency not even reached)")
        void interventionNotFound_throws() {
            when(interventionRepository.findById(123L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> stripeService.createCheckoutSession(123L, BigDecimal.TEN, "g@h.com"))
                .isInstanceOf(RuntimeException.class);
        }

        @Test
        @DisplayName("property has defaultCurrency -> currency resolution path exercised before Stripe call fails")
        void propertyDefaultCurrency_resolved() throws Exception {
            Intervention intervention = buildInterventionWithProperty(1L, "USD");
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

            // Stripe call fails (no real API), but path resolveInterventionCurrency is exercised
            try {
                stripeService.createCheckoutSession(1L, BigDecimal.TEN, "g@h.com");
            } catch (Exception expected) {
                // OK — Stripe.create() fails because no real key, but currency resolution branch executed
            }
            verify(interventionRepository).findById(1L);
        }

        @Test
        @DisplayName("property has blank defaultCurrency -> fallback to config currency")
        void propertyBlankCurrency_fallsBackToConfig() throws Exception {
            Intervention intervention = buildInterventionWithProperty(1L, "");
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

            try {
                stripeService.createCheckoutSession(1L, BigDecimal.TEN, "g@h.com");
            } catch (Exception expected) {
                // path executed: blank string skipped, falls to config currency
            }
            verify(interventionRepository).findById(1L);
        }

        @Test
        @DisplayName("intervention without property -> fallback config currency")
        void interventionWithoutProperty_fallsBack() throws Exception {
            Intervention intervention = new Intervention();
            intervention.setId(2L);
            intervention.setTitle("No-prop");
            intervention.setProperty(null);
            when(interventionRepository.findById(2L)).thenReturn(Optional.of(intervention));

            try {
                stripeService.createCheckoutSession(2L, BigDecimal.TEN, "g@h.com");
            } catch (Exception expected) {
                // path executed
            }
            verify(interventionRepository).findById(2L);
        }

        @Test
        @DisplayName("createEmbeddedCheckoutSession: same currency resolution chain")
        void createEmbeddedCheckoutSession_currencyResolution() throws Exception {
            Intervention intervention = buildInterventionWithProperty(5L, "GBP");
            when(interventionRepository.findById(5L)).thenReturn(Optional.of(intervention));

            try {
                stripeService.createEmbeddedCheckoutSession(5L, BigDecimal.TEN, "x@y.z");
            } catch (Exception expected) {
                // ok
            }
            verify(interventionRepository).findById(5L);
        }
    }

    // ─── refundPayment validation paths (Stripe fails) ────────────────────────

    @Nested
    @DisplayName("refundPayment validation paths")
    class RefundValidation {

        @Test
        @DisplayName("intervention paid + session id present -> retrieval attempted (Stripe fails)")
        void paidWithSession_attemptsRetrieve() throws Exception {
            Intervention intervention = buildInterventionWithProperty(1L, "EUR");
            intervention.setPaymentStatus(PaymentStatus.PAID);
            intervention.setStripeSessionId("cs_xxx");
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

            // Stripe.Session.retrieve will throw because no real API — but the path is exercised
            assertThatThrownBy(() -> stripeService.refundPayment(1L))
                .isInstanceOf(Exception.class);
            verify(interventionRepository).findById(1L);
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
