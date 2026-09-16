package com.clenzy.service.assignment;

import com.clenzy.repository.ServiceRequestRepository;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.util.*;

/** Projection personnelle bornée aux cartes affichées, sans divulguer les offres concurrentes. */
@Service
@Transactional(readOnly=true)
public class AssignmentCardQuery {
    public record Card(Long requestId, AssignmentProposalStore.Proposal proposal,
                       AssignmentCommercialTerms.Terms price, boolean quote, BigDecimal estimate,
                       AssignmentCommercialTerms.Terms offeredPrice, String estimateCurrency) {}
    private final NamedParameterJdbcTemplate db;
    private final ServiceRequestRepository requests;
    private final AssignmentProposalStore proposals;
    private final AssignmentCommercialTerms commercial;
    public AssignmentCardQuery(NamedParameterJdbcTemplate db, ServiceRequestRepository requests,
            AssignmentProposalStore proposals, AssignmentCommercialTerms commercial) {
        this.db=db; this.requests=requests; this.proposals=proposals; this.commercial=commercial;
    }
    public List<Card> cards(Long user, List<Long> ids) {
        if (ids==null || ids.isEmpty() || ids.size()>20 || ids.stream().anyMatch(id -> id==null || id<=0))
            throw new IllegalArgumentException("Entre 1 et 20 demandes sont requises");
        var params=Map.of("user",user,"ids",ids);
        // L'autorisation est liée au destinataire, y compris pour une sollicitation inter-organisations.
        var allowed=db.queryForList("""
            SELECT r.id FROM service_requests r WHERE r.id IN (:ids) AND (
              (r.assigned_to_type='user' AND r.assigned_to_id=:user)
              OR (r.assigned_to_type='team' AND EXISTS (SELECT 1 FROM team_members m WHERE m.team_id=r.assigned_to_id AND m.user_id=:user))
              OR EXISTS (SELECT 1 FROM service_assignment_proposals p WHERE p.request_id=r.id AND p.cycle=r.assignment_cycle AND
                ((p.target_type='user' AND p.target_id=:user) OR (p.target_type='team' AND EXISTS
                 (SELECT 1 FROM team_members m WHERE m.team_id=p.target_id AND m.user_id=:user))))
              OR EXISTS (SELECT 1 FROM service_quotes q WHERE q.service_request_id=r.id AND
                (q.provider_user_id=:user OR (q.provider_team_id IS NOT NULL AND EXISTS
                  (SELECT 1 FROM team_members tm WHERE tm.team_id=q.provider_team_id AND tm.user_id=:user)))))
            """,params,Long.class);
        if (allowed.isEmpty()) return List.of();
        var ownTeams=new HashSet<>(db.queryForList("SELECT team_id FROM team_members WHERE user_id=:user",Map.of("user",user),Long.class));
        var active=new HashMap<Long,AssignmentProposalStore.PricedProposal>();
        proposals.forCards(user,allowed).forEach(p -> active.put(p.proposal().requestId(),p));
        var ownQuotes=new HashMap<Long,AssignmentCommercialTerms.Terms>();
        db.query("""
            SELECT q.service_request_id,q.amount,q.currency FROM service_quotes q
            JOIN service_requests r ON r.id=q.service_request_id AND r.organization_id=q.organization_id
            LEFT JOIN service_assignment_proposals p ON p.id=q.assignment_proposal_id
            LEFT JOIN marketplace_quote_requests m ON m.id=q.marketplace_request_id
            WHERE q.service_request_id IN (:ids)
            AND (q.provider_user_id=:user OR (q.provider_team_id IS NOT NULL AND EXISTS
                (SELECT 1 FROM team_members tm WHERE tm.team_id=q.provider_team_id AND tm.user_id=:user)))
            AND q.status IN ('RECEIVED','APPROVED')
            AND (p.cycle=r.assignment_cycle OR m.service_request_cycle=r.assignment_cycle OR
                 (q.assignment_proposal_id IS NULL AND q.marketplace_request_id IS NULL))
            ORDER BY q.created_at DESC,q.id DESC
            """,Map.of("ids",allowed,"user",user), (org.springframework.jdbc.core.RowCallbackHandler) r ->
                ownQuotes.putIfAbsent(r.getLong(1),new AssignmentCommercialTerms.Terms(r.getBigDecimal(2),r.getString(3),null)));
        var result=new ArrayList<Card>();
        for (var need:requests.findAllById(allowed)) {
            var priced=active.get(need.getId());
            boolean quote=ownQuotes.containsKey(need.getId());
            boolean assigned="user".equals(need.getAssignedToType())?Objects.equals(user,need.getAssignedToId()):
                "team".equals(need.getAssignedToType()) && ownTeams.contains(need.getAssignedToId());
            var price=quote?ownQuotes.get(need.getId()):priced!=null?commercial.preview(need,priced.proposal().targetType(),priced.proposal().targetId()):
                assigned?commercial.preview(need,need.getAssignedToType(),need.getAssignedToId()):null;
            BigDecimal estimate=need.getRecommendedCost()!=null?need.getRecommendedCost():need.getEstimatedCost();
            String estimateCurrency=need.getRecommendedCost()!=null?"EUR":null;
            if (estimate==null) {
                var suggested=commercial.suggestion(need);
                if (suggested!=null) { estimate=suggested.amount();estimateCurrency=suggested.currency(); }
            }
            result.add(new Card(need.getId(),quote || priced==null?null:priced.proposal(),price,quote,
                estimate,priced==null?null:priced.terms(),estimateCurrency));
        }
        return result;
    }
}
