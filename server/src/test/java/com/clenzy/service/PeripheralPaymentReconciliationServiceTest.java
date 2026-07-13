package com.clenzy.service;

import com.clenzy.model.PaymentTransaction;
import com.clenzy.repository.PaymentTransactionRepository;
import com.clenzy.service.ai.AiCreditGrantService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PeripheralPaymentReconciliationServiceTest {

    @Mock private PaymentTransactionRepository transactionRepository;
    @Mock private AiCreditGrantService aiCreditGrantService;
    @Mock private StripePaymentConfirmationService paymentConfirmationService;
    @Mock private UpsellService upsellService;

    private PeripheralPaymentReconciliationService service;

    @BeforeEach
    void setUp() {
        service = new PeripheralPaymentReconciliationService(transactionRepository, aiCreditGrantService,
                paymentConfirmationService, upsellService);
    }

    private PaymentTransaction tx(String ref, Long sourceId, String providerTxId, Map<String, Object> metadata) {
        PaymentTransaction t = new PaymentTransaction();
        t.setTransactionRef(ref);
        t.setSourceId(sourceId);
        t.setProviderTxId(providerTxId);
        t.setMetadata(metadata);
        return t;
    }

    @Test
    void aiCreditTopUp_grantsPack() {
        when(transactionRepository.findByTransactionRef("TX-1"))
                .thenReturn(Optional.of(tx("TX-1", 7L, "cs_topup", Map.of("millicredits", "2000000"))));

        service.reconcileAiCreditTopUp("TX-1");

        verify(aiCreditGrantService).grantTopUp(7L, 2_000_000L, "cs_topup");
    }

    @Test
    void aiCreditTopUp_transactionNotFound_noGrant() {
        when(transactionRepository.findByTransactionRef("TX-x")).thenReturn(Optional.empty());

        service.reconcileAiCreditTopUp("TX-x");

        verify(aiCreditGrantService, never()).grantTopUp(anyLong(), anyLong(), anyString());
    }

    @Test
    void aiCreditTopUp_missingMillicredits_noGrant() {
        when(transactionRepository.findByTransactionRef("TX-2"))
                .thenReturn(Optional.of(tx("TX-2", 7L, "cs_topup", Map.of("pack_key", "pack_500"))));

        service.reconcileAiCreditTopUp("TX-2");

        verify(aiCreditGrantService, never()).grantTopUp(anyLong(), anyLong(), anyString());
    }

    @Test
    void aiCreditTopUp_invalidMillicredits_noGrant() {
        when(transactionRepository.findByTransactionRef("TX-3"))
                .thenReturn(Optional.of(tx("TX-3", 7L, "cs_topup", Map.of("millicredits", "abc"))));

        service.reconcileAiCreditTopUp("TX-3");

        verify(aiCreditGrantService, never()).grantTopUp(anyLong(), anyLong(), anyString());
    }

    @Test
    void serviceRequest_confirmsByProviderSession() {
        when(transactionRepository.findByTransactionRef("TX-SR"))
                .thenReturn(Optional.of(tx("TX-SR", 5L, "cs_sr", Map.of())));

        service.reconcileServiceRequest("TX-SR");

        verify(paymentConfirmationService).confirmServiceRequestPayment("cs_sr");
    }

    @Test
    void serviceRequest_missingProviderTxId_noConfirmation() {
        when(transactionRepository.findByTransactionRef("TX-SR2"))
                .thenReturn(Optional.of(tx("TX-SR2", 5L, null, Map.of())));

        service.reconcileServiceRequest("TX-SR2");

        verify(paymentConfirmationService, never()).confirmServiceRequestPayment(anyString());
    }

    @Test
    void upsell_marksPaidByProviderSession() {
        when(transactionRepository.findByTransactionRef("TX-UP"))
                .thenReturn(Optional.of(tx("TX-UP", 9L, "cs_up", Map.of())));

        service.reconcileUpsell("TX-UP");

        verify(upsellService).markPaidBySession("cs_up");
    }

    @Test
    void upsell_missingProviderTxId_noMarkPaid() {
        when(transactionRepository.findByTransactionRef("TX-UP2"))
                .thenReturn(Optional.of(tx("TX-UP2", 9L, null, Map.of())));

        service.reconcileUpsell("TX-UP2");

        verify(upsellService, never()).markPaidBySession(anyString());
    }
}
