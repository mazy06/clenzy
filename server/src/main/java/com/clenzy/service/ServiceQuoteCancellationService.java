package com.clenzy.service;

import com.clenzy.exception.NotFoundException;
import com.clenzy.model.*;
import com.clenzy.repository.ServiceQuoteCancellationRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import java.time.Instant;
import java.util.Objects;

/** Une décision, un verrou partagé avec les paiements, une notification transactionnelle. */
@Service
@Transactional
public class ServiceQuoteCancellationService {
    private final EntityManager em;
    private final ServiceQuoteCancellationRepository cancellations;
    private final ServiceQuoteAmendmentService parties;
    private final ServiceQuoteAgreementService agreements;
    private final InterventionPaymentCoordination payments;
    private final ServiceQuoteAmendmentDiscussion discussion;
    private final Clock clock;
    private final ServiceRequestCancellationCoordination requests;
    private final MissionFinancialService finances;

    public ServiceQuoteCancellationService(EntityManager em, ServiceQuoteCancellationRepository cancellations,
            ServiceQuoteAmendmentService parties, ServiceQuoteAgreementService agreements,
            InterventionPaymentCoordination payments, ServiceQuoteAmendmentDiscussion discussion, Clock clock,
            ServiceRequestCancellationCoordination requests, MissionFinancialService finances) {
        this.finances = finances;
        this.requests = requests;
        this.em = em; this.cancellations = cancellations; this.parties = parties; this.agreements = agreements;
        this.payments = payments; this.discussion = discussion; this.clock = clock;
    }

    public record View(boolean canCancel, Long missionVersion, String unavailableReason,
                       String reason, Instant cancelledAt) {}

    @Transactional(readOnly = true)
    public View view(Long quoteId, Long orgId, Jwt jwt) {
        var access = parties.access(quoteId, orgId, jwt);
        var quote = quote(quoteId);
        var existing = cancellations.findById(quoteId);
        if (existing.isPresent()) return cancelled(existing.get());
        var mission = quote.getInterventionId() == null ? null : em.find(Intervention.class, quote.getInterventionId());
        String unavailable = failure(quote, mission);
        return new View(access.canDecide() && unavailable == null, mission == null ? null : mission.getVersion(),
                unavailable, null, null);
    }

    public View cancel(Long quoteId, Long orgId, Jwt jwt, Long version, String reason) {
        // La lecture autorisée précède les verrous ; les droits sont revérifiés après rafraîchissement.
        if (!parties.access(quoteId, orgId, jwt).canDecide()) throw new AccessDeniedException("Annulation réservée au gestionnaire du devis");
        String normalized = reason == null ? "" : reason.trim();
        if (normalized.isBlank() || normalized.length() > 1000) throw new IllegalArgumentException("Motif requis, limité à 1000 caractères");
        var quote = quote(quoteId);
        var linkedRequest = requests.lockLinkedRequest(quote);
        em.refresh(quote, LockModeType.PESSIMISTIC_WRITE);
        var mission = quote.getInterventionId() == null ? null : payments.lockMission(quote.getOrganizationId(), quote.getInterventionId());
        if (!parties.access(quoteId, orgId, jwt).canDecide()) throw new AccessDeniedException("Les droits sur ce devis ont changé");
        var existing = cancellations.findById(quoteId);
        if (existing.isPresent()) return cancelled(existing.get());
        String unavailable = failure(quote, mission);
        if (unavailable != null) throw new IllegalStateException("Annulation indisponible : " + unavailable);
        if ((mission != null && (version == null || !Objects.equals(version, mission.getVersion())))
                || (mission == null && version != null)) {
            throw new IllegalStateException("La mission a changé ; actualisez avant de confirmer l'annulation");
        }
        var agreement = agreements.current(quote);
        var cancellation = new ServiceQuoteCancellation(quote, jwt.getSubject(), normalized, clock.instant(),
                agreement.agreedAmount(), agreement.currency());
        if (mission != null) {
            requests.closeLinkedRequest(linkedRequest, mission, normalized);
            mission.setStatus(InterventionStatus.CANCELLED);
        }
        cancellations.saveAndFlush(cancellation);
        finances.open(quoteId, quote.getOrganizationId(), normalized, jwt.getSubject());
        // Si l'écriture du message échoue, la mission et la décision sont annulées ensemble.
        discussion.cancelled(quote, cancellation, jwt.getSubject());
        return cancelled(cancellation);
    }

    private String failure(ServiceQuote quote, Intervention mission) {
        if (quote.getStatus() != ServiceQuote.Status.APPROVED) return "NOT_APPROVED";
        if (mission == null) return quote.getInterventionId() != null ? "NO_MISSION" : null;
        if (!Objects.equals(quote.getOrganizationId(), mission.getOrganizationId())) return "MISSION_SCOPE";
        if (mission.getStatus() == null || !mission.getStatus().canTransitionTo(InterventionStatus.CANCELLED)) return "MISSION_CLOSED";
        String requestFailure = requests.failure(mission.getServiceRequest());
        if (requestFailure != null && !"PAYMENT_REVIEW_REQUIRED".equals(requestFailure)) return requestFailure;
        return null;
    }

    private ServiceQuote quote(Long id) {
        var quote = em.find(ServiceQuote.class, id);
        if (quote == null) throw new NotFoundException("Devis introuvable");
        return quote;
    }
    private View cancelled(ServiceQuoteCancellation cancellation) {
        return new View(false, null, null, cancellation.getReason(), cancellation.getCancelledAt());
    }
}
