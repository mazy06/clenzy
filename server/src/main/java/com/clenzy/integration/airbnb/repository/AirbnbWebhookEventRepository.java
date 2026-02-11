package com.clenzy.integration.airbnb.repository;

import com.clenzy.integration.airbnb.model.AirbnbWebhookEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Repository for managing {@link AirbnbWebhookEvent} entities.
 */
@Repository
public interface AirbnbWebhookEventRepository extends JpaRepository<AirbnbWebhookEvent, Long> {

    Optional<AirbnbWebhookEvent> findByEventId(String eventId);

    List<AirbnbWebhookEvent> findByEventTypeAndStatus(String eventType, AirbnbWebhookEvent.WebhookEventStatus status);

    List<AirbnbWebhookEvent> findByStatusOrderByReceivedAtAsc(AirbnbWebhookEvent.WebhookEventStatus status);

    List<AirbnbWebhookEvent> findByStatusAndRetryCountLessThan(AirbnbWebhookEvent.WebhookEventStatus status, int maxRetries);

    long countByStatus(AirbnbWebhookEvent.WebhookEventStatus status);

    List<AirbnbWebhookEvent> findByReceivedAtAfter(LocalDateTime since);
}
