package com.clenzy.integration.zapier.repository;

import com.clenzy.integration.zapier.model.WebhookSubscription;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository pour les abonnements webhook.
 */
@Repository
public interface WebhookSubscriptionRepository extends JpaRepository<WebhookSubscription, Long> {

    List<WebhookSubscription> findByOrganizationIdAndActive(Long orgId, boolean active);

    List<WebhookSubscription> findByEventTypeAndActive(String eventType, boolean active);

    long countByOrganizationId(Long orgId);
}
