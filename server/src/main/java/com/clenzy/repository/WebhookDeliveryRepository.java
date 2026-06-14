package com.clenzy.repository;

import com.clenzy.model.WebhookDelivery;
import com.clenzy.model.WebhookDelivery.DeliveryStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface WebhookDeliveryRepository extends JpaRepository<WebhookDelivery, Long> {

    /** Livraisons dues pour (re)tentative — cross-org, utilisee par le scheduler. */
    @Query("SELECT d FROM WebhookDelivery d WHERE d.status IN (com.clenzy.model.WebhookDelivery$DeliveryStatus.PENDING, "
         + "com.clenzy.model.WebhookDelivery$DeliveryStatus.RETRYING) AND d.nextAttemptAt <= :now ORDER BY d.nextAttemptAt ASC")
    List<WebhookDelivery> findDue(@Param("now") Instant now, Pageable pageable);

    /** Journal d'un abonne (org-scope explicite), pour l'UI. */
    @Query("SELECT d FROM WebhookDelivery d WHERE d.webhookId = :webhookId AND d.organizationId = :orgId ORDER BY d.createdAt DESC")
    List<WebhookDelivery> findByWebhookId(@Param("webhookId") Long webhookId, @Param("orgId") Long orgId, Pageable pageable);

    long countByOrganizationIdAndStatus(Long organizationId, DeliveryStatus status);
}
