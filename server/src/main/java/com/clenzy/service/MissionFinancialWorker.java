package com.clenzy.service;

import com.clenzy.payment.StripeGateway;
import com.stripe.model.Refund;
import com.stripe.param.RefundCreateParams;
import org.springframework.jdbc.core.JdbcTemplate;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.util.*;
import static com.clenzy.service.MissionFinancialService.number;

/** Reprises durables ; aucune requête réseau n'est faite dans une transaction SQL. */
@Service
public class MissionFinancialWorker {
    private final JdbcTemplate db;
    private final StripeGateway gateway;
    private final TransactionTemplate tx;
    private final MissionFinancialSettlement settlement;
    public MissionFinancialWorker(JdbcTemplate db, StripeGateway gateway, PlatformTransactionManager manager, MissionFinancialSettlement settlement) {
        this.settlement=settlement;
        this.db=db; this.gateway=gateway; this.tx=new TransactionTemplate(manager);
    }

    @Scheduled(initialDelayString="${clenzy.marketplace.financial-check-ms:60000}", fixedDelayString="${clenzy.marketplace.financial-check-ms:60000}")
    @SchedulerLock(name = "baitly-mission-financial-worker", lockAtMostFor = "PT10M")
    public void run() {
        for (Long id : db.queryForList("SELECT quote_id FROM mission_financial_cases WHERE next_check_at<=now() ORDER BY next_check_at LIMIT 20", Long.class)) {
            if (db.update("UPDATE mission_financial_cases SET next_check_at=now()+interval '5 minutes' WHERE quote_id=? AND next_check_at<=now()", id)==0) continue;
            try { discover(id); refresh(id); settlement.settle(id); }
            catch (Exception failure) { db.update("UPDATE mission_financial_cases SET last_error=? WHERE quote_id=?", safe(failure), id); }
        }
        for (UUID id : db.queryForList("""
            SELECT id FROM mission_financial_decisions WHERE state IN ('APPROVED','PROCESSING','PENDING')
              AND next_attempt_at<=now() AND (lease_until IS NULL OR lease_until<now()) ORDER BY created_at LIMIT 20
            """, UUID.class)) process(id);
        for(UUID id:db.queryForList("SELECT id FROM mission_financial_decisions WHERE state IN ('SUCCEEDED','FAILED') AND notified_at IS NULL AND next_attempt_at<=now() LIMIT 20",UUID.class)) {
            try { settlement.notifyDecision(id); }
            catch(Exception failure) { db.update("UPDATE mission_financial_decisions SET notice_error=?,next_attempt_at=now()+interval '5 minutes' WHERE id=?",safe(failure),id); }
        }
    }

    void discover(Long quoteId) {
        // Sources persistées dans le PMS ; aucune référence de paiement fournie librement par le navigateur.
        db.update("""
            INSERT INTO mission_financial_payments(quote_id,provider,session_ref,shared)
            SELECT c.quote_id,p.provider_type,p.provider_tx_id,
              p.source_type LIKE 'DEFERRED_INTERVENTIONS%' OR coalesce(p.metadata->>'interventionIds','') LIKE '%,%'
            FROM service_quote_cancellations c LEFT JOIN interventions i ON i.id=c.intervention_id
            JOIN payment_transactions p ON p.organization_id=c.organization_id
            WHERE c.quote_id=? AND p.payment_type<>'REFUND' AND p.provider_tx_id IS NOT NULL AND (
              (p.source_type='INTERVENTION' AND (p.source_id=c.intervention_id OR cast(c.intervention_id AS text)=ANY(string_to_array(replace(p.metadata->>'interventionIds',' ',''),','))))
              OR (p.source_type IN ('DEFERRED_INTERVENTIONS_HOST','DEFERRED_INTERVENTIONS_PROPERTY') AND cast(c.intervention_id AS text)=ANY(string_to_array(replace(p.metadata->>'intervention_ids',' ',''),',')))
              OR (p.source_type='SERVICE_REQUEST' AND p.source_id=i.service_request_id))
            ON CONFLICT (quote_id,provider,session_ref) DO NOTHING
            """, quoteId);
        db.update("""
            INSERT INTO mission_financial_payments(quote_id,provider,session_ref,shared)
            SELECT c.quote_id,CASE WHEN s.ref LIKE 'cs_%' THEN 'STRIPE' ELSE 'EXTERNAL' END,s.ref,
              EXISTS(SELECT 1 FROM interventions other WHERE other.stripe_session_id=s.ref AND other.id<>i.id)
            FROM service_quote_cancellations c JOIN interventions i ON i.id=c.intervention_id
            LEFT JOIN service_requests r ON r.id=i.service_request_id
            CROSS JOIN LATERAL (VALUES (i.stripe_session_id),(r.stripe_session_id)) s(ref)
            WHERE c.quote_id=? AND s.ref IS NOT NULL AND trim(s.ref)<>''
              AND NOT EXISTS(SELECT 1 FROM mission_financial_payments p WHERE p.quote_id=c.quote_id AND p.session_ref=s.ref)
            ON CONFLICT DO NOTHING
            """, quoteId);
    }

    void refresh(Long quoteId) throws Exception {
        for (var payment : db.queryForList("SELECT * FROM mission_financial_payments WHERE quote_id=?", quoteId)) {
            if (!"STRIPE".equals(payment.get("provider"))) continue; // Rapprochement externe explicite.
            String ref=(String)payment.get("session_ref");
            var session=gateway.retrieveSession(ref);
            if ("open".equals(session.getStatus())) session=gateway.expireSession(session,"baitly-close-"+ref);
            long collected=0, refunded=0;
            String intent=session.getPaymentIntent();
            if (intent!=null) {
                var pi=gateway.retrievePaymentIntent(intent);
                collected=pi.getAmountReceived()==null ? 0 : pi.getAmountReceived();
                if (pi.getLatestCharge()!=null) {
                    var charge=gateway.retrieveCharge(pi.getLatestCharge());
                    refunded=charge.getAmountRefunded()==null ? 0 : charge.getAmountRefunded();
                }
            }
            final long paid=collected, returned=refunded;
            final String currency=session.getCurrency();
            final boolean shared=Boolean.TRUE.equals(payment.get("shared")) || (session.getMetadata()!=null
                    && (session.getMetadata().containsKey("intervention_ids") || session.getMetadata().containsKey("interventionIds")));
            tx.executeWithoutResult(status -> {
                var dossier=db.queryForMap("SELECT * FROM mission_financial_cases WHERE quote_id=? FOR UPDATE",quoteId);
                db.update("UPDATE mission_financial_payments SET payment_intent=?,currency=?,collected=?,refunded=?,shared=?,state='VERIFIED',checked_at=now() WHERE id=?",
                        intent,currency,paid,returned,shared,payment.get("id"));
                if (paid>number(payment,"collected")) {
                    if ("CLOSED".equals(dossier.get("state"))) db.update("UPDATE mission_financial_cases SET state='OPEN' WHERE quote_id=?",quoteId);
                    db.update("INSERT INTO mission_financial_events(quote_id,actor,action,detail) VALUES (?,'system','COLLECTION','Encaissement confirmé ; décision financière requise')",quoteId);
                }
                db.update("UPDATE mission_financial_cases SET version=version+1,last_error=NULL,updated_at=now() WHERE quote_id=?",quoteId);
            });
        }
    }

    void process(UUID id) {
        Map<String,Object> job=tx.execute(status -> {
            var list=db.queryForList("SELECT quote_id FROM mission_financial_decisions WHERE id=?",id);
            if(list.isEmpty()) return null;
            Long quoteId=((Number)list.getFirst().get("quote_id")).longValue();
            var dossier=db.queryForMap("SELECT * FROM mission_financial_cases WHERE quote_id=? FOR UPDATE",quoteId);
            var decision=db.queryForMap("SELECT * FROM mission_financial_decisions WHERE id=? FOR UPDATE",id);
            if (!"OPEN".equals(dossier.get("state")) && "APPROVED".equals(decision.get("state"))) return null;
            if(db.update("""
                UPDATE mission_financial_decisions SET state=CASE WHEN state='APPROVED' THEN 'PROCESSING' ELSE state END,
                started_at=coalesce(started_at,now()),lease_until=now()+interval '5 minutes' WHERE id=? AND state IN ('APPROVED','PROCESSING','PENDING')
                AND (lease_until IS NULL OR lease_until<now())
                """,id)==0) return null;
            return db.queryForMap("SELECT d.*,p.provider,p.payment_intent,p.currency,p.collected,p.refunded FROM mission_financial_decisions d JOIN mission_financial_payments p ON p.id=d.payment_id WHERE d.id=?",id);
        });
        if(job==null) return;
        try {
            if(!"STRIPE".equals(job.get("provider"))) { result(job,"REVIEW",null,"Remboursement externe à rapprocher avec justificatif"); return; }
            Refund refund;
            if(job.get("refund_ref")!=null) refund=gateway.retrieveRefund((String)job.get("refund_ref"));
            else if ((refund=gateway.findFinancialRefund((String)job.get("payment_intent"),id.toString()))==null) {
                // Après une réponse réseau incertaine, ne jamais émettre une nouvelle clé.
                var startedAt=(java.sql.Timestamp)job.get("started_at");
                if(startedAt.toInstant().isBefore(java.time.Instant.now().minusSeconds(23*3600))) {
                    result(job,"REVIEW",null,"Réponse PSP incertaine : rapprocher le remboursement avant une nouvelle décision"); return;
                }
                refund=gateway.createRefund(RefundCreateParams.builder().setPaymentIntent((String)job.get("payment_intent"))
                        .setAmount(number(job,"amount")).putMetadata("baitly_financial_decision",id.toString()).build(),"baitly-financial-"+id);
            }
            if(refund==null || refund.getId()==null) throw new IllegalStateException("Réponse de remboursement absente");
            if(refund.getAmount()==null || refund.getAmount()!=number(job,"amount")
                    || !Objects.equals(refund.getPaymentIntent(),job.get("payment_intent"))
                    || refund.getCurrency()==null || !refund.getCurrency().equalsIgnoreCase((String)job.get("currency"))
                    || refund.getMetadata()==null || !id.toString().equals(refund.getMetadata().get("baitly_financial_decision"))) {
                result(job,"REVIEW",refund.getId(),"Le montant confirmé diffère de la décision ; rapprochement requis"); return;
            }
            String state=switch(String.valueOf(refund.getStatus())) { case "succeeded" -> "SUCCEEDED"; case "failed","canceled" -> "FAILED"; default -> "PENDING"; };
            result(job,state,refund.getId(),"FAILED".equals(state) ? "Remboursement refusé par le prestataire de paiement" : null);
        } catch(Exception failure) {
            db.update("UPDATE mission_financial_decisions SET error=?,lease_until=NULL,next_attempt_at=now()+interval '5 minutes' WHERE id=?",safe(failure),id);
        }
    }

    private void result(Map<String,Object> job,String state,String ref,String error) {
        tx.executeWithoutResult(status -> {
            Long quoteId=number(job,"quote_id");
            db.queryForMap("SELECT quote_id FROM mission_financial_cases WHERE quote_id=? FOR UPDATE",quoteId);
            db.update("UPDATE mission_financial_decisions SET state=?,refund_ref=coalesce(?,refund_ref),error=?,lease_until=NULL,next_attempt_at=now()+interval '5 minutes' WHERE id=?",state,ref,error,job.get("id"));
            if(ref!=null && Set.of("SUCCEEDED","FAILED","PENDING").contains(state)) {
                String currency=String.valueOf(job.get("currency")).toUpperCase(Locale.ROOT);
                int exponent=MissionFinancialService.minorDigits(currency);
                var amount=java.math.BigDecimal.valueOf(number(job,"amount"),exponent);
                String paymentState="SUCCEEDED".equals(state) ? "COMPLETED" : "FAILED".equals(state) ? "FAILED" : "PROCESSING";
                db.update("""
                    INSERT INTO payment_transactions(organization_id,transaction_ref,provider_type,provider_tx_id,payment_type,status,amount,currency,
                      idempotency_key,source_type,source_id,metadata,created_at,updated_at)
                    SELECT organization_id,?,'STRIPE',?,'REFUND',?,?,?,?,'INTERVENTION',intervention_id,
                      jsonb_build_object('financialQuoteId',quote_id,'financialDecisionId',CAST(? AS text)),now(),now()
                    FROM service_quote_cancellations WHERE quote_id=?
                    ON CONFLICT(idempotency_key) DO UPDATE SET status=excluded.status,provider_tx_id=excluded.provider_tx_id,updated_at=now()
                    WHERE payment_transactions.status<>'COMPLETED'
                    ""","RF-"+job.get("id"),ref,paymentState,amount,currency,"baitly-financial-"+job.get("id"),job.get("id").toString(),quoteId);
            }
            if("SUCCEEDED".equals(state)) db.update("UPDATE mission_financial_cases SET accounting_state='REVIEW' WHERE quote_id=?",quoteId);
            if(!state.equals(job.get("state"))) db.update("INSERT INTO mission_financial_events(quote_id,actor,action,detail) VALUES (?,'system',?,?)",quoteId,state,
                    "Décision "+job.get("id")+" : "+state);
            db.update("UPDATE mission_financial_cases SET version=version+1,next_check_at=now(),updated_at=now() WHERE quote_id=?",quoteId);
        });
    }
    private String safe(Exception ex) { return "Rapprochement à reprendre : "+ex.getClass().getSimpleName(); }
}
