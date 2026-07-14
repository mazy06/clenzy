package com.clenzy.service;

import com.clenzy.model.PaymentTransaction;
import com.clenzy.repository.PaymentTransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;
import java.util.Optional;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;

@ExtendWith(MockitoExtension.class)
class DeferredPaymentReconciliationServiceTest {

    @Mock private PaymentTransactionRepository transactionRepository;
    @Mock private StripePaymentConfirmationService paymentConfirmationService;

    private DeferredPaymentReconciliationService service;

    @BeforeEach
    void setUp() {
        service = new DeferredPaymentReconciliationService(transactionRepository, paymentConfirmationService);
    }

    private PaymentTransaction tx(String ref, String providerTxId, Map<String, Object> metadata) {
        PaymentTransaction t = new PaymentTransaction();
        t.setTransactionRef(ref);
        t.setProviderTxId(providerTxId);
        t.setMetadata(metadata);
        return t;
    }

    @Test
    void whenTransactionHasInterventionIds_thenConfirmsGroupedPayment() {
        PaymentTransaction transaction = tx("TX-1", "cs_grouped",
                Map.of("intervention_ids", "100,101,102"));
        when(transactionRepository.findByTransactionRef("TX-1")).thenReturn(Optional.of(transaction));

        service.reconcile("TX-1");

        verify(paymentConfirmationService).confirmGroupedPayment("cs_grouped", "100,101,102");
    }

    @Test
    void whenTransactionNotFound_thenNoConfirmation() {
        when(transactionRepository.findByTransactionRef("TX-missing")).thenReturn(Optional.empty());

        service.reconcile("TX-missing");

        verify(paymentConfirmationService, never()).confirmGroupedPayment(any(), any());
    }

    @Test
    void whenInterventionIdsMissing_thenNoConfirmation() {
        PaymentTransaction transaction = tx("TX-2", "cs_x", Map.of("host_id", "5"));
        when(transactionRepository.findByTransactionRef("TX-2")).thenReturn(Optional.of(transaction));

        service.reconcile("TX-2");

        verify(paymentConfirmationService, never()).confirmGroupedPayment(any(), any());
    }

    @Test
    void whenMetadataNull_thenNoConfirmation() {
        PaymentTransaction transaction = tx("TX-3", "cs_y", null);
        when(transactionRepository.findByTransactionRef("TX-3")).thenReturn(Optional.of(transaction));

        service.reconcile("TX-3");

        verify(paymentConfirmationService, never()).confirmGroupedPayment(eq("cs_y"), any());
    }
}
