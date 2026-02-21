package com.clenzy.service;

import com.clenzy.config.KafkaConfig;
import com.clenzy.model.OutboxEvent;
import com.clenzy.repository.OutboxEventRepository;
import org.springframework.stereotype.Service;

/**
 * Helper pour publier des events dans l'outbox transactionnel.
 * Chaque methode cree un OutboxEvent dans la meme transaction
 * que la mutation metier. Le OutboxRelay se charge de l'envoi Kafka.
 *
 * Utilisation dans les services :
 *   outboxPublisher.publishCalendarEvent("BOOKED", propertyId, orgId, payload);
 */
@Service
public class OutboxPublisher {

    private final OutboxEventRepository outboxEventRepository;

    public OutboxPublisher(OutboxEventRepository outboxEventRepository) {
        this.outboxEventRepository = outboxEventRepository;
    }

    /**
     * Publie un event calendrier dans l'outbox.
     *
     * @param eventType    type d'event (CALENDAR_BOOKED, CALENDAR_BLOCKED, etc.)
     * @param propertyId   propriete concernee (partition key)
     * @param orgId        organization
     * @param payload      JSON payload
     */
    public void publishCalendarEvent(String eventType, Long propertyId, Long orgId, String payload) {
        OutboxEvent event = new OutboxEvent(
                "CALENDAR",
                String.valueOf(propertyId),
                eventType,
                KafkaConfig.TOPIC_CALENDAR_UPDATES,
                String.valueOf(propertyId),  // partition par propertyId pour FIFO
                payload,
                orgId
        );
        outboxEventRepository.save(event);
    }

    /**
     * Publie un event reservation dans l'outbox.
     *
     * @param eventType      type d'event (RESERVATION_CREATED, RESERVATION_CANCELLED, etc.)
     * @param reservationId  reservation concernee
     * @param propertyId     propriete (partition key)
     * @param orgId          organization
     * @param payload        JSON payload
     */
    public void publishReservationEvent(String eventType, Long reservationId, Long propertyId,
                                         Long orgId, String payload) {
        OutboxEvent event = new OutboxEvent(
                "RESERVATION",
                String.valueOf(reservationId),
                eventType,
                KafkaConfig.TOPIC_CALENDAR_UPDATES,
                String.valueOf(propertyId),
                payload,
                orgId
        );
        outboxEventRepository.save(event);
    }

    /**
     * Publie un event generique dans l'outbox.
     */
    public void publish(String aggregateType, String aggregateId, String eventType,
                        String topic, String partitionKey, String payload, Long orgId) {
        OutboxEvent event = new OutboxEvent(aggregateType, aggregateId, eventType,
                topic, partitionKey, payload, orgId);
        outboxEventRepository.save(event);
    }
}
