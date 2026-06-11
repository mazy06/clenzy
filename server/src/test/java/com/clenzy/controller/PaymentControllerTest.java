package com.clenzy.controller;

import com.clenzy.dto.PaymentOrchestrationRequest;
import com.clenzy.dto.PaymentOrchestrationResult;
import com.clenzy.dto.PaymentSessionRequest;
import com.clenzy.dto.PaymentSessionResponse;
import com.clenzy.model.*;
import com.clenzy.payment.PaymentResult;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.PaymentTransactionRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.service.InterventionPaymentService;
import com.clenzy.service.PaymentOrchestrationService;
import com.clenzy.service.PaymentQueryService;
import com.clenzy.service.PaymentTransactionService;
import com.clenzy.service.StripeService;
import com.clenzy.service.UserService;
import com.clenzy.tenant.TenantContext;
import com.stripe.exception.ApiException;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Tests unitaires de PaymentController.
 *
 * <p>NOTE : depuis le refactor T-ARCH-01, le controller n'injecte plus aucun
 * repository — il delegue a {@code InterventionPaymentService},
 * {@code PaymentQueryService} et {@code PaymentTransactionService}. Les tests
 * conservent leurs stubs repository : les services sont instancies en REEL
 * au-dessus des repositories mockes (comportement bout-en-bout inchange,
 * assertions identiques).</p>
 */
@ExtendWith(MockitoExtension.class)
class PaymentControllerTest {

    @Mock private StripeService stripeService;
    @Mock private PaymentOrchestrationService orchestrationService;
    @Mock private InterventionRepository interventionRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private ServiceRequestRepository serviceRequestRepository;
    @Mock private UserService userService;
    @Mock private PaymentTransactionRepository paymentTransactionRepository;
    @Mock private TenantContext tenantContext;

    private PaymentController controller;
    private Jwt jwt;

    @BeforeEach
    void setUp() throws Exception {
        PaymentTransactionService paymentTransactionService =
                new PaymentTransactionService(paymentTransactionRepository, tenantContext);
        PaymentQueryService paymentQueryService = new PaymentQueryService(
                interventionRepository, reservationRepository, serviceRequestRepository,
                userService, stripeService, tenantContext);
        InterventionPaymentService interventionPaymentService = new InterventionPaymentService(
                interventionRepository, orchestrationService, stripeService,
                paymentTransactionService, tenantContext,
                new com.clenzy.service.access.OrganizationAccessGuard(tenantContext));
        controller = new PaymentController(interventionPaymentService, paymentQueryService, paymentTransactionService);

        jwt = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim("sub", "user-123")
                .claim("email", "user@test.com")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    private PaymentSessionRequest sessionRequest(Long interventionId, BigDecimal amount) {
        PaymentSessionRequest r = new PaymentSessionRequest();
        r.setInterventionId(interventionId);
        r.setAmount(amount);
        return r;
    }

    private PaymentTransaction buildTx(String ref, String sourceType, Long sourceId, TransactionType type, TransactionStatus status) {
        PaymentTransaction tx = new PaymentTransaction();
        tx.setOrganizationId(1L);
        tx.setTransactionRef(ref);
        tx.setSourceType(sourceType);
        tx.setSourceId(sourceId);
        tx.setPaymentType(type);
        tx.setStatus(status);
        tx.setProviderType(PaymentProviderType.STRIPE);
        tx.setAmount(BigDecimal.TEN);
        tx.setCurrency("EUR");
        return tx;
    }

    // ─── createPaymentSession ────────────────────────────────────────────

    @Nested
    @DisplayName("createPaymentSession")
    class CreateSession {
        @Test
        void whenInterventionNotFound_thenError() {
            PaymentSessionRequest request = sessionRequest(1L, BigDecimal.TEN);
            when(interventionRepository.findById(1L)).thenReturn(Optional.empty());

            ResponseEntity<?> response = controller.createPaymentSession(request, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }

        @Test
        void whenAlreadyPaid_thenBadRequest() {
            PaymentSessionRequest request = sessionRequest(1L, BigDecimal.TEN);
            Intervention intervention = mock(Intervention.class);
            when(intervention.getStatus()).thenReturn(InterventionStatus.AWAITING_PAYMENT);
            when(intervention.getPaymentStatus()).thenReturn(PaymentStatus.PAID);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

            ResponseEntity<?> response = controller.createPaymentSession(request, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenStatusCancelled_thenBadRequest() {
            PaymentSessionRequest request = sessionRequest(1L, BigDecimal.TEN);
            Intervention intervention = mock(Intervention.class);
            when(intervention.getStatus()).thenReturn(InterventionStatus.CANCELLED);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

            ResponseEntity<?> response = controller.createPaymentSession(request, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenStatusCompleted_thenBadRequest() {
            PaymentSessionRequest request = sessionRequest(1L, BigDecimal.TEN);
            Intervention intervention = mock(Intervention.class);
            when(intervention.getStatus()).thenReturn(InterventionStatus.COMPLETED);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

            ResponseEntity<?> response = controller.createPaymentSession(request, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenEmailMissing_thenBadRequest() {
            PaymentSessionRequest request = sessionRequest(1L, BigDecimal.TEN);
            Intervention intervention = mock(Intervention.class);
            when(intervention.getStatus()).thenReturn(InterventionStatus.AWAITING_PAYMENT);
            when(intervention.getPaymentStatus()).thenReturn(PaymentStatus.PENDING);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

            Jwt noEmailJwt = Jwt.withTokenValue("t").header("alg", "n").claim("sub", "u")
                    .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60)).build();

            ResponseEntity<?> response = controller.createPaymentSession(request, noEmailJwt);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenOrchestrationSuccess_thenReturnsSession() {
            PaymentSessionRequest request = sessionRequest(7L, new BigDecimal("100"));
            Intervention intervention = mock(Intervention.class);
            when(intervention.getStatus()).thenReturn(InterventionStatus.AWAITING_PAYMENT);
            when(intervention.getPaymentStatus()).thenReturn(PaymentStatus.PENDING);
            when(intervention.getEstimatedCost()).thenReturn(new BigDecimal("100"));
            when(intervention.getCurrency()).thenReturn("EUR");
            when(intervention.getId()).thenReturn(7L);
            when(interventionRepository.findById(7L)).thenReturn(Optional.of(intervention));

            PaymentResult ok = PaymentResult.success("cs_test_abc", "https://stripe.test/cs_test_abc");
            PaymentOrchestrationResult orchResult = new PaymentOrchestrationResult(null, ok, PaymentProviderType.STRIPE);
            when(orchestrationService.initiatePayment(any(PaymentOrchestrationRequest.class)))
                    .thenReturn(orchResult);

            ResponseEntity<?> response = controller.createPaymentSession(request, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            PaymentSessionResponse body = (PaymentSessionResponse) response.getBody();
            assertThat(body).isNotNull();
            assertThat(body.getSessionId()).isEqualTo("cs_test_abc");
            assertThat(body.getUrl()).isEqualTo("https://stripe.test/cs_test_abc");
            verify(intervention).setPaymentStatus(PaymentStatus.PROCESSING);
            verify(interventionRepository).save(intervention);
        }

        @Test
        void whenOrchestrationFails_thenReturns500() {
            PaymentSessionRequest request = sessionRequest(7L, new BigDecimal("100"));
            Intervention intervention = mock(Intervention.class);
            when(intervention.getStatus()).thenReturn(InterventionStatus.AWAITING_PAYMENT);
            when(intervention.getPaymentStatus()).thenReturn(PaymentStatus.PENDING);
            when(intervention.getEstimatedCost()).thenReturn(new BigDecimal("100"));
            when(intervention.getCurrency()).thenReturn(null); // falls back to EUR
            when(interventionRepository.findById(7L)).thenReturn(Optional.of(intervention));

            PaymentResult fail = PaymentResult.failure("Provider down");
            PaymentOrchestrationResult orchResult = new PaymentOrchestrationResult(null, fail, PaymentProviderType.STRIPE);
            when(orchestrationService.initiatePayment(any(PaymentOrchestrationRequest.class)))
                    .thenReturn(orchResult);

            ResponseEntity<?> response = controller.createPaymentSession(request, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(500);
            verify(intervention, never()).setStripeSessionId(anyString());
        }

        @Test
        void whenClientAmountDiffersFromEstimatedCost_thenBadRequest() {
            // Z3-SEC-01 : le montant client n'est qu'un cross-check
            PaymentSessionRequest request = sessionRequest(7L, new BigDecimal("1"));
            Intervention intervention = mock(Intervention.class);
            when(intervention.getStatus()).thenReturn(InterventionStatus.AWAITING_PAYMENT);
            when(intervention.getPaymentStatus()).thenReturn(PaymentStatus.PENDING);
            when(intervention.getEstimatedCost()).thenReturn(new BigDecimal("500"));
            when(interventionRepository.findById(7L)).thenReturn(Optional.of(intervention));

            ResponseEntity<?> response = controller.createPaymentSession(request, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
            verify(orchestrationService, never()).initiatePayment(any());
        }

        @Test
        void whenEstimatedCostMissing_thenBadRequest() {
            PaymentSessionRequest request = sessionRequest(7L, new BigDecimal("100"));
            Intervention intervention = mock(Intervention.class);
            when(intervention.getStatus()).thenReturn(InterventionStatus.AWAITING_PAYMENT);
            when(intervention.getPaymentStatus()).thenReturn(PaymentStatus.PENDING);
            when(intervention.getEstimatedCost()).thenReturn(null);
            when(interventionRepository.findById(7L)).thenReturn(Optional.of(intervention));

            ResponseEntity<?> response = controller.createPaymentSession(request, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
            verify(orchestrationService, never()).initiatePayment(any());
        }

        @Test
        void whenInterventionFromOtherOrg_thenAccessDenied() {
            // findById contourne le filtre Hibernate → l'ownership org doit etre verifie explicitement
            PaymentSessionRequest request = sessionRequest(8L, BigDecimal.TEN);
            Intervention intervention = mock(Intervention.class);
            when(intervention.getOrganizationId()).thenReturn(2L);
            when(interventionRepository.findById(8L)).thenReturn(Optional.of(intervention));
            when(tenantContext.getOrganizationId()).thenReturn(1L);

            assertThatThrownBy(() -> controller.createPaymentSession(request, jwt))
                    .isInstanceOf(AccessDeniedException.class);
            verify(orchestrationService, never()).initiatePayment(any());
            verify(interventionRepository, never()).save(any());
        }
    }

    // ─── createEmbeddedPaymentSession ─────────────────────────────────────

    @Nested
    @DisplayName("createEmbeddedPaymentSession")
    class CreateEmbeddedSession {
        @Test
        void whenInterventionNotFound_then500() {
            PaymentSessionRequest request = sessionRequest(99L, BigDecimal.TEN);
            when(interventionRepository.findById(99L)).thenReturn(Optional.empty());

            ResponseEntity<?> response = controller.createEmbeddedPaymentSession(request, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }

        @Test
        void whenAlreadyPaid_thenBadRequest() {
            PaymentSessionRequest request = sessionRequest(1L, BigDecimal.TEN);
            Intervention intervention = mock(Intervention.class);
            when(intervention.getStatus()).thenReturn(InterventionStatus.AWAITING_PAYMENT);
            when(intervention.getPaymentStatus()).thenReturn(PaymentStatus.PAID);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

            ResponseEntity<?> response = controller.createEmbeddedPaymentSession(request, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenCancelled_thenBadRequest() {
            PaymentSessionRequest request = sessionRequest(1L, BigDecimal.TEN);
            Intervention intervention = mock(Intervention.class);
            when(intervention.getStatus()).thenReturn(InterventionStatus.CANCELLED);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

            ResponseEntity<?> response = controller.createEmbeddedPaymentSession(request, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenEmailMissing_thenBadRequest() {
            PaymentSessionRequest request = sessionRequest(1L, BigDecimal.TEN);
            Intervention intervention = mock(Intervention.class);
            when(intervention.getStatus()).thenReturn(InterventionStatus.AWAITING_PAYMENT);
            when(intervention.getPaymentStatus()).thenReturn(PaymentStatus.PENDING);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

            Jwt noEmailJwt = Jwt.withTokenValue("t").header("alg", "n").claim("sub", "u")
                    .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60)).build();

            ResponseEntity<?> response = controller.createEmbeddedPaymentSession(request, noEmailJwt);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenSuccess_thenReturnsClientSecret() throws StripeException {
            PaymentSessionRequest request = sessionRequest(42L, new BigDecimal("50"));
            Intervention intervention = mock(Intervention.class);
            when(intervention.getStatus()).thenReturn(InterventionStatus.AWAITING_PAYMENT);
            when(intervention.getPaymentStatus()).thenReturn(PaymentStatus.PENDING);
            when(intervention.getEstimatedCost()).thenReturn(new BigDecimal("50"));
            when(intervention.getId()).thenReturn(42L);
            when(interventionRepository.findById(42L)).thenReturn(Optional.of(intervention));

            Session stripeSession = mock(Session.class);
            when(stripeSession.getId()).thenReturn("cs_test_emb");
            when(stripeSession.getClientSecret()).thenReturn("cs_test_emb_secret");
            when(stripeService.createEmbeddedCheckoutSession(eq(42L), eq(new BigDecimal("50")), eq("user@test.com")))
                    .thenReturn(stripeSession);

            ResponseEntity<?> response = controller.createEmbeddedPaymentSession(request, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            PaymentSessionResponse body = (PaymentSessionResponse) response.getBody();
            assertThat(body).isNotNull();
            assertThat(body.getSessionId()).isEqualTo("cs_test_emb");
            assertThat(body.getClientSecret()).isEqualTo("cs_test_emb_secret");
        }

        @Test
        void whenStripeFails_then500() throws StripeException {
            PaymentSessionRequest request = sessionRequest(42L, new BigDecimal("50"));
            Intervention intervention = mock(Intervention.class);
            when(intervention.getStatus()).thenReturn(InterventionStatus.AWAITING_PAYMENT);
            when(intervention.getPaymentStatus()).thenReturn(PaymentStatus.PENDING);
            when(intervention.getEstimatedCost()).thenReturn(new BigDecimal("50"));
            when(interventionRepository.findById(42L)).thenReturn(Optional.of(intervention));

            when(stripeService.createEmbeddedCheckoutSession(anyLong(), any(), anyString()))
                    .thenThrow(new ApiException("Stripe down", null, "code", 500, null));

            ResponseEntity<?> response = controller.createEmbeddedPaymentSession(request, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }

        @Test
        void whenClientAmountDiffersFromEstimatedCost_thenBadRequest() throws StripeException {
            // Z3-SEC-01 : paiement de 1 EUR pour une intervention a 500 EUR -> rejete
            PaymentSessionRequest request = sessionRequest(42L, new BigDecimal("1"));
            Intervention intervention = mock(Intervention.class);
            when(intervention.getStatus()).thenReturn(InterventionStatus.AWAITING_PAYMENT);
            when(intervention.getPaymentStatus()).thenReturn(PaymentStatus.PENDING);
            when(intervention.getEstimatedCost()).thenReturn(new BigDecimal("500"));
            when(interventionRepository.findById(42L)).thenReturn(Optional.of(intervention));

            ResponseEntity<?> response = controller.createEmbeddedPaymentSession(request, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
            verify(stripeService, never()).createEmbeddedCheckoutSession(anyLong(), any(), anyString());
        }

        @Test
        void whenInterventionFromOtherOrg_thenAccessDenied() throws StripeException {
            // findById contourne le filtre Hibernate → l'ownership org doit etre verifie explicitement
            PaymentSessionRequest request = sessionRequest(43L, BigDecimal.TEN);
            Intervention intervention = mock(Intervention.class);
            when(intervention.getOrganizationId()).thenReturn(2L);
            when(interventionRepository.findById(43L)).thenReturn(Optional.of(intervention));
            when(tenantContext.getOrganizationId()).thenReturn(1L);

            assertThatThrownBy(() -> controller.createEmbeddedPaymentSession(request, jwt))
                    .isInstanceOf(AccessDeniedException.class);
            verify(stripeService, never()).createEmbeddedCheckoutSession(anyLong(), any(), anyString());
        }
    }

    // ─── getSessionStatus ────────────────────────────────────────────────

    @Nested
    @DisplayName("getSessionStatus")
    class GetSessionStatus {
        @Test
        void whenInterventionFoundAndPaid_thenReturnsStatus() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            Intervention intervention = mock(Intervention.class);
            when(intervention.getPaymentStatus()).thenReturn(PaymentStatus.PAID);
            when(intervention.getStatus()).thenReturn(InterventionStatus.COMPLETED);
            when(interventionRepository.findByStripeSessionId("sess-1", 1L))
                    .thenReturn(Optional.of(intervention));

            ResponseEntity<?> response = controller.getSessionStatus("sess-1");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            @SuppressWarnings("unchecked")
            Map<String, Object> body = (Map<String, Object>) response.getBody();
            assertThat(body).containsEntry("paymentStatus", "PAID");
        }

        @Test
        void whenInterventionProcessing_thenStripeFallbackConfirms() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            Intervention intervention = mock(Intervention.class);
            when(intervention.getPaymentStatus()).thenReturn(PaymentStatus.PROCESSING);
            when(intervention.getStatus()).thenReturn(InterventionStatus.AWAITING_PAYMENT);
            when(interventionRepository.findByStripeSessionId("sess-proc", 1L))
                    .thenReturn(Optional.of(intervention));

            when(stripeService.isCheckoutSessionPaid("sess-proc")).thenReturn(true);

            ResponseEntity<?> response = controller.getSessionStatus("sess-proc");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(stripeService).confirmPayment("sess-proc");
        }

        @Test
        void whenStripeFails_thenStillReturns200() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            Intervention intervention = mock(Intervention.class);
            when(intervention.getPaymentStatus()).thenReturn(PaymentStatus.PROCESSING);
            when(intervention.getStatus()).thenReturn(InterventionStatus.AWAITING_PAYMENT);
            when(interventionRepository.findByStripeSessionId("sess-err", 1L))
                    .thenReturn(Optional.of(intervention));

            // isCheckoutSessionPaid avale les erreurs Stripe et retourne false
            when(stripeService.isCheckoutSessionPaid("sess-err")).thenReturn(false);

            ResponseEntity<?> response = controller.getSessionStatus("sess-err");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenReservationFoundAndPaid_thenReturnsStatus() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(interventionRepository.findByStripeSessionId("sess-res", 1L))
                    .thenReturn(Optional.empty());
            Reservation reservation = new Reservation();
            reservation.setPaymentStatus(PaymentStatus.PAID);
            reservation.setStatus("CONFIRMED");
            when(reservationRepository.findByStripeSessionId("sess-res"))
                    .thenReturn(Optional.of(reservation));

            ResponseEntity<?> response = controller.getSessionStatus("sess-res");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            @SuppressWarnings("unchecked")
            Map<String, Object> body = (Map<String, Object>) response.getBody();
            assertThat(body).containsEntry("paymentStatus", "PAID");
        }

        @Test
        void whenReservationPendingAndStripePaid_thenConfirms() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(interventionRepository.findByStripeSessionId(anyString(), anyLong()))
                    .thenReturn(Optional.empty());
            Reservation reservation = new Reservation();
            reservation.setPaymentStatus(PaymentStatus.PENDING);
            reservation.setStatus("PENDING");
            when(reservationRepository.findByStripeSessionId("sess-res-pend"))
                    .thenReturn(Optional.of(reservation));

            when(stripeService.isCheckoutSessionPaid("sess-res-pend")).thenReturn(true);

            ResponseEntity<?> response = controller.getSessionStatus("sess-res-pend");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(stripeService).confirmReservationPayment("sess-res-pend");
        }

        @Test
        void whenReservationNullPaymentStatus_thenReturnsPending() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(interventionRepository.findByStripeSessionId(anyString(), anyLong()))
                    .thenReturn(Optional.empty());
            Reservation reservation = new Reservation();
            reservation.setPaymentStatus(null);
            when(reservationRepository.findByStripeSessionId(anyString()))
                    .thenReturn(Optional.of(reservation));

            when(stripeService.isCheckoutSessionPaid(anyString())).thenReturn(false);

            ResponseEntity<?> response = controller.getSessionStatus("sess-null");

            @SuppressWarnings("unchecked")
            Map<String, Object> body = (Map<String, Object>) response.getBody();
            assertThat(body).containsEntry("paymentStatus", "PENDING");
        }

        @Test
        void whenSrFoundAndPaid_thenReturnsStatus() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(interventionRepository.findByStripeSessionId(anyString(), anyLong()))
                    .thenReturn(Optional.empty());
            when(reservationRepository.findByStripeSessionId(anyString()))
                    .thenReturn(Optional.empty());
            ServiceRequest sr = new ServiceRequest();
            sr.setPaymentStatus(PaymentStatus.PAID);
            sr.setStatus(RequestStatus.COMPLETED);
            when(serviceRequestRepository.findByStripeSessionId("sess-sr"))
                    .thenReturn(Optional.of(sr));

            ResponseEntity<?> response = controller.getSessionStatus("sess-sr");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            @SuppressWarnings("unchecked")
            Map<String, Object> body = (Map<String, Object>) response.getBody();
            assertThat(body).containsEntry("paymentStatus", "PAID");
        }

        @Test
        void whenSrPendingAndStripePaid_thenConfirms() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(interventionRepository.findByStripeSessionId(anyString(), anyLong()))
                    .thenReturn(Optional.empty());
            when(reservationRepository.findByStripeSessionId(anyString()))
                    .thenReturn(Optional.empty());
            ServiceRequest sr = new ServiceRequest();
            sr.setPaymentStatus(PaymentStatus.PENDING);
            sr.setStatus(RequestStatus.PENDING);
            when(serviceRequestRepository.findByStripeSessionId("sess-sr-p"))
                    .thenReturn(Optional.of(sr));

            when(stripeService.isCheckoutSessionPaid("sess-sr-p")).thenReturn(true);

            ResponseEntity<?> response = controller.getSessionStatus("sess-sr-p");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(stripeService).confirmServiceRequestPayment("sess-sr-p");
        }

        @Test
        void whenNotFound_thenReturns404() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(interventionRepository.findByStripeSessionId("bad-sess", 1L))
                    .thenReturn(Optional.empty());
            when(reservationRepository.findByStripeSessionId("bad-sess"))
                    .thenReturn(Optional.empty());
            when(serviceRequestRepository.findByStripeSessionId("bad-sess"))
                    .thenReturn(Optional.empty());

            ResponseEntity<?> response = controller.getSessionStatus("bad-sess");

            assertThat(response.getStatusCode().value()).isEqualTo(404);
        }
    }

    // ─── getTransactionStatus ─────────────────────────────────────────────

    @Nested
    @DisplayName("getTransactionStatus")
    class GetTransactionStatus {
        @Test
        void whenFound_thenReturns200() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            PaymentTransaction tx = buildTx("tx-1", "INTERVENTION", 5L, TransactionType.CHECKOUT, TransactionStatus.PENDING);
            when(paymentTransactionRepository.findByTransactionRef("tx-1"))
                    .thenReturn(Optional.of(tx));

            ResponseEntity<?> response = controller.getTransactionStatus("tx-1");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            @SuppressWarnings("unchecked")
            Map<String, Object> body = (Map<String, Object>) response.getBody();
            assertThat(body).containsEntry("transactionRef", "tx-1");
            assertThat(body).containsEntry("providerType", "STRIPE");
        }

        @Test
        void whenWrongOrg_then404() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(99L);
            PaymentTransaction tx = buildTx("tx-2", "INTERVENTION", 5L, TransactionType.CHECKOUT, TransactionStatus.PENDING);
            tx.setOrganizationId(1L);
            when(paymentTransactionRepository.findByTransactionRef("tx-2"))
                    .thenReturn(Optional.of(tx));

            ResponseEntity<?> response = controller.getTransactionStatus("tx-2");

            assertThat(response.getStatusCode().value()).isEqualTo(404);
        }

        @Test
        void whenNotFound_then404() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(paymentTransactionRepository.findByTransactionRef("tx-x"))
                    .thenReturn(Optional.empty());

            ResponseEntity<?> response = controller.getTransactionStatus("tx-x");

            assertThat(response.getStatusCode().value()).isEqualTo(404);
        }
    }

    // ─── getPaymentHistory ────────────────────────────────────────────────

    @Nested
    @DisplayName("getPaymentHistory")
    class GetPaymentHistory {
        @Test
        void whenAdminUser_thenReturnsHistory() {
            User user = mock(User.class);
            when(user.getRole()).thenReturn(UserRole.SUPER_ADMIN);
            when(userService.findByKeycloakId("user-123")).thenReturn(user);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Page<Intervention> page = new PageImpl<>(List.of());
            when(interventionRepository.findPaymentHistory(isNull(), isNull(), any(), eq(1L))).thenReturn(page);

            Page<Reservation> resPage = new PageImpl<>(List.of());
            when(reservationRepository.findPaymentHistory(isNull(), any(), eq(1L))).thenReturn(resPage);

            Page<ServiceRequest> srPage = new PageImpl<>(List.of());
            when(serviceRequestRepository.findPaymentHistory(isNull(), isNull(), any(), eq(1L))).thenReturn(srPage);

            ResponseEntity<?> response = controller.getPaymentHistory(0, 10, null, null, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenHostUser_thenReturnsHistoryFilteredByRequestor() {
            User user = mock(User.class);
            when(user.getRole()).thenReturn(UserRole.HOST);
            when(user.getId()).thenReturn(42L);
            when(userService.findByKeycloakId("user-123")).thenReturn(user);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Page<Intervention> page = new PageImpl<>(List.of());
            when(interventionRepository.findPaymentHistoryByRequestor(eq(42L), isNull(), any(), eq(1L))).thenReturn(page);
            Page<Reservation> resPage = new PageImpl<>(List.of());
            when(reservationRepository.findPaymentHistory(isNull(), any(), eq(1L))).thenReturn(resPage);
            Page<ServiceRequest> srPage = new PageImpl<>(List.of());
            when(serviceRequestRepository.findPaymentHistoryByUser(eq(42L), isNull(), any(), eq(1L))).thenReturn(srPage);

            ResponseEntity<?> response = controller.getPaymentHistory(0, 10, null, null, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(interventionRepository).findPaymentHistoryByRequestor(eq(42L), isNull(), any(), eq(1L));
        }

        @Test
        void whenWithValidStatusFilter_thenReturns200() {
            User user = mock(User.class);
            when(user.getRole()).thenReturn(UserRole.SUPER_ADMIN);
            when(userService.findByKeycloakId("user-123")).thenReturn(user);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            when(interventionRepository.findPaymentHistory(eq(PaymentStatus.PAID), isNull(), any(), eq(1L)))
                    .thenReturn(new PageImpl<>(List.of()));
            // OTA-aware : le contrôleur charge TOUTES les réservations (paymentStatus=null) puis
            // filtre sur le statut effectif du DTO → le stub réservation doit matcher null.
            when(reservationRepository.findPaymentHistory(isNull(), any(), eq(1L)))
                    .thenReturn(new PageImpl<>(List.of()));
            when(serviceRequestRepository.findPaymentHistory(eq(PaymentStatus.PAID), isNull(), any(), eq(1L)))
                    .thenReturn(new PageImpl<>(List.of()));

            ResponseEntity<?> response = controller.getPaymentHistory(0, 10, "PAID", null, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenUserNotFound_thenUnauthorized() {
            when(userService.findByKeycloakId("user-123")).thenReturn(null);

            ResponseEntity<?> response = controller.getPaymentHistory(0, 10, null, null, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(401);
        }

        @Test
        void whenInvalidStatus_thenBadRequest() {
            ResponseEntity<?> response = controller.getPaymentHistory(0, 10, "INVALID_STATUS", null, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }
    }

    // ─── getPaymentSummary ────────────────────────────────────────────────

    @Nested
    @DisplayName("getPaymentSummary")
    class GetPaymentSummary {
        @Test
        void whenAdmin_thenReturnsSummary() {
            User user = mock(User.class);
            when(user.getRole()).thenReturn(UserRole.SUPER_ADMIN);
            when(userService.findByKeycloakId("user-123")).thenReturn(user);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Page<Intervention> page = new PageImpl<>(List.of());
            when(interventionRepository.findPaymentHistory(isNull(), isNull(), any(), eq(1L))).thenReturn(page);
            when(reservationRepository.findAllWithPayment(1L)).thenReturn(List.of());
            when(serviceRequestRepository.findAllAwaitingPayment(1L)).thenReturn(List.of());

            ResponseEntity<?> response = controller.getPaymentSummary(null, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenHost_thenForceSelfHostId() {
            User user = mock(User.class);
            when(user.getRole()).thenReturn(UserRole.HOST);
            when(user.getId()).thenReturn(7L);
            when(userService.findByKeycloakId("user-123")).thenReturn(user);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Page<Intervention> page = new PageImpl<>(List.of());
            when(interventionRepository.findPaymentHistoryByRequestor(eq(7L), isNull(), any(), eq(1L))).thenReturn(page);
            when(reservationRepository.findAllWithPayment(1L)).thenReturn(List.of());
            when(serviceRequestRepository.findAllAwaitingPayment(1L)).thenReturn(List.of());

            ResponseEntity<?> response = controller.getPaymentSummary(99L, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(interventionRepository).findPaymentHistoryByRequestor(eq(7L), isNull(), any(), eq(1L));
        }

        @Test
        void whenWithReservations_thenAccumulatesPaid() {
            User user = mock(User.class);
            when(user.getRole()).thenReturn(UserRole.SUPER_ADMIN);
            when(userService.findByKeycloakId("user-123")).thenReturn(user);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Intervention paidI = mock(Intervention.class);
            when(paidI.getEstimatedCost()).thenReturn(new BigDecimal("100"));
            when(paidI.getPaymentStatus()).thenReturn(PaymentStatus.PAID);
            Intervention refundedI = mock(Intervention.class);
            when(refundedI.getEstimatedCost()).thenReturn(new BigDecimal("30"));
            when(refundedI.getPaymentStatus()).thenReturn(PaymentStatus.REFUNDED);
            Intervention pendingI = mock(Intervention.class);
            when(pendingI.getEstimatedCost()).thenReturn(null);
            when(pendingI.getPaymentStatus()).thenReturn(PaymentStatus.PENDING);
            Page<Intervention> page = new PageImpl<>(List.of(paidI, refundedI, pendingI));
            when(interventionRepository.findPaymentHistory(isNull(), isNull(), any(), eq(1L))).thenReturn(page);

            Reservation res = new Reservation();
            res.setTotalPrice(new BigDecimal("200"));
            res.setPaymentStatus(PaymentStatus.PAID);
            when(reservationRepository.findAllWithPayment(1L)).thenReturn(List.of(res));

            ServiceRequest sr = new ServiceRequest();
            sr.setEstimatedCost(new BigDecimal("15"));
            when(serviceRequestRepository.findAllAwaitingPayment(1L)).thenReturn(List.of(sr));

            ResponseEntity<?> response = controller.getPaymentSummary(null, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenUserNotFound_thenUnauthorized() {
            when(userService.findByKeycloakId("user-123")).thenReturn(null);

            ResponseEntity<?> response = controller.getPaymentSummary(null, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(401);
        }
    }

    // ─── getHostsWithPayments ─────────────────────────────────────────────

    @Nested
    @DisplayName("getHostsWithPayments")
    class GetHostsWithPayments {
        @Test
        void whenCalled_thenReturnsHosts() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            Object[] row = new Object[]{1L, "John", "Doe"};
            List<Object[]> rows = new java.util.ArrayList<>();
            rows.add(row);
            when(interventionRepository.findDistinctHostsWithPayments(1L)).thenReturn(rows);
            when(serviceRequestRepository.findAllAwaitingPayment(1L)).thenReturn(List.of());

            ResponseEntity<?> response = controller.getHostsWithPayments();

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenSrHasAdditionalHost_thenMerges() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(interventionRepository.findDistinctHostsWithPayments(1L)).thenReturn(List.of());

            User u = new User();
            u.setId(33L);
            u.setFirstName("Sue");
            u.setLastName("Smith");
            ServiceRequest sr = new ServiceRequest();
            sr.setUser(u);
            when(serviceRequestRepository.findAllAwaitingPayment(1L)).thenReturn(List.of(sr));

            ResponseEntity<?> response = controller.getHostsWithPayments();

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> body = (List<Map<String, Object>>) response.getBody();
            assertThat(body).hasSize(1);
            assertThat(body.get(0)).containsEntry("id", 33L);
        }

        @Test
        void whenError_thenReturns500() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(interventionRepository.findDistinctHostsWithPayments(1L))
                    .thenThrow(new RuntimeException("DB error"));

            ResponseEntity<?> response = controller.getHostsWithPayments();

            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }
    }

    // ─── refundPayment ────────────────────────────────────────────────────

    @Nested
    @DisplayName("refundPayment")
    class RefundPayment {
        @Test
        void whenNotPaid_thenBadRequest() {
            Intervention intervention = mock(Intervention.class);
            when(intervention.getPaymentStatus()).thenReturn(PaymentStatus.PENDING);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

            ResponseEntity<?> response = controller.refundPayment(1L);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenPaidLegacy_thenStripeRefund() throws StripeException {
            Intervention intervention = mock(Intervention.class);
            when(intervention.getPaymentStatus()).thenReturn(PaymentStatus.PAID);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(paymentTransactionRepository.findByOrganizationIdAndSourceTypeAndSourceId(1L, "INTERVENTION", 1L))
                    .thenReturn(List.of());

            ResponseEntity<?> response = controller.refundPayment(1L);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(stripeService).refundPayment(1L);
        }

        @Test
        void whenPaidWithOrchestrator_thenProcessRefundSuccess() throws Exception {
            Intervention intervention = mock(Intervention.class);
            when(intervention.getPaymentStatus()).thenReturn(PaymentStatus.PAID);
            when(interventionRepository.findById(2L)).thenReturn(Optional.of(intervention));
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            PaymentTransaction completed = buildTx("tx-3", "INTERVENTION", 2L, TransactionType.CHECKOUT, TransactionStatus.COMPLETED);
            when(paymentTransactionRepository.findByOrganizationIdAndSourceTypeAndSourceId(1L, "INTERVENTION", 2L))
                    .thenReturn(List.of(completed));

            PaymentResult okRefund = PaymentResult.success("rf_1", null, "REFUNDED");
            PaymentOrchestrationResult orchResult = new PaymentOrchestrationResult(completed, okRefund, PaymentProviderType.STRIPE);
            when(orchestrationService.processRefund(eq("tx-3"), isNull(), anyString())).thenReturn(orchResult);

            ResponseEntity<?> response = controller.refundPayment(2L);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(stripeService, never()).refundPayment(anyLong());
        }

        @Test
        void whenOrchestratorFails_then500() throws Exception {
            Intervention intervention = mock(Intervention.class);
            when(intervention.getPaymentStatus()).thenReturn(PaymentStatus.PAID);
            when(interventionRepository.findById(3L)).thenReturn(Optional.of(intervention));
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            PaymentTransaction completed = buildTx("tx-4", "INTERVENTION", 3L, TransactionType.CHECKOUT, TransactionStatus.COMPLETED);
            when(paymentTransactionRepository.findByOrganizationIdAndSourceTypeAndSourceId(1L, "INTERVENTION", 3L))
                    .thenReturn(List.of(completed));

            PaymentResult failRefund = PaymentResult.failure("Insufficient funds");
            PaymentOrchestrationResult orchResult = new PaymentOrchestrationResult(completed, failRefund, PaymentProviderType.STRIPE);
            when(orchestrationService.processRefund(anyString(), any(), anyString())).thenReturn(orchResult);

            ResponseEntity<?> response = controller.refundPayment(3L);

            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }

        @Test
        void whenStripeRefundFails_then500() throws StripeException {
            Intervention intervention = mock(Intervention.class);
            when(intervention.getPaymentStatus()).thenReturn(PaymentStatus.PAID);
            when(interventionRepository.findById(4L)).thenReturn(Optional.of(intervention));
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(paymentTransactionRepository.findByOrganizationIdAndSourceTypeAndSourceId(1L, "INTERVENTION", 4L))
                    .thenReturn(List.of());

            doThrow(new ApiException("Stripe down", null, "code", 500, null))
                    .when(stripeService).refundPayment(4L);

            ResponseEntity<?> response = controller.refundPayment(4L);

            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }

        @Test
        void whenNotFound_thenReturns500() {
            when(interventionRepository.findById(99L)).thenReturn(Optional.empty());

            ResponseEntity<?> response = controller.refundPayment(99L);

            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }

        @Test
        void whenInterventionFromOtherOrg_thenAccessDenied() throws Exception {
            // findById contourne le filtre Hibernate → l'ownership org doit etre verifie explicitement
            Intervention intervention = mock(Intervention.class);
            when(intervention.getOrganizationId()).thenReturn(2L);
            when(interventionRepository.findById(5L)).thenReturn(Optional.of(intervention));
            when(tenantContext.getOrganizationId()).thenReturn(1L);

            assertThatThrownBy(() -> controller.refundPayment(5L))
                    .isInstanceOf(AccessDeniedException.class);
            verify(orchestrationService, never()).processRefund(anyString(), any(), anyString());
            verify(stripeService, never()).refundPayment(anyLong());
        }
    }

    // ─── Branches additionnelles ────────────────────────────────────────────

    @Nested
    @DisplayName("createPaymentSession - additional branches")
    class CreateSessionAdditional {

        @Test
        void whenOrchestrationResultHasNullErrorMessage_thenReturns500WithFallback() {
            PaymentSessionRequest request = sessionRequest(7L, new BigDecimal("100"));
            Intervention intervention = mock(Intervention.class);
            when(intervention.getStatus()).thenReturn(InterventionStatus.AWAITING_PAYMENT);
            when(intervention.getPaymentStatus()).thenReturn(PaymentStatus.PENDING);
            when(intervention.getEstimatedCost()).thenReturn(new BigDecimal("100"));
            when(intervention.getCurrency()).thenReturn("EUR");
            when(interventionRepository.findById(7L)).thenReturn(Optional.of(intervention));

            // PaymentResult is null in the result → fallback message
            PaymentOrchestrationResult orchResult = new PaymentOrchestrationResult(null, null, PaymentProviderType.STRIPE);
            when(orchestrationService.initiatePayment(any(PaymentOrchestrationRequest.class)))
                    .thenReturn(orchResult);

            ResponseEntity<?> response = controller.createPaymentSession(request, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }

        @Test
        void whenOrchestrationThrowsRuntime_thenReturns500() {
            PaymentSessionRequest request = sessionRequest(7L, new BigDecimal("100"));
            Intervention intervention = mock(Intervention.class);
            when(intervention.getStatus()).thenReturn(InterventionStatus.AWAITING_PAYMENT);
            when(intervention.getPaymentStatus()).thenReturn(PaymentStatus.PENDING);
            when(intervention.getEstimatedCost()).thenReturn(new BigDecimal("100"));
            when(intervention.getCurrency()).thenReturn("EUR");
            when(interventionRepository.findById(7L)).thenReturn(Optional.of(intervention));

            when(orchestrationService.initiatePayment(any(PaymentOrchestrationRequest.class)))
                    .thenThrow(new RuntimeException("boom"));

            ResponseEntity<?> response = controller.createPaymentSession(request, jwt);
            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }
    }

    // ─── getSessionStatus ─────────────────────────────────────────────────

    @Nested
    @DisplayName("getSessionStatus - additional branches")
    class GetSessionStatusAdditional {

        @Test
        void whenInterventionPaidNotProcessing_thenNoStripeCall() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            Intervention intervention = mock(Intervention.class);
            when(intervention.getPaymentStatus()).thenReturn(PaymentStatus.PAID);
            when(intervention.getStatus()).thenReturn(InterventionStatus.COMPLETED);
            when(interventionRepository.findByStripeSessionId("sess-paid", 1L))
                    .thenReturn(Optional.of(intervention));

            ResponseEntity<?> response = controller.getSessionStatus("sess-paid");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            // No interaction with Stripe since not in PROCESSING
            verify(stripeService, never()).confirmPayment(anyString());
        }

        @Test
        void whenInterventionProcessing_butStripeNotPaid_thenNoConfirm() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            Intervention intervention = mock(Intervention.class);
            when(intervention.getPaymentStatus()).thenReturn(PaymentStatus.PROCESSING);
            when(intervention.getStatus()).thenReturn(InterventionStatus.AWAITING_PAYMENT);
            when(interventionRepository.findByStripeSessionId("sess-not-paid", 1L))
                    .thenReturn(Optional.of(intervention));

            when(stripeService.isCheckoutSessionPaid("sess-not-paid")).thenReturn(false);

            ResponseEntity<?> response = controller.getSessionStatus("sess-not-paid");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(stripeService, never()).confirmPayment(anyString());
        }

        @Test
        void whenReservationStripeNotPaid_thenNoConfirm() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(interventionRepository.findByStripeSessionId(anyString(), anyLong()))
                    .thenReturn(Optional.empty());

            Reservation reservation = new Reservation();
            reservation.setPaymentStatus(PaymentStatus.PENDING);
            reservation.setStatus("PENDING");
            when(reservationRepository.findByStripeSessionId("sess-res-unpaid"))
                    .thenReturn(Optional.of(reservation));

            when(stripeService.isCheckoutSessionPaid("sess-res-unpaid")).thenReturn(false);

            ResponseEntity<?> response = controller.getSessionStatus("sess-res-unpaid");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(stripeService, never()).confirmReservationPayment(anyString());
        }

        @Test
        void whenReservationStripeThrows_thenStillReturns200() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(interventionRepository.findByStripeSessionId(anyString(), anyLong()))
                    .thenReturn(Optional.empty());

            Reservation reservation = new Reservation();
            reservation.setPaymentStatus(PaymentStatus.PENDING);
            when(reservationRepository.findByStripeSessionId("sess-res-err"))
                    .thenReturn(Optional.of(reservation));

            // isCheckoutSessionPaid avale les erreurs Stripe et retourne false
            when(stripeService.isCheckoutSessionPaid("sess-res-err")).thenReturn(false);

            ResponseEntity<?> response = controller.getSessionStatus("sess-res-err");
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenSrPaidNotProcessing_thenNoConfirm() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(interventionRepository.findByStripeSessionId(anyString(), anyLong()))
                    .thenReturn(Optional.empty());
            when(reservationRepository.findByStripeSessionId(anyString()))
                    .thenReturn(Optional.empty());

            ServiceRequest sr = new ServiceRequest();
            sr.setPaymentStatus(PaymentStatus.PAID);
            sr.setStatus(RequestStatus.COMPLETED);
            when(serviceRequestRepository.findByStripeSessionId("sess-sr-paid"))
                    .thenReturn(Optional.of(sr));

            ResponseEntity<?> response = controller.getSessionStatus("sess-sr-paid");
            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(stripeService, never()).confirmServiceRequestPayment(anyString());
        }

        @Test
        void whenSrStripeThrows_thenStillReturns200() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(interventionRepository.findByStripeSessionId(anyString(), anyLong()))
                    .thenReturn(Optional.empty());
            when(reservationRepository.findByStripeSessionId(anyString()))
                    .thenReturn(Optional.empty());

            ServiceRequest sr = new ServiceRequest();
            sr.setPaymentStatus(PaymentStatus.PENDING);
            sr.setStatus(RequestStatus.PENDING);
            when(serviceRequestRepository.findByStripeSessionId("sess-sr-err"))
                    .thenReturn(Optional.of(sr));

            // isCheckoutSessionPaid avale les erreurs Stripe et retourne false
            when(stripeService.isCheckoutSessionPaid("sess-sr-err")).thenReturn(false);

            ResponseEntity<?> response = controller.getSessionStatus("sess-sr-err");
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenSrStripeNotPaid_thenNoConfirm() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(interventionRepository.findByStripeSessionId(anyString(), anyLong()))
                    .thenReturn(Optional.empty());
            when(reservationRepository.findByStripeSessionId(anyString()))
                    .thenReturn(Optional.empty());

            ServiceRequest sr = new ServiceRequest();
            sr.setPaymentStatus(PaymentStatus.PENDING);
            sr.setStatus(RequestStatus.PENDING);
            when(serviceRequestRepository.findByStripeSessionId("sess-sr-unpaid"))
                    .thenReturn(Optional.of(sr));

            when(stripeService.isCheckoutSessionPaid("sess-sr-unpaid")).thenReturn(false);

            ResponseEntity<?> response = controller.getSessionStatus("sess-sr-unpaid");
            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(stripeService, never()).confirmServiceRequestPayment(anyString());
        }

        @Test
        void whenReservationFromOtherOrg_thenNotFoundAndNoConfirm() {
            // Durcissement T-ARCH-01 : findByStripeSessionId(reservation) ne passe pas par le
            // filtre Hibernate → une reservation d'une autre org est filtree (introuvable),
            // pattern aligne sur le lookup intervention (deja org-scope) et transaction-status.
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(tenantContext.getOrganizationId()).thenReturn(1L);
            when(interventionRepository.findByStripeSessionId("sess-cross-res", 1L))
                    .thenReturn(Optional.empty());
            Reservation reservation = new Reservation();
            reservation.setOrganizationId(2L);
            reservation.setPaymentStatus(PaymentStatus.PENDING);
            when(reservationRepository.findByStripeSessionId("sess-cross-res"))
                    .thenReturn(Optional.of(reservation));
            when(serviceRequestRepository.findByStripeSessionId("sess-cross-res"))
                    .thenReturn(Optional.empty());

            ResponseEntity<?> response = controller.getSessionStatus("sess-cross-res");

            assertThat(response.getStatusCode().value()).isEqualTo(404);
            verify(stripeService, never()).isCheckoutSessionPaid(anyString());
            verify(stripeService, never()).confirmReservationPayment(anyString());
        }

        @Test
        void whenServiceRequestFromOtherOrg_thenNotFoundAndNoConfirm() {
            // Durcissement T-ARCH-01 : meme validation d'org explicite pour les SR.
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(tenantContext.getOrganizationId()).thenReturn(1L);
            when(interventionRepository.findByStripeSessionId("sess-cross-sr", 1L))
                    .thenReturn(Optional.empty());
            when(reservationRepository.findByStripeSessionId("sess-cross-sr"))
                    .thenReturn(Optional.empty());
            ServiceRequest sr = new ServiceRequest();
            sr.setOrganizationId(2L);
            sr.setPaymentStatus(PaymentStatus.PENDING);
            when(serviceRequestRepository.findByStripeSessionId("sess-cross-sr"))
                    .thenReturn(Optional.of(sr));

            ResponseEntity<?> response = controller.getSessionStatus("sess-cross-sr");

            assertThat(response.getStatusCode().value()).isEqualTo(404);
            verify(stripeService, never()).isCheckoutSessionPaid(anyString());
            verify(stripeService, never()).confirmServiceRequestPayment(anyString());
        }
    }

    // ─── getPaymentHistory - additional branches ──────────────────────────

    @Nested
    @DisplayName("getPaymentHistory - additional branches")
    class GetPaymentHistoryAdditional {

        @Test
        void whenWithHostIdFilter_thenAdminPasses() {
            User user = mock(User.class);
            when(user.getRole()).thenReturn(UserRole.SUPER_ADMIN);
            when(userService.findByKeycloakId("user-123")).thenReturn(user);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Page<Intervention> page = new PageImpl<>(List.of());
            when(interventionRepository.findPaymentHistory(isNull(), eq(42L), any(), eq(1L))).thenReturn(page);
            Page<Reservation> resPage = new PageImpl<>(List.of());
            when(reservationRepository.findPaymentHistory(isNull(), any(), eq(1L))).thenReturn(resPage);
            Page<ServiceRequest> srPage = new PageImpl<>(List.of());
            when(serviceRequestRepository.findPaymentHistory(isNull(), eq(42L), any(), eq(1L))).thenReturn(srPage);

            ResponseEntity<?> response = controller.getPaymentHistory(0, 10, null, 42L, jwt);
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenInterventionsAndReservationsExist_thenMergedAndPaginated() {
            User user = mock(User.class);
            when(user.getRole()).thenReturn(UserRole.SUPER_ADMIN);
            when(userService.findByKeycloakId("user-123")).thenReturn(user);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Intervention i = mock(Intervention.class);
            when(i.getId()).thenReturn(1L);
            when(i.getEstimatedCost()).thenReturn(new BigDecimal("100"));
            when(i.getPaymentStatus()).thenReturn(PaymentStatus.PAID);
            when(i.getTitle()).thenReturn("Menage Airbnb — Loft Paris");
            Property prop = mock(Property.class);
            when(prop.getName()).thenReturn("Loft Paris");
            when(i.getProperty()).thenReturn(prop);
            when(i.getPaidAt()).thenReturn(LocalDateTime.of(2025, 6, 1, 10, 0));
            User requestor = mock(User.class);
            when(requestor.getId()).thenReturn(7L);
            when(requestor.getFullName()).thenReturn("Jean Dupont");
            when(i.getRequestor()).thenReturn(requestor);

            Reservation r = new Reservation();
            r.setId(2L);
            r.setSource("airbnb");
            Property rProp = new Property();
            rProp.setName("Studio");
            r.setProperty(rProp);
            r.setTotalPrice(new BigDecimal("200"));
            r.setPaymentStatus(PaymentStatus.PAID);
            r.setCheckIn(java.time.LocalDate.of(2025, 5, 10));
            r.setCheckOut(java.time.LocalDate.of(2025, 5, 15));
            r.setPaidAt(LocalDateTime.of(2025, 5, 11, 12, 0));
            r.setGuestName("Guest A");
            r.setPaymentLinkEmail("guesta@test.com");

            ServiceRequest sr = new ServiceRequest();
            sr.setId(3L);
            sr.setTitle("Reparation");
            sr.setEstimatedCost(new BigDecimal("50"));
            sr.setPaymentStatus(PaymentStatus.PENDING);
            sr.setStatus(RequestStatus.PENDING);
            sr.setCreatedAt(LocalDateTime.of(2025, 7, 1, 9, 0));

            Page<Intervention> ip = new PageImpl<>(List.of(i));
            when(interventionRepository.findPaymentHistory(isNull(), isNull(), any(), eq(1L))).thenReturn(ip);
            when(reservationRepository.findPaymentHistory(isNull(), any(), eq(1L)))
                    .thenReturn(new PageImpl<>(List.of(r)));
            when(serviceRequestRepository.findPaymentHistory(isNull(), isNull(), any(), eq(1L)))
                    .thenReturn(new PageImpl<>(List.of(sr)));

            ResponseEntity<?> response = controller.getPaymentHistory(0, 2, null, null, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            @SuppressWarnings("unchecked")
            Map<String, Object> body = (Map<String, Object>) response.getBody();
            assertThat(body).containsEntry("totalElements", 3);
        }
    }

    // ─── getPaymentSummary - additional branches ──────────────────────────

    @Nested
    @DisplayName("getPaymentSummary - additional branches")
    class GetPaymentSummaryAdditional {

        @Test
        void whenAdminAndAllStatusesPresent_thenAggregatesCorrectly() {
            User user = mock(User.class);
            when(user.getRole()).thenReturn(UserRole.SUPER_ADMIN);
            when(userService.findByKeycloakId("user-123")).thenReturn(user);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Intervention paid = mock(Intervention.class);
            when(paid.getEstimatedCost()).thenReturn(new BigDecimal("100"));
            when(paid.getPaymentStatus()).thenReturn(PaymentStatus.PAID);
            Intervention refunded = mock(Intervention.class);
            when(refunded.getEstimatedCost()).thenReturn(new BigDecimal("50"));
            when(refunded.getPaymentStatus()).thenReturn(PaymentStatus.REFUNDED);

            Page<Intervention> ip = new PageImpl<>(List.of(paid, refunded));
            when(interventionRepository.findPaymentHistory(isNull(), isNull(), any(), eq(1L))).thenReturn(ip);

            Reservation rRef = new Reservation();
            rRef.setTotalPrice(new BigDecimal("30"));
            rRef.setPaymentStatus(PaymentStatus.REFUNDED);
            Reservation rPending = new Reservation();
            rPending.setTotalPrice(new BigDecimal("70"));
            rPending.setPaymentStatus(PaymentStatus.PENDING);
            when(reservationRepository.findAllWithPayment(1L)).thenReturn(List.of(rRef, rPending));

            ServiceRequest awaitingSr = new ServiceRequest();
            awaitingSr.setEstimatedCost(new BigDecimal("15"));
            when(serviceRequestRepository.findAllAwaitingPayment(1L)).thenReturn(List.of(awaitingSr));

            ResponseEntity<?> response = controller.getPaymentSummary(null, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenSrAwaitingPaymentNullEstimatedCost_thenTreatsAsZero() {
            User user = mock(User.class);
            when(user.getRole()).thenReturn(UserRole.SUPER_ADMIN);
            when(userService.findByKeycloakId("user-123")).thenReturn(user);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Page<Intervention> ip = new PageImpl<>(List.of());
            when(interventionRepository.findPaymentHistory(isNull(), isNull(), any(), eq(1L))).thenReturn(ip);
            when(reservationRepository.findAllWithPayment(1L)).thenReturn(List.of());

            ServiceRequest sr = new ServiceRequest();
            sr.setEstimatedCost(null);
            when(serviceRequestRepository.findAllAwaitingPayment(1L)).thenReturn(List.of(sr));

            ResponseEntity<?> response = controller.getPaymentSummary(null, jwt);
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }

    // ─── resolveCurrentUser branches ──────────────────────────────────────

    @Nested
    @DisplayName("resolveCurrentUser - lookup by email fallback")
    class ResolveCurrentUserFallback {

        @Test
        void whenKeycloakIdAbsentInDb_thenFallsBackToEmail() {
            when(userService.findByKeycloakId("user-123")).thenReturn(null);
            User u = mock(User.class);
            when(u.getRole()).thenReturn(UserRole.SUPER_ADMIN);
            when(userService.findByEmail(anyString())).thenReturn(u);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Page<Intervention> ip = new PageImpl<>(List.of());
            when(interventionRepository.findPaymentHistory(isNull(), isNull(), any(), eq(1L))).thenReturn(ip);
            when(reservationRepository.findPaymentHistory(isNull(), any(), eq(1L)))
                    .thenReturn(new PageImpl<>(List.of()));
            when(serviceRequestRepository.findPaymentHistory(isNull(), isNull(), any(), eq(1L)))
                    .thenReturn(new PageImpl<>(List.of()));

            ResponseEntity<?> response = controller.getPaymentHistory(0, 10, null, null, jwt);
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }

    // ─── getHostsWithPayments - additional branches ────────────────────────

    @Nested
    @DisplayName("getHostsWithPayments - additional branches")
    class GetHostsAdditional {

        @Test
        void whenSrHostAlreadyInInterventions_thenNotDuplicated() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            Object[] row = new Object[]{33L, "John", "Doe"};
            List<Object[]> rows = new java.util.ArrayList<>();
            rows.add(row);
            when(interventionRepository.findDistinctHostsWithPayments(1L)).thenReturn(rows);

            User u = new User();
            u.setId(33L); // same id as the row
            u.setFirstName("John");
            u.setLastName("Doe");
            ServiceRequest sr = new ServiceRequest();
            sr.setUser(u);
            when(serviceRequestRepository.findAllAwaitingPayment(1L)).thenReturn(List.of(sr));

            ResponseEntity<?> response = controller.getHostsWithPayments();
            assertThat(response.getStatusCode().value()).isEqualTo(200);
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> body = (List<Map<String, Object>>) response.getBody();
            assertThat(body).hasSize(1);
        }
    }
}
