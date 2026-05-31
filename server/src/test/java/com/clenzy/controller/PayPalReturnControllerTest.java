package com.clenzy.controller;

import com.clenzy.model.PaymentTransaction;
import com.clenzy.payment.PaymentResult;
import com.clenzy.payment.provider.PayPalPaymentProvider;
import com.clenzy.repository.PaymentTransactionRepository;
import com.clenzy.service.PaymentOrchestrationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PayPalReturnControllerTest {

    @Mock private PayPalPaymentProvider payPalProvider;
    @Mock private PaymentTransactionRepository transactionRepository;
    @Mock private PaymentOrchestrationService orchestrationService;

    private PayPalReturnController controller;

    @BeforeEach
    void setUp() {
        controller = new PayPalReturnController(payPalProvider, transactionRepository, orchestrationService);
    }

    private PaymentTransaction tx(String providerTxId, String ref) {
        PaymentTransaction tx = new PaymentTransaction();
        tx.setId(1L);
        tx.setOrganizationId(7L);
        tx.setProviderTxId(providerTxId);
        tx.setTransactionRef(ref);
        return tx;
    }

    @Nested
    @DisplayName("handleReturn")
    class HandleReturn {

        @Test
        void unknownOrder_returns404() {
            when(transactionRepository.findAll()).thenReturn(List.of());

            ResponseEntity<?> response = controller.handleReturn("UNKNOWN", "payer-123");

            assertThat(response.getStatusCode().value()).isEqualTo(404);
            @SuppressWarnings("unchecked")
            Map<String, Object> body = (Map<String, Object>) response.getBody();
            assertThat(body).containsKey("error");
        }

        @Test
        void successfulCapture_withNewCaptureId_updatesAndCompletes() {
            PaymentTransaction tx = tx("PP-ORDER-1", "TX-REF-1");
            when(transactionRepository.findAll()).thenReturn(List.of(tx));
            when(payPalProvider.captureOrder(7L, "PP-ORDER-1"))
                    .thenReturn(PaymentResult.success("CAPTURE-99", null, "CAPTURED"));

            ResponseEntity<?> response = controller.handleReturn("PP-ORDER-1", "payer-1");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(tx.getProviderTxId()).isEqualTo("CAPTURE-99");
            verify(transactionRepository).save(tx);
            verify(orchestrationService).completeTransaction("TX-REF-1");

            @SuppressWarnings("unchecked")
            Map<String, Object> body = (Map<String, Object>) response.getBody();
            assertThat(body).containsEntry("status", "completed");
            assertThat(body).containsEntry("transactionRef", "TX-REF-1");
            assertThat(body).containsEntry("captureId", "CAPTURE-99");
        }

        @Test
        void successfulCapture_sameCaptureIdAsOrder_skipsTxUpdate() {
            PaymentTransaction tx = tx("PP-ORDER-1", "TX-REF-1");
            when(transactionRepository.findAll()).thenReturn(List.of(tx));
            when(payPalProvider.captureOrder(7L, "PP-ORDER-1"))
                    .thenReturn(PaymentResult.success("PP-ORDER-1", null, "CAPTURED"));

            ResponseEntity<?> response = controller.handleReturn("PP-ORDER-1", null);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(transactionRepository, never()).save(any());
            verify(orchestrationService).completeTransaction("TX-REF-1");
        }

        @Test
        void successfulCapture_nullCaptureId_skipsUpdateAndReturnsEmpty() {
            PaymentTransaction tx = tx("PP-ORDER-1", "TX-REF-1");
            when(transactionRepository.findAll()).thenReturn(List.of(tx));
            when(payPalProvider.captureOrder(7L, "PP-ORDER-1"))
                    .thenReturn(new PaymentResult(true, null, null, "CAPTURED", null));

            ResponseEntity<?> response = controller.handleReturn("PP-ORDER-1", null);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(transactionRepository, never()).save(any());
            verify(orchestrationService).completeTransaction("TX-REF-1");
            @SuppressWarnings("unchecked")
            Map<String, Object> body = (Map<String, Object>) response.getBody();
            assertThat(body).containsEntry("captureId", "");
            assertThat(body).containsEntry("payerId", "");
        }

        @Test
        void captureFails_returns502AndMarksFailed() {
            PaymentTransaction tx = tx("PP-ORDER-2", "TX-REF-2");
            when(transactionRepository.findAll()).thenReturn(List.of(tx));
            when(payPalProvider.captureOrder(7L, "PP-ORDER-2"))
                    .thenReturn(PaymentResult.failure("capture timeout"));

            ResponseEntity<?> response = controller.handleReturn("PP-ORDER-2", "payer-2");

            assertThat(response.getStatusCode().value()).isEqualTo(502);
            verify(orchestrationService).failTransaction(eq("TX-REF-2"),
                    eq("PayPal capture failed: capture timeout"));
            verify(orchestrationService, never()).completeTransaction(any());
        }

        @Test
        void filtersCorrectTransactionAmongMany() {
            PaymentTransaction other = tx("OTHER-ORDER", "OTHER");
            PaymentTransaction match = tx("PP-ORDER-X", "TX-X");
            when(transactionRepository.findAll()).thenReturn(List.of(other, match));
            when(payPalProvider.captureOrder(7L, "PP-ORDER-X"))
                    .thenReturn(PaymentResult.success("CAP-X", null, "CAPTURED"));

            ResponseEntity<?> response = controller.handleReturn("PP-ORDER-X", "p");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(orchestrationService).completeTransaction("TX-X");
        }
    }
}
