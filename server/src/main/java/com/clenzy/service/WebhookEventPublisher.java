package com.clenzy.service;

import com.clenzy.model.WebhookEventType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.List;

/**
 * Point d'entree metier pour emettre un evenement vers les webhooks sortants (CLZ Domaine 10).
 * Enfile la livraison dans la transaction courante, puis declenche la tentative HTTP <b>apres
 * commit</b> (#2). En cas d'echec immediat, le scheduler de retry prend le relais. L'emission est
 * best-effort : elle ne doit jamais faire echouer la transaction metier.
 */
@Service
public class WebhookEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(WebhookEventPublisher.class);

    private final WebhookDeliveryService deliveryService;

    public WebhookEventPublisher(WebhookDeliveryService deliveryService) {
        this.deliveryService = deliveryService;
    }

    public void publish(WebhookEventType eventType, Long orgId, Object payload) {
        if (orgId == null) {
            return;
        }
        final List<Long> deliveryIds;
        try {
            deliveryIds = deliveryService.enqueue(eventType, orgId, payload);
        } catch (Exception e) {
            log.warn("Enfilage webhook {} (org {}) impossible: {}", eventType, orgId, e.getMessage());
            return;
        }
        if (deliveryIds.isEmpty()) {
            return;
        }
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    deliveryIds.forEach(WebhookEventPublisher.this::safeAttempt);
                }
            });
        } else {
            deliveryIds.forEach(this::safeAttempt);
        }
    }

    private void safeAttempt(Long deliveryId) {
        try {
            deliveryService.attempt(deliveryId);
        } catch (Exception e) {
            // La livraison reste en file : le scheduler de retry reessaiera.
            log.warn("Tentative immediate du webhook {} echouee (retry programme): {}", deliveryId, e.getMessage());
        }
    }
}
