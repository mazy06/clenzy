package com.clenzy.booking.service;

import com.clenzy.model.PaymentTransaction;
import com.clenzy.repository.PaymentTransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BookingBalanceReconciliationServiceTest {

    @Mock private PaymentTransactionRepository transactionRepository;
    @Mock private PublicBookingService publicBookingService;

    private BookingBalanceReconciliationService service;

    @BeforeEach
    void setUp() {
        service = new BookingBalanceReconciliationService(transactionRepository, publicBookingService);
    }

    private PaymentTransaction tx(String ref, Long sourceId, String providerTxId) {
        PaymentTransaction t = new PaymentTransaction();
        t.setTransactionRef(ref);
        t.setSourceId(sourceId);
        t.setProviderTxId(providerTxId);
        return t;
    }

    @Test
    void whenTransactionResolves_thenConfirmsBalanceById() {
        when(transactionRepository.findByTransactionRef("TX-1")).thenReturn(Optional.of(tx("TX-1", 55L, "cs_bal")));

        service.reconcile("TX-1");

        verify(publicBookingService).confirmBookingEngineBalanceById(55L, "cs_bal");
    }

    @Test
    void whenTransactionNotFound_thenNoConfirmation() {
        when(transactionRepository.findByTransactionRef("TX-x")).thenReturn(Optional.empty());

        service.reconcile("TX-x");

        verify(publicBookingService, never()).confirmBookingEngineBalanceById(anyLong(), anyString());
    }

    @Test
    void whenSourceIdMissing_thenNoConfirmation() {
        when(transactionRepository.findByTransactionRef("TX-2")).thenReturn(Optional.of(tx("TX-2", null, "cs_bal")));

        service.reconcile("TX-2");

        verify(publicBookingService, never()).confirmBookingEngineBalanceById(any(), anyString());
    }

    @Test
    void whenProviderTxIdMissing_thenNoConfirmation() {
        when(transactionRepository.findByTransactionRef("TX-3")).thenReturn(Optional.of(tx("TX-3", 55L, null)));

        service.reconcile("TX-3");

        verify(publicBookingService, never()).confirmBookingEngineBalanceById(anyLong(), any());
    }
}
