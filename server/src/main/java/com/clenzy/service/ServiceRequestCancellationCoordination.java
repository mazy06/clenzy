package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.ServiceQuoteRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.util.Objects;

/** Une demande et sa mission se ferment ensemble ; un accord exige sa commande dédiée. */
@Service
@Transactional(propagation = Propagation.MANDATORY)
public class ServiceRequestCancellationCoordination {
    private final EntityManager em;
    private final InterventionRepository missions;
    private final ServiceQuoteRepository quotes;
    private final InterventionPaymentCoordination payments;

    public ServiceRequestCancellationCoordination(EntityManager em, InterventionRepository missions,
            ServiceQuoteRepository quotes, InterventionPaymentCoordination payments) {
        this.em = em; this.missions = missions; this.quotes = quotes; this.payments = payments;
    }

    /** Ordre commun : demande, puis devis et mission. Les relations sont recontrôlées après verrou. */
    public ServiceRequest lockLinkedRequest(ServiceQuote quote) {
        if (quote.getInterventionId() == null) return null;
        var mission = em.find(Intervention.class, quote.getInterventionId());
        if (mission == null || !Objects.equals(mission.getOrganizationId(), quote.getOrganizationId()))
            throw new IllegalStateException("Mission du devis inaccessible");
        var request = mission.getServiceRequest();
        if (request == null) return null;
        em.refresh(request, LockModeType.PESSIMISTIC_WRITE);
        if (!Objects.equals(request.getOrganizationId(), quote.getOrganizationId()))
            throw new IllegalStateException("Demande liée hors organisation");
        return request;
    }

    public String failure(ServiceRequest request) {
        if (request == null) return null;
        if (request.getStatus() == null || !request.getStatus().canTransitionTo(RequestStatus.CANCELLED))
            return "REQUEST_CLOSED";
        if (request.getPaidAt() != null || (request.getStripeSessionId() != null && !request.getStripeSessionId().isBlank())
                || request.getPaymentStatus() == PaymentStatus.PAID
                || request.getPaymentStatus() == PaymentStatus.PARTIALLY_PAID
                || request.getPaymentStatus() == PaymentStatus.PROCESSING
                || request.getPaymentStatus() == PaymentStatus.REFUNDED) return "PAYMENT_REVIEW_REQUIRED";
        return null;
    }

    /** L'appelant a verrouillé la demande. Ne doit pas contourner une annulation commerciale. */
    public Intervention requireLegacyCancellationAllowed(ServiceRequest request) {
        var check = inspectLegacyCancellation(request);
        if (check.blocker() != null) throw new IllegalStateException("Annulation indisponible : " + check.blocker());
        return check.mission();
    }

    public record CancellationCheck(Intervention mission, String blocker) {}

    /** Résultat métier sans exception : une annulation automatique peut être ignorée sans rollback. */
    public CancellationCheck inspectLegacyCancellation(ServiceRequest request) {
        String failure = failure(request);
        if (failure != null) return new CancellationCheck(null, failure);
        Long id = missions.findIdByServiceRequestId(request.getId());
        if (id == null) return new CancellationCheck(null, null);
        var mission = payments.lockMission(request.getOrganizationId(), id);
        if (quotes.hasApprovedAgreement(id, request.getOrganizationId()))
            return new CancellationCheck(mission, "Annulez l'accord avec son motif depuis le devis avant de remplacer le prestataire");
        if (payments.cancellationNeedsPaymentReview(mission))
            return new CancellationCheck(mission, "PAYMENT_REVIEW_REQUIRED");
        if (mission.getStatus() != InterventionStatus.CANCELLED
                && (mission.getStatus() == null || !mission.getStatus().canTransitionTo(InterventionStatus.CANCELLED)))
            return new CancellationCheck(mission, "La mission liée ne peut plus être annulée");
        return new CancellationCheck(mission, null);
    }

    public void closeLinkedRequest(ServiceRequest request, Intervention mission, String reason) {
        Long actualId = mission.getServiceRequest() == null ? null : mission.getServiceRequest().getId();
        if (!Objects.equals(actualId, request == null ? null : request.getId()))
            throw new IllegalStateException("La demande liée a changé ; actualisez la mission");
        if (request == null) return;
        String failure = failure(request);
        if (failure != null && !"PAYMENT_REVIEW_REQUIRED".equals(failure)) throw new IllegalStateException("Annulation indisponible : " + failure);
        request.setStatus(RequestStatus.CANCELLED);
        request.setAutoAssignStatus(null);
        String note = "Accord annulé : " + reason;
        request.setSpecialInstructions(request.getSpecialInstructions() == null ? note : request.getSpecialInstructions() + "\n" + note);
    }
}
