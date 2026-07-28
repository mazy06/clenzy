package com.clenzy.service;

import com.clenzy.dto.PaymentOrchestrationRequest;
import com.clenzy.dto.PaymentOrchestrationResult;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.PaymentProviderType;
import com.clenzy.model.PaymentStatus;
import com.clenzy.payment.PaymentResult;
import com.clenzy.payment.StripeGateway;
import com.clenzy.service.ServiceRequestPaymentPersistence.PayableServiceRequest;
import com.clenzy.service.ServiceRequestPaymentPersistence.ServiceRequestPaymentState;
import com.stripe.model.checkout.Session;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Tests de ServiceRequestPaymentService : création de session (orchestrée
 * multi-provider, Vague 5) + vérification du paiement (fallback Stripe).
 *
 * <p>Les accès base et leurs validations sont testés séparément dans
 * {@link ServiceRequestPaymentPersistenceTest} — ici, la persistance est mockée.</p>
 */
@ExtendWith(MockitoExtension.class)
class ServiceRequestPaymentServiceTest {

    @Mock private ServiceRequestPaymentPersistence persistence;
    @Mock private StripeService stripeService;
    @Mock private StripeGateway stripeGateway;
    @Mock private PaymentOrchestrationService orchestrationService;

    private ServiceRequestPaymentService service;

    @BeforeEach
    void setUp() throws Exception {
        service = new ServiceRequestPaymentService(persistence, stripeService,
                stripeGateway, orchestrationService);
        Field f = ServiceRequestPaymentService.class.getDeclaredField("currency");
        f.setAccessible(true);
        f.set(service, "EUR");
    }

    private PayableServiceRequest payable(Long id) {
        return new PayableServiceRequest(id, 3L, "Fuite robinet", new BigDecimal("120.00"));
    }

    @Nested
    @DisplayName("createPaymentSession / createEmbeddedPaymentSession")
    class CreateSession {

        @Test
        void hosted_routesThroughOrchestratorAndMarksProcessing() {
            when(persistence.loadPayable(5L)).thenReturn(payable(5L));
            when(orchestrationService.initiatePayment(anyLong(), any(), any(PaymentOrchestrationRequest.class)))
                    .thenReturn(new PaymentOrchestrationResult(null,
                            PaymentResult.success("cs_sr", "https://pay/cs_sr"), PaymentProviderType.STRIPE));

            Map<String, String> body = service.createPaymentSession(5L, "u@e.com");

            assertThat(body).containsEntry("checkoutUrl", "https://pay/cs_sr");
            verify(persistence).markProcessing(5L, "cs_sr");

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
            when(persistence.loadPayable(5L)).thenReturn(payable(5L));
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
        void whenNotPayable_thenThrowsAndNoOrchestration() {
            when(persistence.loadPayable(5L)).thenThrow(
                    new IllegalStateException("La demande de service doit etre en statut AWAITING_PAYMENT"));

            assertThatThrownBy(() -> service.createPaymentSession(5L, "u@e.com"))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("AWAITING_PAYMENT");
            verifyNoInteractions(orchestrationService);
        }

        /**
         * Régression audit RLS : le marquage PROCESSING était enveloppé dans un
         * {@code if (fresh != null)} qui absorbait l'échec en silence. La session existe
         * déjà chez le provider — l'échec doit remonter, pas disparaître.
         */
        @Test
        void whenMarkProcessingFails_thenFailurePropagates() {
            when(persistence.loadPayable(5L)).thenReturn(payable(5L));
            when(orchestrationService.initiatePayment(anyLong(), any(), any(PaymentOrchestrationRequest.class)))
                    .thenReturn(new PaymentOrchestrationResult(null,
                            PaymentResult.success("cs_sr", "https://pay/cs_sr"), PaymentProviderType.STRIPE));
            doThrow(new NotFoundException("Demande de service non trouvee: 5"))
                    .when(persistence).markProcessing(5L, "cs_sr");

            assertThatThrownBy(() -> service.createPaymentSession(5L, "u@e.com"))
                    .isInstanceOf(NotFoundException.class)
                    .hasMessageContaining("5");
        }
    }

    @Nested
    @DisplayName("checkPaymentStatus")
    class CheckPaymentStatus {

        @Test
        void whenSrNotFound_thenThrows() {
            when(persistence.loadPaymentState(99L))
                    .thenThrow(new NotFoundException("Demande de service non trouvee: 99"));

            assertThatThrownBy(() -> service.checkPaymentStatus(99L))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("99");
            verifyNoInteractions(stripeGateway);
        }

        @Test
        void whenAlreadyPaid_thenReturnsPaidWithoutCallingStripe() throws Exception {
            when(persistence.loadPaymentState(5L))
                    .thenReturn(new ServiceRequestPaymentState(PaymentStatus.PAID, null));

            Map<String, String> result = service.checkPaymentStatus(5L);

            assertThat(result).containsEntry("paymentStatus", "PAID")
                    .containsEntry("message", "Paiement deja confirme");
            verifyNoInteractions(stripeGateway);
        }

        @Test
        void whenNoStripeSession_thenReturnsNoSession() throws Exception {
            when(persistence.loadPaymentState(5L))
                    .thenReturn(new ServiceRequestPaymentState(PaymentStatus.PROCESSING, null));

            Map<String, String> result = service.checkPaymentStatus(5L);

            assertThat(result).containsEntry("paymentStatus", "NO_SESSION");
            verifyNoInteractions(stripeGateway);
        }

        @Test
        void whenBlankStripeSession_thenReturnsNoSession() throws Exception {
            when(persistence.loadPaymentState(5L))
                    .thenReturn(new ServiceRequestPaymentState(PaymentStatus.PROCESSING, "  "));

            Map<String, String> result = service.checkPaymentStatus(5L);

            assertThat(result).containsEntry("paymentStatus", "NO_SESSION");
            verifyNoInteractions(stripeGateway);
        }

        @Test
        void whenStripeSaysPaid_thenConfirmsPaymentAndIntervention() throws Exception {
            when(persistence.loadPaymentState(5L))
                    .thenReturn(new ServiceRequestPaymentState(PaymentStatus.PROCESSING, "sess_42"));

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
            when(persistence.loadPaymentState(5L))
                    .thenReturn(new ServiceRequestPaymentState(PaymentStatus.PROCESSING, "sess_42"));

            Session stripeSession = mock(Session.class);
            when(stripeSession.getPaymentStatus()).thenReturn("unpaid");
            when(stripeGateway.retrieveSession("sess_42")).thenReturn(stripeSession);

            Map<String, String> result = service.checkPaymentStatus(5L);

            assertThat(result).containsEntry("paymentStatus", "UNPAID");
            verify(stripeService, never()).confirmServiceRequestPayment(anyString());
        }

        @Test
        void whenStripeStatusNull_thenReturnsUnknown() throws Exception {
            when(persistence.loadPaymentState(5L))
                    .thenReturn(new ServiceRequestPaymentState(PaymentStatus.PROCESSING, "sess_42"));

            Session stripeSession = mock(Session.class);
            when(stripeSession.getPaymentStatus()).thenReturn(null);
            when(stripeGateway.retrieveSession("sess_42")).thenReturn(stripeSession);

            Map<String, String> result = service.checkPaymentStatus(5L);

            assertThat(result).containsEntry("paymentStatus", "UNKNOWN");
        }
    }
}
