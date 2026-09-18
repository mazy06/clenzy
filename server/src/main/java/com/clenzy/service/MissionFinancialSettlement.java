package com.clenzy.service;

import com.clenzy.model.*;
import jakarta.persistence.EntityManager;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

/** Suite comptable et notifications rejouables, distinctes du résultat PSP déjà acquis. */
@Service
public class MissionFinancialSettlement {
    private final JdbcTemplate db;
    private final EntityManager em;
    private final PaymentStatusTransitionService transitions;
    private final PaymentLedgerReversalService ledger;
    private final ServiceQuoteAmendmentDiscussion discussion;
    public MissionFinancialSettlement(JdbcTemplate db, EntityManager em, PaymentStatusTransitionService transitions,
            PaymentLedgerReversalService ledger, ServiceQuoteAmendmentDiscussion discussion) {
        this.db=db; this.em=em; this.transitions=transitions; this.ledger=ledger; this.discussion=discussion;
    }
    @Transactional
    public void settle(Long quoteId) {
        var cancellation=em.find(ServiceQuoteCancellation.class,quoteId);
        if(cancellation==null || cancellation.getInterventionId()==null) return;
        var mission=em.find(Intervention.class,cancellation.getInterventionId());
        if(mission==null || !Objects.equals(mission.getOrganizationId(),cancellation.getOrganizationId())) throw new IllegalStateException("Mission financière inaccessible");
        transitions.lockInterventionPayments(List.of(mission));
        db.queryForMap("SELECT quote_id FROM mission_financial_cases WHERE quote_id=? FOR UPDATE",quoteId);
        long unresolved=db.queryForObject("SELECT count(*) FROM mission_financial_payments WHERE quote_id=? AND (state<>'VERIFIED' OR shared OR refunded<collected)",Long.class,quoteId);
        long collected=db.queryForObject("SELECT coalesce(sum(collected),0) FROM mission_financial_payments WHERE quote_id=?",Long.class,quoteId);
        if(unresolved!=0 || collected==0) return;
        transitions.markInterventionRefunded(mission.getId());
        ledger.reverseInterventionPaymentEntries(mission.getId());
        if(mission.getServiceRequest()!=null) mission.getServiceRequest().setPaymentStatus(PaymentStatus.REFUNDED);
        db.update("UPDATE mission_financial_cases SET accounting_state='DONE' WHERE quote_id=?",quoteId);
    }
    @Transactional
    public void notifyDecision(UUID id) {
        var decision=db.queryForMap("SELECT d.*,p.currency FROM mission_financial_decisions d JOIN mission_financial_payments p ON p.id=d.payment_id WHERE d.id=? FOR UPDATE OF d",id);
        if(decision.get("notified_at")!=null || !Set.of("SUCCEEDED","FAILED").contains(decision.get("state"))) return;
        var quote=em.find(ServiceQuote.class,((Number)decision.get("quote_id")).longValue());
        String state="SUCCEEDED".equals(decision.get("state")) ? "Remboursement confirmé" : "Remboursement refusé";
        String currency=((String)decision.get("currency")).toUpperCase(Locale.ROOT);
        var amount=java.math.BigDecimal.valueOf(((Number)decision.get("amount")).longValue(),MissionFinancialService.minorDigits(currency));
        discussion.financial(quote,(String)decision.get("approved_by"),state,
                state+" : "+amount.toPlainString()+" "+currency+". Référence de décision : "+id+".");
        db.update("UPDATE mission_financial_decisions SET notified_at=now(),notice_error=NULL WHERE id=?",id);
    }
}
