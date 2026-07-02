package com.clenzy.scheduler;

import com.clenzy.repository.AgentPendingActionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * Expiration horaire des pauses HITL non resolues (campagne X1). L'outcome
 * EXPIRED est un signal a part entiere pour les Regles de Confiance (X2) :
 * une action systematiquement ignoree n'est PAS une action a automatiser.
 */
@Component
public class PendingActionExpiryScheduler {

    private static final Logger log = LoggerFactory.getLogger(PendingActionExpiryScheduler.class);

    private final AgentPendingActionRepository repository;

    public PendingActionExpiryScheduler(AgentPendingActionRepository repository) {
        this.repository = repository;
    }

    @Scheduled(cron = "0 25 * * * *")
    @Transactional
    public void expireOverduePendingActions() {
        try {
            int expired = repository.expireOverdue(Instant.now());
            if (expired > 0) {
                log.info("[HITL] {} pause(s) expirée(s) journalisée(s) EXPIRED", expired);
            }
        } catch (Exception e) {
            log.warn("[HITL] Job d'expiration en echec (retentera dans 1h) : {}", e.getMessage(), e);
        }
    }
}
