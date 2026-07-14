package com.clenzy.service;

import com.clenzy.dto.PaymentOrchestrationRequest;
import com.clenzy.dto.PaymentOrchestrationResult;
import com.clenzy.model.PaymentProviderType;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.RequestStatus;
import com.clenzy.model.ServiceRequest;
import com.clenzy.payment.PaymentResult;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.ServiceRequestRepository;
import com.stripe.model.checkout.Session;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Tests de ServiceRequestPaymentService : création de session (orchestrée
 * multi-provider, Vague 5) + vérification du paiement (fallback Stripe).
 */
@ExtendWith(MockitoExtension.class)
class ServiceRequestPaymentServiceTest {

    @Mock private ServiceRequestRepository serviceRequestRepository;
    @Mock private StripeService stripeService;
    @Mock private StripeGateway stripeGateway;
    @Mock private PaymentOrchestrationService orchestrationService;
    @Mock private PlatformTransactionManager transactionManager;
    @Mock private com.clenzy.service.access.OrganizationAccessGuard organizationAccessGuard;

    private ServiceRequestPaymentService service;

    @BeforeEach
    void setUp() throws Exception {
        service = new ServiceRequestPaymentService(serviceRequestRepository, stripeService,
                stripeGateway, orchestrationService, organizationAccessGuard, transactionManager);
        Field f = ServiceRequestPaymentService.class.getDeclaredField("currency");
        f.setAccessible(true);
        f.set(service, "EUR");
    }

    private ServiceRequest buildSr(Long id, PaymentStatus paymentStatus, String sessionId) {
        ServiceRequest sr = new ServiceRequest();
        sr.setId(id);
        sr.setPaymentStatus(paymentStatus);
        sr.setStripeSessionId(sessionId);
        return sr;
    }

    private ServiceRequest buildPayableSr(Long id) {
        ServiceRequest sr = new ServiceRequest();
        sr.setId(id);
        sr.setOrganizationId(3L);
        sr.setTitle("Fuite robinet");
        sr.setStatus(RequestStatus.AWAITING_PAYMENT);
        sr.setEstimatedCost(new BigDecimal("120.00"));
        return sr;
    }

    @Nested
    @DisplayName("createPaymentSession / createEmbeddedPaymentSession")
    class CreateSession {

        @Test
        void hosted_routesThroughOrchestratorAndMarksProcessing() {
            ServiceRequest sr = buildPayableSr(5L);
            when(serviceRequestRepository.findById(5L)).thenReturn(Optional.of(sr));
            when(transactionManager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
            when(orchestrationService.initiatePayment(anyLong(), any(), any(PaymentOrchestrationRequest.class)))
                    .thenReturn(new PaymentOrchestrationResult(null,
                            PaymentResult.success("cs_sr", "https://pay/cs_sr"), PaymentProviderType.STRIPE));

            Map<String, String> body = service.createPaymentSession(5L, "u@e.com");

            assertThat(body).containsEntry("checkoutUrl", "https://pay/cs_sr");
            assertThat(sr.getStripeSessionId()).isEqualTo("cs_sr");
            assertThat(sr.getPaymentStatus()).isEqualTo(PaymentStatus.PROCESSING);

            ArgumentCaptor<PaymentOrchestrationRequest> reqCaptor =
                    ArgumentCaptor.forClass(PaymentOrchestrationRequest.class);
            verify(orchestrationService).initiatePayment(eq(3L), any(), reqCaptor.capture());
            PaymentOrchestrationRequest req = reqCaptor.getValue();
            assertThat(req.amount()).isEqualByComparingTo("120.00");
            assertThat(req.sourceType()).isEqualTo(ServiceRequestPaymentService.SOURCE_TYPE);
            assertThat(req.sourceId()).isEqualTo(5L);
            assertThat(req.embedded()).isFalse();
            assertThat(req.metadata()).containsEntry("service_request_id", "5");
        }

        @Test
        void embedded_returnsClientSecret() {
            ServiceRequest sr = buildPayableSr(5L);
            when(serviceRequestRepository.findById(5L)).thenReturn(Optional.of(sr));
            when(transactionManager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
            when(orchestrationService.initiatePayment(anyLong(), any(), any(PaymentOrchestrationRequest.class)))
                    .thenReturn(new PaymentOrchestrationResult(null,
                            PaymentResult.embedded("cs_sr_emb", "cs_sr_emb_secret"), PaymentProviderType.STRIPE));

            Map<String, String> body = service.createEmbeddedPaymentSession(5L, "u@e.com");

            assertThat(body).containsEntry("sessionId", "cs_sr_emb")
                    .containsEntry("clientSecret", "cs_sr_emb_secret");
            ArgumentCaptor<PaymentOrchestrationRequest> reqCaptor =
                    ArgumentCaptor.forClass(PaymentOrchestrationRequest.class);
            verify(orchestrationService).initiatePayment(anyLong(), any(), reqCaptor.capture());
            assertThat(reqCaptor.getValue().embedded()).isTrue();
        }

        @Test
        void whenNotAwaitingPayment_thenThrowsAndNoOrchestration() {
            ServiceRequest sr = buildPayableSr(5L);
            sr.setStatus(RequestStatus.IN_PROGRESS);
            when(serviceRequestRepository.findById(5L)).thenReturn(Optional.of(sr));

            assertThatThrownBy(() -> service.createPaymentSession(5L, "u@e.com"))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("AWAITING_PAYMENT");
            verifyNoInteractions(orchestrationService);
        }
    }

    @Nested
    @DisplayName("checkPaymentStatus")
    class CheckPaymentStatus {

        @Test
        void whenSrNotFound_thenThrows() {
            when(serviceRequestRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.checkPaymentStatus(99L))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("99");
            verifyNoInteractions(stripeGateway);
        }

        @Test
        void whenAlreadyPaid_thenReturnsPaidWithoutCallingStripe() throws Exception {
            ServiceRequest sr = buildSr(5L, PaymentStatus.PAID, null);
            when(serviceRequestRepository.findById(5L)).thenReturn(Optional.of(sr));

            Map<String, String> result = service.checkPaymentStatus(5L);

            assertThat(result).containsEntry("paymentStatus", "PAID")
                    .containsEntry("message", "Paiement deja confirme");
            verifyNoInteractions(stripeGateway);
        }

        @Test
        void whenNoStripeSession_thenReturnsNoSession() throws Exception {
            ServiceRequest sr = buildSr(5L, PaymentStatus.PROCESSING, null);
            when(serviceRequestRepository.findById(5L)).thenReturn(Optional.of(sr));

            Map<String, String> result = service.checkPaymentStatus(5L);

            assertThat(result).containsEntry("paymentStatus", "NO_SESSION");
            verifyNoInteractions(stripeGateway);
        }

        @Test
        void whenBlankStripeSession_thenReturnsNoSession() throws Exception {
            ServiceRequest sr = buildSr(5L, PaymentStatus.PROCESSING, "  ");
            when(serviceRequestRepository.findById(5L)).thenReturn(Optional.of(sr));

            Map<String, String> result = service.checkPaymentStatus(5L);

            assertThat(result).containsEntry("paymentStatus", "NO_SESSION");
            verifyNoInteractions(stripeGateway);
        }

        @Test
        void whenStripeSaysPaid_thenConfirmsPaymentAndIntervention() throws Exception {
            ServiceRequest sr = buildSr(5L, PaymentStatus.PROCESSING, "sess_42");
            when(serviceRequestRepository.findById(5L)).thenReturn(Optional.of(sr));

            Session stripeSession = mock(Session.class);
            when(stripeSession.getPaymentStatus()).thenReturn("paid");
            when(stripeGateway.retrieveSession("sess_42")).thenReturn(stripeSession);

            Map<String, String> result = service.checkPaymentStatus(5L);

            assertThat(result).containsEntry("paymentStatus", "PAID")
                    .containsEntry("message", "Paiement confirme (webhook rattrape)");
            verify(stripeService).confirmServiceRequestPayment("sess_42");
        }

        @Test
        void whenStripeSaysUnpaid_thenReturnsUppercasedStatus() throws Exception {
            ServiceRequest sr = buildSr(5L, PaymentStatus.PROCESSING, "sess_42");
            when(serviceRequestRepository.findById(5L)).thenReturn(Optional.of(sr));

            Session stripeSession = mock(Session.class);
            when(stripeSession.getPaymentStatus()).thenReturn("unpaid");
            when(stripeGateway.retrieveSession("sess_42")).thenReturn(stripeSession);

            Map<String, String> result = service.checkPaymentStatus(5L);

            assertThat(result).containsEntry("paymentStatus", "UNPAID");
            verify(stripeService, never()).confirmServiceRequestPayment(anyString());
        }

        @Test
        void whenStripeStatusNull_thenReturnsUnknown() throws Exception {
            ServiceRequest sr = buildSr(5L, PaymentStatus.PROCESSING, "sess_42");
            when(serviceRequestRepository.findById(5L)).thenReturn(Optional.of(sr));

            Session stripeSession = mock(Session.class);
            when(stripeSession.getPaymentStatus()).thenReturn(null);
            when(stripeGateway.retrieveSession("sess_42")).thenReturn(stripeSession);

            Map<String, String> result = service.checkPaymentStatus(5L);

            assertThat(result).containsEntry("paymentStatus", "UNKNOWN");
        }
    }
}
