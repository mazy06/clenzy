package com.clenzy.service;

import com.clenzy.model.PaymentTransaction;
import com.clenzy.repository.PaymentTransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.anyString;

@ExtendWith(MockitoExtension.class)
class ReservationPaymentReconciliationServiceTest {

    @Mock private PaymentTransactionRepository transactionRepository;
    @Mock private StripePaymentConfirmationService paymentConfirmationService;

    private ReservationPaymentReconciliationService service;

    @BeforeEach
    void setUp() {
        service = new ReservationPaymentReconciliationService(transactionRepository, paymentConfirmationService);
    }

    private PaymentTransaction tx(String ref, String providerTxId) {
        PaymentTransaction t = new PaymentTransaction();
        t.setTransactionRef(ref);
        t.setProviderTxId(providerTxId);
        return t;
    }

    @Test
    void whenTransactionHasProviderSession_thenConfirmsReservationPayment() {
        when(transactionRepository.findByTransactionRef("TX-1")).thenReturn(Optional.of(tx("TX-1", "cs_res")));

        service.reconcile("TX-1");

        verify(paymentConfirmationService).confirmReservationPayment("cs_res");
    }

    @Test
    void whenTransactionNotFound_thenNoConfirmation() {
        when(transactionRepository.findByTransactionRef("TX-missing")).thenReturn(Optional.empty());

        service.reconcile("TX-missing");

        verify(paymentConfirmationService, never()).confirmReservationPayment(anyString());
    }

    @Test
    void whenProviderTxIdMissing_thenNoConfirmation() {
        when(transactionRepository.findByTransactionRef("TX-2")).thenReturn(Optional.of(tx("TX-2", null)));

        service.reconcile("TX-2");

        verify(paymentConfirmationService, never()).confirmReservationPayment(anyString());
    }
}
