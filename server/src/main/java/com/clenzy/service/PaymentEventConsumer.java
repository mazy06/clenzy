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

    public PaymentEventConsumer(SplitPaymentService splitPaymentService,
                                 EscrowHoldRepository escrowHoldRepository,
                                 ReservationRepository reservationRepository) {
        this.splitPaymentService = splitPaymentService;
        this.escrowHoldRepository = escrowHoldRepository;
        this.reservationRepository = reservationRepository;
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

    private void handlePaymentCompleted(Map<String, Object> event) {
        log.info("Payment completed event received: {}", event.get("transactionRef"));
        // Future: trigger post-payment workflows
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
