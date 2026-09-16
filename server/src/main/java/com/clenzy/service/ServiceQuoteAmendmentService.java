package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.exception.NotFoundException;
import com.clenzy.util.JwtRoleExtractor;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.Clock;
import java.util.List;
import java.util.Objects;

/** Propositions et décisions sur les accords des missions non engagées financièrement. */
@Service
@Transactional
public class ServiceQuoteAmendmentService {
    private final EntityManager em;
    private final ServiceQuoteAmendmentRepository amendments;
    private final UserRepository users;
    private final QuoteDiscussionScope scope;
    private final Clock clock;
    private final InterventionPaymentCoordination interventionPayments;
    private final ServiceQuoteAgreementService agreements;
    private final ServiceQuoteAmendmentDiscussion discussion;
    private final ServiceQuoteAmendmentArchives archives;

    public ServiceQuoteAmendmentService(EntityManager em, ServiceQuoteAmendmentRepository amendments,
                                       UserRepository users, QuoteDiscussionScope scope, Clock clock,
                                       InterventionPaymentCoordination interventionPayments,
                                       ServiceQuoteAgreementService agreements, ServiceQuoteAmendmentDiscussion discussion,
                                       ServiceQuoteAmendmentArchives archives) {
        this.em = em; this.amendments = amendments; this.users = users; this.scope = scope; this.clock = clock;
        this.interventionPayments = interventionPayments;
        this.agreements = agreements;
        this.discussion = discussion;
        this.archives = archives;
    }

    public ServiceQuoteAmendment propose(Long quoteId, Long orgId, Jwt jwt, BigDecimal amount, String reason) {
        ServiceQuote quote = quote(quoteId, true);
        User actor = actor(jwt);
        if (!isProvider(quote, actor) || isCustomer(quote, orgId, jwt)) deny();
        if (quote.getInterventionId() == null) throw new IllegalStateException("Mission planifiée requise");
        Intervention mission = interventionPayments.lockMission(quote.getOrganizationId(), quote.getInterventionId());
        requireContractedProvider(quote, mission);
        interventionPayments.requireNoRecordedPayment(mission);
        // Valider la nouvelle proposition avant de toucher à l'historique existant.
        BigDecimal agreedAmount = agreements.current(quote).agreedAmount();
        var proposal = ServiceQuoteAmendment.propose(quote, mission, actor.getId(), amount, reason, clock.instant(), agreedAmount);
        for (var pending : amendments.findByQuoteIdAndOrganizationIdAndStatus(
                quoteId, quote.getOrganizationId(), ServiceQuoteAmendment.Status.PROPOSED)) {
            if (pending.getStatus() != ServiceQuoteAmendment.Status.PROPOSED) continue;
            em.refresh(pending, LockModeType.PESSIMISTIC_WRITE);
            if (pending.getStatus() == ServiceQuoteAmendment.Status.PROPOSED && !pending.isBasedOn(quote, mission, agreedAmount)) {
                pending.markObsolete(actor.getId(), clock.instant());
                amendments.saveAndFlush(pending); // Libère l'index unique avant la nouvelle insertion.
            }
        }
        if (amendments.existsByQuoteIdAndStatus(quoteId, ServiceQuoteAmendment.Status.PROPOSED)) {
            throw new IllegalStateException("Un avenant est déjà en attente pour ce devis");
        }
        amendments.saveAndFlush(proposal);
        discussion.proposed(quote, proposal, jwt.getSubject());
        return proposal;
    }

    @Transactional(readOnly = true)
    public Access access(Long quoteId, Long orgId, Jwt jwt) {
        ServiceQuote quote = quote(quoteId, false);
        User actor = actor(jwt);
        boolean provider = isProvider(quote, actor);
        boolean customer = isCustomer(quote, orgId, jwt);
        if (!provider && !customer) deny();
        var mission = quote.getInterventionId() == null ? null : em.find(Intervention.class, quote.getInterventionId());
        BigDecimal agreedAmount = quote.getStatus() == ServiceQuote.Status.APPROVED
                ? agreements.current(quote).agreedAmount() : null;
        boolean available = quote.getStatus() == ServiceQuote.Status.APPROVED && mission != null
                && Objects.equals(mission.getOrganizationId(), quote.getOrganizationId())
                && hasContractedProvider(quote, mission)
                && ServiceQuoteAmendment.eligibilityFailure(quote, mission, agreedAmount) == null;
        if (available) {
            available = !interventionPayments.hasRecordedPayment(mission);
        }
        // Une proposition obsolète peut être remplacée ; seule une proposition fondée
        // sur l'accord et la version actuels peut être acceptée ou bloquer ce remplacement.
        var pending = available ? amendments.findByQuoteIdAndOrganizationIdAndStatus(
                quoteId, quote.getOrganizationId(), ServiceQuoteAmendment.Status.PROPOSED)
                : java.util.List.<ServiceQuoteAmendment>of();
        boolean currentProposal = pending.stream().anyMatch(proposal -> proposal.isBasedOn(quote, mission, agreedAmount));
        boolean acceptableProposal = pending.stream().anyMatch(proposal -> proposal.isBasedOn(quote, mission, agreedAmount)
                && !Objects.equals(proposal.getProposedBy(), actor.getId()));
        return new Access(actor.getId(), provider && !customer && available && !currentProposal, customer && !provider,
                customer && !provider && available && acceptableProposal, provider);
    }

    /** Prévisualisation des droits ; les conditions métier sont revérifiées sous verrou à chaque commande. */
    public record Access(Long actorId, boolean canPropose, boolean canDecide, boolean canAccept, boolean canWithdrawOwn) {}

    /** Même identité et mêmes rôles que la lecture unitaire ; le SQL filtre avant de paginer. */
    @Transactional(readOnly = true)
    public LibraryAccess libraryAccess(Long orgId, Jwt jwt) {
        User actor = actor(jwt);
        if (orgId == null) deny();
        var role = JwtRoleExtractor.extractUserRole(jwt);
        return new LibraryAccess(actor.getId(), orgId, jwt.getSubject(), java.util.Set.copyOf(scope.teamsOf(actor)),
                role != null && role.isPlatformStaff(), role == UserRole.HOST);
    }

    public record LibraryAccess(Long actorId, Long organizationId, String subject, java.util.Set<Long> teamIds,
                                boolean staff, boolean owner) {}

    @Transactional(readOnly = true)
    public ServiceQuoteAgreementService.Agreement currentAgreement(Long quoteId, Long orgId, Jwt jwt) {
        ServiceQuote quote = quote(quoteId, false);
        if (!isProvider(quote, actor(jwt)) && !isCustomer(quote, orgId, jwt)) deny();
        return agreements.current(quote);
    }

    @Transactional(readOnly = true)
    public List<ServiceQuoteAmendment> list(Long quoteId, Long orgId, Jwt jwt) {
        ServiceQuote quote = quote(quoteId, false);
        if (!isProvider(quote, actor(jwt)) && !isCustomer(quote, orgId, jwt)) deny();
        return amendments.findByQuoteIdAndOrganizationIdOrderByCreatedAtDesc(quoteId, quote.getOrganizationId());
    }

    /** Copie des seules données historiques, autorisée avant toute conversion externe. */
    @Transactional(readOnly = true)
    public AcceptedDocument acceptedDocument(Long id, Long orgId, Jwt jwt) {
        var amendment = em.find(ServiceQuoteAmendment.class, id);
        if (amendment == null) throw new NotFoundException("Avenant introuvable");
        var quote = quote(amendment.getQuoteId(), false);
        if (!Objects.equals(amendment.getOrganizationId(), quote.getOrganizationId())
                || !Objects.equals(amendment.getInterventionId(), quote.getInterventionId())) deny();
        if (!isProvider(quote, actor(jwt)) && !isCustomer(quote, orgId, jwt)) deny();
        if (amendment.getStatus() != ServiceQuoteAmendment.Status.ACCEPTED) {
            throw new IllegalStateException("Seul un avenant accepté peut être téléchargé");
        }
        return new AcceptedDocument(amendment.getId(), amendment.getOrganizationId(), amendment.getQuoteId(), amendment.getInterventionId(),
                amendment.getOriginalAmount(), amendment.getProposedAmount(), amendment.getCurrency(),
                amendment.getReason(), amendment.getProposedBy(), amendment.getCreatedAt(),
                amendment.getDecidedBy(), amendment.getDecidedAt());
    }

    public record AcceptedDocument(Long id, Long organizationId, Long quoteId, Long interventionId, BigDecimal originalAmount,
                                   BigDecimal proposedAmount, String currency, String reason, Long proposedBy,
                                   java.time.Instant createdAt, Long decidedBy, java.time.Instant decidedAt) {}

    public ServiceQuoteAmendment close(Long id, Long orgId, Jwt jwt, long version, boolean withdraw) {
        var proposal = em.find(ServiceQuoteAmendment.class, id);
        if (proposal == null) throw new NotFoundException("Avenant introuvable");
        ServiceQuote quote = quote(proposal.getQuoteId(), true);
        em.refresh(proposal, LockModeType.PESSIMISTIC_WRITE);
        User actor = actor(jwt);
        if (!Objects.equals(proposal.getOrganizationId(), quote.getOrganizationId())) deny();
        if (withdraw) {
            if (!Objects.equals(proposal.getProposedBy(), actor.getId()) || !isProvider(quote, actor)) deny();
        } else if (!isCustomer(quote, orgId, jwt) || isProvider(quote, actor)
                || Objects.equals(proposal.getProposedBy(), actor.getId())) deny();
        proposal.close(withdraw ? ServiceQuoteAmendment.Status.WITHDRAWN : ServiceQuoteAmendment.Status.REJECTED,
                actor.getId(), version, clock.instant());
        amendments.saveAndFlush(proposal);
        discussion.closed(quote, proposal, jwt.getSubject());
        return proposal;
    }

    public ServiceQuoteAmendment accept(Long id, Long orgId, Jwt jwt, long version) {
        var proposal = em.find(ServiceQuoteAmendment.class, id);
        if (proposal == null) throw new NotFoundException("Avenant introuvable");
        ServiceQuote quote = quote(proposal.getQuoteId(), true);
        User actor = actor(jwt);
        if (!isCustomer(quote, orgId, jwt) || isProvider(quote, actor)
                || Objects.equals(proposal.getProposedBy(), actor.getId())) deny();
        Intervention mission = interventionPayments.lockMission(quote.getOrganizationId(), quote.getInterventionId());
        // Recontrôler les droits du propriétaire sur l'entité rafraîchie sous verrou.
        if (!isCustomer(quote, orgId, jwt)) deny();
        em.refresh(proposal, LockModeType.PESSIMISTIC_WRITE);
        requireContractedProvider(quote, mission);
        interventionPayments.requireNoRecordedPayment(mission);
        var agreement = agreements.current(quote);
        proposal.accept(quote, mission, agreement.agreedAmount(), actor.getId(), version, clock.instant());
        mission.setEstimatedCost(proposal.getProposedAmount());
        if (mission.getActualCost() != null) mission.setActualCost(proposal.getProposedAmount());
        mission.setCurrency(proposal.getCurrency());
        amendments.saveAndFlush(proposal); // Flush également la mission gérée ; version et décision sont atomiques.
        archives.request(proposal.getId(), proposal.getOrganizationId());
        discussion.accepted(quote, proposal, jwt.getSubject());
        return proposal;
    }

    private ServiceQuote quote(Long id, boolean lock) {
        var quote = em.find(ServiceQuote.class, id);
        if (quote == null) throw new NotFoundException("Devis introuvable");
        if (lock) em.refresh(quote, LockModeType.PESSIMISTIC_WRITE);
        return quote;
    }
    private User actor(Jwt jwt) {
        if (jwt == null) throw new AccessDeniedException("Authentification requise");
        return users.findByKeycloakId(jwt.getSubject()).orElseThrow(() -> new AccessDeniedException("Compte introuvable"));
    }
    private boolean isProvider(ServiceQuote quote, User actor) {
        return quote.getProviderTeamId() != null
                ? scope.teamsOf(actor).contains(quote.getProviderTeamId())
                : quote.getProviderUserId() != null && quote.getProviderUserId().equals(actor.getId());
    }
    /** L'affectation actuelle ne doit pas transférer l'accord commercial à un autre prestataire. */
    private boolean hasContractedProvider(ServiceQuote quote, Intervention mission) {
        if (mission.getTeamId() != null) {
            return Objects.equals(quote.getProviderTeamId(), mission.getTeamId())
                    && mission.getAssignedUser() == null;
        }
        User assigned = mission.getAssignedUser();
        if (assigned == null || assigned.getId() == null) return false;
        return quote.getProviderTeamId() != null
                ? scope.teamsOf(assigned).contains(quote.getProviderTeamId())
                : Objects.equals(quote.getProviderUserId(), assigned.getId());
    }

    private void requireContractedProvider(ServiceQuote quote, Intervention mission) {
        if (!hasContractedProvider(quote, mission)) {
            throw new IllegalStateException("L'affectation de la mission ne correspond plus au prestataire du devis");
        }
    }
    private boolean isCustomer(ServiceQuote quote, Long orgId, Jwt jwt) {
        if (orgId == null || !orgId.equals(quote.getOrganizationId())) return false;
        var role = JwtRoleExtractor.extractUserRole(jwt);
        if (role != null && role.isPlatformStaff()) return true;
        if (role != UserRole.HOST || quote.getInterventionId() == null) return false;
        var mission = em.find(Intervention.class, quote.getInterventionId());
        return mission != null && Objects.equals(mission.getOrganizationId(), orgId)
                && mission.getProperty() != null && mission.getProperty().getOwner() != null
                && jwt.getSubject().equals(mission.getProperty().getOwner().getKeycloakId());
    }
    private static void deny() { throw new AccessDeniedException("Cet avenant est réservé aux parties du devis"); }
}
