package com.clenzy.service;

import com.clenzy.model.EscrowHold;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.User;
import com.clenzy.repository.EscrowHoldRepository;
import com.clenzy.repository.ReservationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PaymentEventConsumerTest {

    @Mock private SplitPaymentService splitPaymentService;
    @Mock private EscrowHoldRepository escrowHoldRepository;
    @Mock private ReservationRepository reservationRepository;

    private PaymentEventConsumer consumer;

    @BeforeEach
    void setUp() {
        consumer = new PaymentEventConsumer(splitPaymentService, escrowHoldRepository, reservationRepository);
    }

    private EscrowHold escrow() {
        EscrowHold hold = new EscrowHold();
        hold.setId(11L);
        hold.setAmount(new BigDecimal("200.00"));
        hold.setCurrency("EUR");
        return hold;
    }

    private Reservation reservationWithOwner(Long ownerId) {
        User owner = new User();
        owner.setId(ownerId);
        Property property = new Property();
        property.setOwner(owner);
        Reservation reservation = new Reservation();
        reservation.setProperty(property);
        return reservation;
    }

    @Nested
    @DisplayName("ESCROW_RELEASED")
    class EscrowReleased {

        @Test
        void happyPath_triggersSplit() {
            Map<String, Object> event = new HashMap<>();
            event.put("eventType", "ESCROW_RELEASED");
            event.put("escrowId", 11);
            event.put("reservationId", 22);

            when(escrowHoldRepository.findById(11L)).thenReturn(Optional.of(escrow()));
            when(reservationRepository.findById(22L)).thenReturn(Optional.of(reservationWithOwner(99L)));

            consumer.handlePaymentEvent(event);

            verify(splitPaymentService).splitPayment(eq(22L), eq(new BigDecimal("200.00")), eq("EUR"), eq(99L));
        }

        @Test
        void missingEscrowId_skipsSplit() {
            Map<String, Object> event = new HashMap<>();
            event.put("eventType", "ESCROW_RELEASED");
            event.put("reservationId", 22L);

            consumer.handlePaymentEvent(event);

            verify(splitPaymentService, never()).splitPayment(any(), any(), any(), any());
        }

        @Test
        void missingReservationId_skipsSplit() {
            Map<String, Object> event = new HashMap<>();
            event.put("eventType", "ESCROW_RELEASED");
            event.put("escrowId", 11L);

            consumer.handlePaymentEvent(event);

            verify(splitPaymentService, never()).splitPayment(any(), any(), any(), any());
        }

        @Test
        void escrowNotFound_skipsSplit() {
            Map<String, Object> event = Map.of("eventType", "ESCROW_RELEASED",
                    "escrowId", 11L, "reservationId", 22L);
            when(escrowHoldRepository.findById(11L)).thenReturn(Optional.empty());

            consumer.handlePaymentEvent(event);

            verify(splitPaymentService, never()).splitPayment(any(), any(), any(), any());
        }

        @Test
        void reservationNotFound_skipsSplit() {
            Map<String, Object> event = Map.of("eventType", "ESCROW_RELEASED",
                    "escrowId", 11L, "reservationId", 22L);
            when(escrowHoldRepository.findById(11L)).thenReturn(Optional.of(escrow()));
            when(reservationRepository.findById(22L)).thenReturn(Optional.empty());

            consumer.handlePaymentEvent(event);

            verify(splitPaymentService, never()).splitPayment(any(), any(), any(), any());
        }

        @Test
        void reservationWithoutProperty_skipsSplit() {
            Reservation reservation = new Reservation();
            reservation.setProperty(null);

            Map<String, Object> event = Map.of("eventType", "ESCROW_RELEASED",
                    "escrowId", 11L, "reservationId", 22L);
            when(escrowHoldRepository.findById(11L)).thenReturn(Optional.of(escrow()));
            when(reservationRepository.findById(22L)).thenReturn(Optional.of(reservation));

            consumer.handlePaymentEvent(event);

            verify(splitPaymentService, never()).splitPayment(any(), any(), any(), any());
        }

        @Test
        void propertyWithoutOwner_skipsSplit() {
            Property property = new Property();
            property.setOwner(null);
            Reservation reservation = new Reservation();
            reservation.setProperty(property);

            Map<String, Object> event = Map.of("eventType", "ESCROW_RELEASED",
                    "escrowId", 11L, "reservationId", 22L);
            when(escrowHoldRepository.findById(11L)).thenReturn(Optional.of(escrow()));
            when(reservationRepository.findById(22L)).thenReturn(Optional.of(reservation));

            consumer.handlePaymentEvent(event);

            verify(splitPaymentService, never()).splitPayment(any(), any(), any(), any());
        }

        @Test
        void stringIdsAreCoerced() {
            Map<String, Object> event = Map.of("eventType", "ESCROW_RELEASED",
                    "escrowId", "11", "reservationId", "22");

            when(escrowHoldRepository.findById(11L)).thenReturn(Optional.of(escrow()));
            when(reservationRepository.findById(22L)).thenReturn(Optional.of(reservationWithOwner(99L)));

            consumer.handlePaymentEvent(event);

            verify(splitPaymentService).splitPayment(eq(22L), any(), any(), eq(99L));
        }

        @Test
        void unparseableIds_skipsSplit() {
            Map<String, Object> event = Map.of("eventType", "ESCROW_RELEASED",
                    "escrowId", "abc", "reservationId", "xyz");

            consumer.handlePaymentEvent(event);

            verify(splitPaymentService, never()).splitPayment(any(), any(), any(), any());
        }

        @Test
        void exceptionDuringProcessing_caught() {
            Map<String, Object> event = Map.of("eventType", "ESCROW_RELEASED",
                    "escrowId", 11L, "reservationId", 22L);
            when(escrowHoldRepository.findById(11L)).thenThrow(new RuntimeException("boom"));

            // Should not throw
            consumer.handlePaymentEvent(event);
        }
    }

    @Test
    void paymentCompleted_logsOnly() {
        Map<String, Object> event = Map.of("eventType", "PAYMENT_COMPLETED",
                "transactionRef", "TX-123");

        consumer.handlePaymentEvent(event);

        verifyNoInteractions(splitPaymentService, escrowHoldRepository, reservationRepository);
    }

    @Test
    void unknownEventType_ignored() {
        Map<String, Object> event = Map.of("eventType", "WEIRD_TYPE");

        consumer.handlePaymentEvent(event);

        verifyNoInteractions(splitPaymentService, escrowHoldRepository, reservationRepository);
    }

    @Test
    void missingEventType_ignored() {
        Map<String, Object> event = new HashMap<>();

        consumer.handlePaymentEvent(event);

        verifyNoInteractions(splitPaymentService, escrowHoldRepository, reservationRepository);
    }
}
