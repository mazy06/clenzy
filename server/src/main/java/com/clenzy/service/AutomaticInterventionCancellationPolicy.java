package com.clenzy.service;

import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.repository.ServiceQuoteRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Une annulation de réservation ne vaut pas annulation d'un engagement prestataire. */
@Service
@Transactional(propagation = Propagation.MANDATORY)
public class AutomaticInterventionCancellationPolicy {
    private final InterventionPaymentCoordination payments;
    private final ServiceQuoteRepository quotes;
    public AutomaticInterventionCancellationPolicy(InterventionPaymentCoordination payments, ServiceQuoteRepository quotes) {
        this.payments = payments; this.quotes = quotes;
    }
    public String blocker(Intervention intervention) {
        var mission = payments.lockMission(intervention.getOrganizationId(), intervention.getId());
        if (mission.getStatus() == InterventionStatus.COMPLETED || mission.getStatus() == InterventionStatus.CANCELLED) return "CLOSED";
        if (quotes.hasApprovedAgreement(mission.getId(), mission.getOrganizationId())) return "AGREEMENT_REQUIRES_REASON";
        if (payments.cancellationNeedsPaymentReview(mission)) return "PAYMENT_REVIEW_REQUIRED";
        return null;
    }
}

