package com.clenzy.service.automation;

import com.clenzy.model.AutomationAction;
import com.clenzy.model.AutomationRule;
import com.clenzy.service.ServiceRequestService;
import com.clenzy.service.automation.CreateCleaningRequestExecutor.StayReference;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Executeur {@code CANCEL_LINKED_CLEANING_REQUEST} du moteur AutomationRule
 * (fiche 08, F2a) : sur annulation de reservation (trigger RESERVATION_CANCELLED),
 * annule la demande de menage automatique liee (retrouvee par sa cle
 * propriete x dates) si elle n'est pas deja commencee. Skip explicite sinon.
 */
@Service
public class CancelLinkedCleaningRequestExecutor implements AutomationActionExecutor {

    private static final Logger log = LoggerFactory.getLogger(CancelLinkedCleaningRequestExecutor.class);

    private final ServiceRequestService serviceRequestService;

    public CancelLinkedCleaningRequestExecutor(ServiceRequestService serviceRequestService) {
        this.serviceRequestService = serviceRequestService;
    }

    @Override
    public AutomationAction action() {
        return AutomationAction.CANCEL_LINKED_CLEANING_REQUEST;
    }

    @Override
    public ExecutionResult execute(AutomationRule rule, AutomationActionContext ctx) {
        StayReference stay = StayReference.from(ctx);
        if (stay == null) {
            throw new IllegalStateException("CANCEL_LINKED_CLEANING_REQUEST attend un sujet "
                + AutomationSubject.TYPE_RESERVATION + " resoluble (recu : "
                + ctx.subjectType() + "#" + ctx.subjectId() + ")");
        }

        var outcome = serviceRequestService.cancelAutomaticCleaningRequest(
            ctx.orgId(), stay.propertyId(), stay.checkIn(), stay.checkOut());
        if (outcome.executed()) {
            log.info("CANCEL_LINKED_CLEANING_REQUEST: demande {} annulee (regle {}, reservation {})",
                outcome.request().getId(), rule.getId(), stay.reservationId());
            return ExecutionResult.executed();
        }
        return ExecutionResult.skipped(outcome.skipReason());
    }
}
