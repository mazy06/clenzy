package com.clenzy.service.messaging;

import com.clenzy.repository.ReservationRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/** Queues Baitly actions atomically with a booking; only committed rows reach the worker. */
@Component
public class BaitlyReservationAutomationStarter {
    private final ReservationRepository reservations;
    private final AutomationEvaluationService automations;
    private final TransactionTemplate transaction;

    public BaitlyReservationAutomationStarter(ReservationRepository reservations,
                                             AutomationEvaluationService automations,
                                             PlatformTransactionManager transactionManager) {
        this.reservations = reservations;
        this.automations = automations;
        this.transaction = new TransactionTemplate(transactionManager);
        transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRED);
    }

    public void schedule(Long reservationId, Long organizationId) {
        if (reservationId == null || organizationId == null) {
            throw new IllegalArgumentException("Une réservation et une organisation sont requises.");
        }
        start(reservationId, organizationId);
    }

    private void start(Long reservationId, Long organizationId) {
        transaction.executeWithoutResult(status -> reservations.findById(reservationId)
            .filter(stay -> organizationId.equals(stay.getOrganizationId()))
            .filter(stay -> "confirmed".equalsIgnoreCase(stay.getStatus()))
            .ifPresent(stay -> automations.onReservationCreated(stay, organizationId)));
    }
}
