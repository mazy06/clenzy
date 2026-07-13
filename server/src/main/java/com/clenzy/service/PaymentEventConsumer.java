package com.clenzy.service;

import com.clenzy.config.KafkaConfig;
import com.clenzy.model.EscrowHold;
import com.clenzy.model.Reservation;
import com.clenzy.repository.EscrowHoldRepository;
import com.clenzy.repository.ReservationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Consumes payment events from Kafka.
 * Triggers split payments when escrow is released.
 */
@Component
public class PaymentEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(PaymentEventConsumer.class);

    private final SplitPaymentService splitPaymentService;
    private final EscrowHoldRepository escrowHoldRepository;
    private final ReservationRepository reservationRepository;
    private final DeferredPaymentReconciliationService deferredPaymentReconciliationService;
    private final ReservationPaymentReconciliationService reservationPaymentReconciliationService;
    private final com.clenzy.booking.service.BookingBalanceReconciliationService bookingBalanceReconciliationService;
    private final PeripheralPaymentReconciliationService peripheralPaymentReconciliationService;

    public PaymentEventConsumer(SplitPaymentService splitPaymentService,
                                 EscrowHoldRepository escrowHoldRepository,
                                 ReservationRepository reservationRepository,
                                 DeferredPaymentReconciliationService deferredPaymentReconciliationService,
                                 ReservationPaymentReconciliationService reservationPaymentReconciliationService,
                                 com.clenzy.booking.service.BookingBalanceReconciliationService bookingBalanceReconciliationService,
                                 PeripheralPaymentReconciliationService peripheralPaymentReconciliationService) {
        this.splitPaymentService = splitPaymentService;
        this.escrowHoldRepository = escrowHoldRepository;
        this.reservationRepository = reservationRepository;
        this.deferredPaymentReconciliationService = deferredPaymentReconciliationService;
        this.reservationPaymentReconciliationService = reservationPaymentReconciliationService;
        this.bookingBalanceReconciliationService = bookingBalanceReconciliationService;
        this.peripheralPaymentReconciliationService = peripheralPaymentReconciliationService;
    }

    @KafkaListener(topics = KafkaConfig.TOPIC_PAYMENT_EVENTS, groupId = "clenzy-payment-consumer")
    public void handlePaymentEvent(Map<String, Object> event) {
        String eventType = String.valueOf(event.getOrDefault("eventType", ""));

        switch (eventType) {
            case "ESCROW_RELEASED" -> handleEscrowReleased(event);
            case "PAYMENT_COMPLETED" -> handlePaymentCompleted(event);
            default -> log.debug("Ignoring payment event type: {}", eventType);
        }
    }

    private void handleEscrowReleased(Map<String, Object> event) {
        try {
            Long escrowId = toLong(event.get("escrowId"));
            Long reservationId = toLong(event.get("reservationId"));

            if (escrowId == null || reservationId == null) {
                log.warn("ESCROW_RELEASED event missing escrowId or reservationId");
                return;
            }

            log.info("Processing ESCROW_RELEASED for escrow {} reservation {}", escrowId, reservationId);

            EscrowHold hold = escrowHoldRepository.findById(escrowId).orElse(null);
            if (hold == null) {
                log.warn("Escrow {} not found", escrowId);
                return;
            }

            // Find reservation to get owner
            Reservation reservation = reservationRepository.findById(reservationId).orElse(null);
            if (reservation == null) {
                log.warn("Reservation {} not found for split", reservationId);
                return;
            }

            // Get owner ID from reservation's property
            Long ownerId = null;
            if (reservation.getProperty() != null && reservation.getProperty().getOwner() != null) {
                ownerId = reservation.getProperty().getOwner().getId();
            }

            if (ownerId == null) {
                log.warn("Could not determine owner for reservation {}", reservationId);
                return;
            }

            splitPaymentService.splitPayment(
                reservationId, hold.getAmount(), hold.getCurrency(), ownerId);

        } catch (Exception e) {
            log.error("Failed to process ESCROW_RELEASED event: {}", e.getMessage(), e);
        }
    }

    /**
     * PAYMENT_COMPLETED : réconciliation provider-agnostique de l'entité métier
     * rattachée à la transaction (ADR paiement multi-provider, Vague 2). Le
     * dispatch se fait sur {@code sourceType} ; les autres sourceTypes (ex.
     * INTERVENTION unitaire, réconciliés par le webhook Stripe) sont ignorés ici.
     *
     * <p>Pas de {@code catch} avaleur (règle #7) : un échec de réconciliation
     * remonte → retry Kafka puis DLT. La réconciliation elle-même est idempotente,
     * donc un retry est sûr.</p>
     */
    private void handlePaymentCompleted(Map<String, Object> event) {
        String sourceType = String.valueOf(event.getOrDefault("sourceType", ""));
        Object rawRef = event.get("transactionRef");
        String transactionRef = rawRef != null ? String.valueOf(rawRef) : null;
        if (transactionRef == null || transactionRef.isBlank()) {
            log.warn("PAYMENT_COMPLETED sans transactionRef — ignore");
            return;
        }

        if (sourceType.startsWith(DeferredPaymentService.SOURCE_TYPE_PREFIX)) {
            log.info("PAYMENT_COMPLETED differe : tx={} sourceType={} → reconciliation interventions",
                    transactionRef, sourceType);
            deferredPaymentReconciliationService.reconcile(transactionRef);
        } else if (ReservationPaymentService.SOURCE_TYPE.equals(sourceType)) {
            log.info("PAYMENT_COMPLETED reservation : tx={} → reconciliation reservation", transactionRef);
            reservationPaymentReconciliationService.reconcile(transactionRef);
        } else if (com.clenzy.booking.service.BookingBalanceService.SOURCE_TYPE.equals(sourceType)) {
            log.info("PAYMENT_COMPLETED solde booking : tx={} → reconciliation solde", transactionRef);
            bookingBalanceReconciliationService.reconcile(transactionRef);
        } else if (com.clenzy.service.ai.AiCreditPurchaseService.SOURCE_TYPE.equals(sourceType)) {
            log.info("PAYMENT_COMPLETED crédits IA : tx={} → dotation crédits", transactionRef);
            peripheralPaymentReconciliationService.reconcileAiCreditTopUp(transactionRef);
        } else if (ServiceRequestPaymentService.SOURCE_TYPE.equals(sourceType)) {
            log.info("PAYMENT_COMPLETED demande de service : tx={} → confirmation SR", transactionRef);
            peripheralPaymentReconciliationService.reconcileServiceRequest(transactionRef);
        } else if (UpsellService.SOURCE_TYPE.equals(sourceType)) {
            log.info("PAYMENT_COMPLETED upsell : tx={} → confirmation commande upsell", transactionRef);
            peripheralPaymentReconciliationService.reconcileUpsell(transactionRef);
        } else if (ConsumerReconciledSourceTypes.isReconciledByConsumer(sourceType)) {
            // Incohérence : ce sourceType est déclaré « consumer-réconcilié » (source de
            // vérité partagée) mais aucune branche ne le dispatche. Signaler plutôt qu'ignorer.
            log.error("PAYMENT_COMPLETED tx={} sourceType={} déclaré consumer-réconcilié mais non dispatché — "
                    + "incohérence à corriger (branche manquante)", transactionRef, sourceType);
        } else {
            log.debug("PAYMENT_COMPLETED tx={} sourceType={} — aucune reconciliation dediee dans ce consumer",
                    transactionRef, sourceType);
        }
    }

    private Long toLong(Object value) {
        if (value == null) return null;
        if (value instanceof Number n) return n.longValue();
        try {
            return Long.parseLong(String.valueOf(value));
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
