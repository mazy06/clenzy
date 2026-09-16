package com.clenzy.service.assignment;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.*;

/** Les devis internes utilisent le même dossier commercial que les autres devis du PMS. */
@Service
@Transactional
public class AssignmentQuoteService {
    private final ServiceAssignmentService assignments;
    private final AssignmentProposalStore proposals;
    private final ServiceQuoteRepository quotes;
    private final UserRepository users;
    private final AcceptedServiceRequestConverter converter;
    private final JdbcTemplate db;
    private final Clock clock;
    public AssignmentQuoteService(ServiceAssignmentService assignments,AssignmentProposalStore proposals,
            ServiceQuoteRepository quotes,UserRepository users,AcceptedServiceRequestConverter converter,JdbcTemplate db,Clock clock) {
        this.assignments=assignments; this.proposals=proposals; this.quotes=quotes; this.users=users;
        this.converter=converter; this.db=db; this.clock=clock;
    }
    public record Offer(BigDecimal amount,String currency,LocalDate validUntil,String description) {}
    @Transactional(readOnly=true)
    public java.util.List<ServiceQuote> list(Long requestId,Long organizationId,Jwt jwt) {
        assignments.requireManager(requestId,organizationId,jwt);
        return quotes.findByServiceRequestIdAndOrganizationIdOrderByCreatedAtDesc(requestId,organizationId);
    }
    public Long submit(Long requestId,Long proposalId,Offer offer,Jwt jwt) {
        var need=assignments.lock(requestId);
        var proposal=proposals.get(proposalId).orElseThrow();
        if (!requestId.equals(proposal.requestId())) throw new AccessDeniedException("Proposition hors demande");
        assignments.requireRecipient(proposal,jwt);
        var existing=db.queryForList("SELECT id FROM service_quotes WHERE assignment_proposal_id=?",Long.class,proposalId);
        if (!existing.isEmpty()) return existing.getFirst();
        if (!"PENDING".equals(proposal.status()) || proposal.cycle()!=need.getAssignmentCycle()
                || !"PROPOSED".equals(need.getAssignmentPhase()) || !clock.instant().isBefore(proposal.expiresAt()))
            throw new IllegalStateException("Cette proposition n'est plus active");
        if (offer.amount()==null || offer.amount().signum()<0 || offer.amount().compareTo(new BigDecimal("1000000"))>0
                || offer.amount().stripTrailingZeros().scale()>2 || offer.currency()==null || !offer.currency().matches("[A-Z]{3}")
                || offer.validUntil()==null || offer.validUntil().isBefore(LocalDate.now(clock))
                || offer.description()!=null && offer.description().length()>1000)
            throw new IllegalArgumentException("Conditions du devis invalides");
        java.util.Currency.getInstance(offer.currency());
        var author=users.findById(assignments.currentUser(jwt)).orElseThrow();
        var quote=new ServiceQuote();
        quote.setOrganizationId(need.getOrganizationId()); quote.setPropertyId(need.getProperty()==null?null:need.getProperty().getId());
        quote.setServiceRequestId(requestId); quote.setAssignmentProposalId(proposalId);
        quote.setProviderUserId(author.getId()); quote.setProviderTeamId("team".equals(proposal.targetType())?proposal.targetId():null);
        quote.setProviderName((author.getFirstName()+" "+author.getLastName()).trim()); quote.setProviderEmail(author.getEmail());
        quote.setAmount(offer.amount()); quote.setCurrency(offer.currency()); quote.setValidUntil(offer.validUntil()); quote.setDescription(offer.description());
        quote=quotes.saveAndFlush(quote);
        proposals.close(proposal,"QUOTED",clock.instant(),"Devis transmis au gestionnaire");
        need.setAssignedToId(null); need.setAssignedToType(null); need.setStatus(RequestStatus.PENDING); need.setAssignmentPhase("QUOTED");
        proposals.event(requestId,proposalId,"QUOTED","QUOTED:"+proposalId);
        return quote.getId();
    }
    public Long prepareAcceptance(ServiceQuote quote) {
        var need=assignments.lock(quote.getServiceRequestId());
        assignments.requireOrganization(need,quote.getOrganizationId());
        var proposal=proposals.get(quote.getAssignmentProposalId()).orElseThrow();
        if (!"QUOTED".equals(need.getAssignmentPhase()) || !"QUOTED".equals(proposal.status())
                || !need.getId().equals(proposal.requestId()) || proposal.cycle()!=need.getAssignmentCycle())
            throw new IllegalStateException("Ce devis ne correspond plus au besoin actuel");
        assignments.requireTimelyAgreement(need);
        assignments.requireEligible(need,proposal.targetType(),proposal.targetId());
        need.setAssignedToType(proposal.targetType()); need.setAssignedToId(proposal.targetId()); need.setEstimatedCost(quote.getAmount());
        var mission=converter.convert(need); mission.setCurrency(quote.getCurrency());
        if (db.update("UPDATE service_assignment_proposals SET status='ACCEPTED',responded_at=? WHERE id=? AND status='QUOTED'",
                java.sql.Timestamp.from(clock.instant()),proposal.id())!=1) throw new IllegalStateException("Devis déjà traité");
        proposals.event(need.getId(),proposal.id(),"ACCEPTED","ACCEPTED:"+proposal.id());
        return mission.getId();
    }
    public void requireManager(ServiceQuote quote,Jwt jwt) {
        assignments.requireManager(quote.getServiceRequestId(),quote.getOrganizationId(),jwt);
    }
}
