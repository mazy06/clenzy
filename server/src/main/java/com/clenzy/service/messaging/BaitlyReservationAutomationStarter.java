package com.clenzy.service.messaging;

import com.clenzy.repository.ReservationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

/** Starts guest-facing actions only after the reservation is durably committed. */
@Component
public class BaitlyReservationAutomationStarter {
    private static final Logger log = LoggerFactory.getLogger(BaitlyReservationAutomationStarter.class);
    private final ReservationRepository reservations;
    private final AutomationEvaluationService automations;
    private final TransactionTemplate transaction;

    public BaitlyReservationAutomationStarter(ReservationRepository reservations,
                                             AutomationEvaluationService automations,
                                             PlatformTransactionManager transactionManager) {
        this.reservations = reservations;
        this.automations = automations;
        this.transaction = new TransactionTemplate(transactionManager);
        transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    public void schedule(Long reservationId, Long organizationId) {
        if (reservationId == null || organizationId == null) {
            throw new IllegalArgumentException("Une réservation et une organisation sont requises.");
        }
        if (TransactionSynchronizationManager.isActualTransactionActive()
                && TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    start(reservationId, organizationId);
                }
            });
        } else {
            start(reservationId, organizationId);
        }
    }

    private void start(Long reservationId, Long organizationId) {
        try {
            // The old persistence context remains bound during afterCommit. A new
            // transaction is essential both for durable writes and lazy associations.
            transaction.executeWithoutResult(status -> reservations.findById(reservationId)
                    .filter(stay -> organizationId.equals(stay.getOrganizationId()))
                    .filter(stay -> "confirmed".equalsIgnoreCase(stay.getStatus()))
                    .ifPresent(stay -> automations.onReservationCreated(stay, organizationId)));
        } catch (RuntimeException failure) {
            // A message failure must never turn a committed booking into an HTTP 500.
            // Scheduled lifecycle rules can still be discovered by the existing sweep.
            log.error("Amorçage après validation impossible pour la réservation {} (org {})",
                    reservationId, organizationId, failure);
        }
    }
}
