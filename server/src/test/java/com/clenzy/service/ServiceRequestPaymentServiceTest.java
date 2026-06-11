package com.clenzy.service;

import com.clenzy.model.PaymentStatus;
import com.clenzy.model.ServiceRequest;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.ServiceRequestRepository;
import com.stripe.model.checkout.Session;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Tests de ServiceRequestPaymentService (logique deplacee de
 * ServiceRequestController, T-ARCH-01) : verification du paiement Stripe via
 * StripeGateway (plus de mutation de Stripe.apiKey).
 */
@ExtendWith(MockitoExtension.class)
class ServiceRequestPaymentServiceTest {

    @Mock private ServiceRequestRepository serviceRequestRepository;
    @Mock private StripeService stripeService;
    @Mock private StripeGateway stripeGateway;

    private ServiceRequestPaymentService service;

    @BeforeEach
    void setUp() {
        service = new ServiceRequestPaymentService(serviceRequestRepository, stripeService, stripeGateway);
    }

    private ServiceRequest buildSr(Long id, PaymentStatus paymentStatus, String sessionId) {
        ServiceRequest sr = new ServiceRequest();
        sr.setId(id);
        sr.setPaymentStatus(paymentStatus);
        sr.setStripeSessionId(sessionId);
        return sr;
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
