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
    @Mock private DeferredPaymentReconciliationService deferredPaymentReconciliationService;
    @Mock private ReservationPaymentReconciliationService reservationPaymentReconciliationService;
    @Mock private com.clenzy.booking.service.BookingBalanceReconciliationService bookingBalanceReconciliationService;
    @Mock private PeripheralPaymentReconciliationService peripheralPaymentReconciliationService;
    @Mock private com.clenzy.repository.PaymentTransactionRepository transactionRepository;
    @Mock private com.clenzy.tenant.KafkaTenantScope kafkaTenantScope;

    private PaymentEventConsumer consumer;

    @BeforeEach
    void setUp() {
        // Contrat de KafkaTenantScope rejoue ici (teste isolement dans KafkaTenantScopeTest).
        org.mockito.Mockito.lenient().doAnswer(inv -> {
            Long trusted = inv.getArgument(1);
            if (trusted == null) {
                return false;
            }
            ((Runnable) inv.getArgument(2)).run();
            return true;
        }).when(kafkaTenantScope).run(org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(Runnable.class));
        consumer = new PaymentEventConsumer(splitPaymentService, escrowHoldRepository, reservationRepository,
                deferredPaymentReconciliationService, reservationPaymentReconciliationService,
                bookingBalanceReconciliationService, peripheralPaymentReconciliationService,
                transactionRepository, kafkaTenantScope);
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

    @Nested
    @DisplayName("PAYMENT_COMPLETED")
    class PaymentCompleted {

        /**
         * Depuis l'audit P1-04, le routage suit le sourceType de la TRANSACTION. Les tests de
         * dispatch doivent donc provisionner la transaction correspondante, et non se contenter
         * de l'annoncer dans le payload.
         */
        private void givenTransaction(String ref, String sourceType) {
            com.clenzy.model.PaymentTransaction tx = new com.clenzy.model.PaymentTransaction();
            tx.setTransactionRef(ref);
            tx.setOrganizationId(7L);
            tx.setSourceType(sourceType);
            when(transactionRepository.findByTransactionRef(ref)).thenReturn(java.util.Optional.of(tx));
        }

        @Test
        void deferredSourceType_reconciles() {
            givenTransaction("TX-123", "DEFERRED_INTERVENTIONS_HOST");
            Map<String, Object> event = Map.of("eventType", "PAYMENT_COMPLETED",
                    "transactionRef", "TX-123",
                    "sourceType", "DEFERRED_INTERVENTIONS_HOST");

            consumer.handlePaymentEvent(event);

            verify(deferredPaymentReconciliationService).reconcile("TX-123");
            verifyNoInteractions(splitPaymentService, escrowHoldRepository, reservationRepository);
        }

        @Test
        void propertyScopeSourceType_reconciles() {
            givenTransaction("TX-456", "DEFERRED_INTERVENTIONS_PROPERTY");
            Map<String, Object> event = Map.of("eventType", "PAYMENT_COMPLETED",
                    "transactionRef", "TX-456",
                    "sourceType", "DEFERRED_INTERVENTIONS_PROPERTY");

            consumer.handlePaymentEvent(event);

            verify(deferredPaymentReconciliationService).reconcile("TX-456");
        }

        @Test
        void reservationSourceType_reconciles() {
            givenTransaction("TX-RES", "RESERVATION");
            Map<String, Object> event = Map.of("eventType", "PAYMENT_COMPLETED",
                    "transactionRef", "TX-RES",
                    "sourceType", "RESERVATION");

            consumer.handlePaymentEvent(event);

            verify(reservationPaymentReconciliationService).reconcile("TX-RES");
            verifyNoInteractions(deferredPaymentReconciliationService);
        }

        @Test
        void bookingBalanceSourceType_reconciles() {
            givenTransaction("TX-BAL", "BOOKING_BALANCE");
            Map<String, Object> event = Map.of("eventType", "PAYMENT_COMPLETED",
                    "transactionRef", "TX-BAL",
                    "sourceType", "BOOKING_BALANCE");

            consumer.handlePaymentEvent(event);

            verify(bookingBalanceReconciliationService).reconcile("TX-BAL");
            verifyNoInteractions(deferredPaymentReconciliationService, reservationPaymentReconciliationService);
        }

        @Test
        void aiCreditTopUpSourceType_reconciles() {
            givenTransaction("TX-AI", "AI_CREDIT_TOPUP");
            Map<String, Object> event = Map.of("eventType", "PAYMENT_COMPLETED",
                    "transactionRef", "TX-AI",
                    "sourceType", "AI_CREDIT_TOPUP");

            consumer.handlePaymentEvent(event);

            verify(peripheralPaymentReconciliationService).reconcileAiCreditTopUp("TX-AI");
            verifyNoInteractions(deferredPaymentReconciliationService, reservationPaymentReconciliationService,
                    bookingBalanceReconciliationService);
        }

        @Test
        void serviceRequestSourceType_reconciles() {
            givenTransaction("TX-SR", "SERVICE_REQUEST");
            Map<String, Object> event = Map.of("eventType", "PAYMENT_COMPLETED",
                    "transactionRef", "TX-SR",
                    "sourceType", "SERVICE_REQUEST");

            consumer.handlePaymentEvent(event);

            verify(peripheralPaymentReconciliationService).reconcileServiceRequest("TX-SR");
        }

        @Test
        void upsellSourceType_reconciles() {
            givenTransaction("TX-UP", "UPSELL");
            Map<String, Object> event = Map.of("eventType", "PAYMENT_COMPLETED",
                    "transactionRef", "TX-UP",
                    "sourceType", "UPSELL");

            consumer.handlePaymentEvent(event);

            verify(peripheralPaymentReconciliationService).reconcileUpsell("TX-UP");
        }

        @Test
        void otherSourceType_isIgnored() {
            Map<String, Object> event = Map.of("eventType", "PAYMENT_COMPLETED",
                    "transactionRef", "TX-789",
                    "sourceType", "INTERVENTION");

            consumer.handlePaymentEvent(event);

            verifyNoInteractions(deferredPaymentReconciliationService,
                    reservationPaymentReconciliationService,
                    bookingBalanceReconciliationService,
                    peripheralPaymentReconciliationService,
                    splitPaymentService, escrowHoldRepository, reservationRepository);
        }

        @Test
        void missingTransactionRef_isIgnored() {
            Map<String, Object> event = Map.of("eventType", "PAYMENT_COMPLETED",
                    "sourceType", "DEFERRED_INTERVENTIONS_HOST");

            consumer.handlePaymentEvent(event);

            verifyNoInteractions(deferredPaymentReconciliationService);
        }
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

    /**
     * Audit 2026-07 (P1-04) — le {@code sourceType} qui pilote le routage etait lu dans le
     * PAYLOAD. Un evenement forge portant le {@code transactionRef} legitime d'une reservation
     * et le {@code sourceType} des credits IA partait donc en dotation de credits : l'attaquant
     * choisissait l'effet metier applique a une transaction qui ne lui appartenait pas.
     * Le routage suit desormais le {@code sourceType} de la TRANSACTION en base.
     */
    @Test
    @DisplayName("PAYMENT_COMPLETED : le routage suit la transaction, pas le payload (P1-04)")
    void paymentCompleted_routingIgnoresForgedSourceType() {
        com.clenzy.model.PaymentTransaction tx = new com.clenzy.model.PaymentTransaction();
        tx.setTransactionRef("TX-RES-1");
        tx.setOrganizationId(7L);
        tx.setSourceType(ReservationPaymentService.SOURCE_TYPE);   // reellement une reservation
        when(transactionRepository.findByTransactionRef("TX-RES-1")).thenReturn(java.util.Optional.of(tx));

        Map<String, Object> event = new HashMap<>();
        event.put("eventType", "PAYMENT_COMPLETED");
        event.put("transactionRef", "TX-RES-1");
        event.put("sourceType", com.clenzy.service.ai.AiCreditPurchaseService.SOURCE_TYPE); // forge

        consumer.handlePaymentEvent(event);

        verify(peripheralPaymentReconciliationService, never()).reconcileAiCreditTopUp(anyString());
        verify(reservationPaymentReconciliationService, never()).reconcile(anyString());
    }

    @Test
    @DisplayName("PAYMENT_COMPLETED : transaction inconnue → aucun effet metier")
    void paymentCompleted_unknownTransactionIsRejected() {
        when(transactionRepository.findByTransactionRef("TX-NOPE")).thenReturn(java.util.Optional.empty());

        Map<String, Object> event = new HashMap<>();
        event.put("eventType", "PAYMENT_COMPLETED");
        event.put("transactionRef", "TX-NOPE");
        event.put("sourceType", ReservationPaymentService.SOURCE_TYPE);

        consumer.handlePaymentEvent(event);

        verifyNoInteractions(reservationPaymentReconciliationService,
                peripheralPaymentReconciliationService, deferredPaymentReconciliationService);
    }
}
