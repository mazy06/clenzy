package com.clenzy.service;

import com.clenzy.model.ServiceQuote;
import jakarta.persistence.EntityManager;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

/** Dossier financier Baitly : les décisions ne changent jamais l'état opérationnel. */
@Service
@Transactional
public class MissionFinancialService {
    private final JdbcTemplate db;
    private final ServiceQuoteAmendmentService access;
    private final ServiceQuoteAmendmentDiscussion discussion;
    private final EntityManager em;
    public MissionFinancialService(JdbcTemplate db, ServiceQuoteAmendmentService access,
            ServiceQuoteAmendmentDiscussion discussion, EntityManager em) {
        this.db = db; this.access = access; this.discussion = discussion; this.em = em;
    }
    public record View(boolean canManage, Map<String,Object> dossier, List<Map<String,Object>> payments,
                       List<Map<String,Object>> decisions, List<Map<String,Object>> events) {}
    public record ExternalEvidence(String currency, Long collected, Long refunded) {}

    /** Même transaction que l'annulation ; aucun appel PSP ici. */
    public void open(Long quoteId, Long orgId, String reason, String actor) {
        if (db.update("INSERT INTO mission_financial_cases(quote_id, organization_id, reason) VALUES (?,?,?) ON CONFLICT DO NOTHING",
                quoteId, orgId, reason) == 1) event(quoteId, actor, "OPENED", reason);
    }

    @Transactional(readOnly = true)
    public View view(Long quoteId, Long orgId, Jwt jwt) {
        if (!access.access(quoteId, orgId, jwt).canDecide()) return new View(false, null, List.of(), List.of(), List.of());
        var rows = db.queryForList("SELECT f.*,c.agreed_amount,c.currency FROM mission_financial_cases f JOIN service_quote_cancellations c USING(quote_id) WHERE f.quote_id=? AND f.organization_id=?", quoteId, orgId);
        if (rows.isEmpty()) return new View(true, null, List.of(), List.of(), List.of());
        return new View(true, rows.getFirst(), db.queryForList("SELECT * FROM mission_financial_payments WHERE quote_id=? ORDER BY id", quoteId),
                db.queryForList("SELECT * FROM mission_financial_decisions WHERE quote_id=? ORDER BY created_at DESC", quoteId),
                db.queryForList("SELECT * FROM mission_financial_events WHERE quote_id=? ORDER BY id DESC LIMIT 100", quoteId));
    }

    public void command(Long quoteId, Long orgId, Jwt jwt, long version, String action, Long paymentId,
                        Long amount, UUID decisionId, String reason, String evidence) {
        command(quoteId,orgId,jwt,version,action,paymentId,amount,decisionId,reason,evidence,null);
    }
    public void command(Long quoteId, Long orgId, Jwt jwt, long version, String action, Long paymentId,
                        Long amount, UUID decisionId, String reason, String evidence, java.math.BigDecimal amountDue) {
        command(quoteId,orgId,jwt,version,action,paymentId,amount,decisionId,reason,evidence,amountDue,null);
    }
    public void command(Long quoteId, Long orgId, Jwt jwt, long version, String action, Long paymentId,
                        Long amount, UUID decisionId, String reason, String evidence, java.math.BigDecimal amountDue, Long allocated) {
        command(quoteId,orgId,jwt,version,action,paymentId,amount,decisionId,reason,evidence,amountDue,allocated,null);
    }
    public void command(Long quoteId, Long orgId, Jwt jwt, long version, String action, Long paymentId,
                        Long amount, UUID decisionId, String reason, String evidence, java.math.BigDecimal amountDue, Long allocated,
                        ExternalEvidence external) {
        if (!access.access(quoteId, orgId, jwt).canDecide()) throw new AccessDeniedException("Décision financière réservée au gestionnaire");
        var dossier = db.queryForMap("SELECT * FROM mission_financial_cases WHERE quote_id=? AND organization_id=? FOR UPDATE", quoteId, orgId);
        if (!access.access(quoteId, orgId, jwt).canDecide()) throw new AccessDeniedException("Les droits financiers ont changé");
        if (number(dossier, "version") != version) throw new IllegalStateException("Le dossier a changé ; actualisez avant de décider");
        String normalized = text(reason);
        String state = (String)dossier.get("state");
        switch (action) {
            case "VERIFY_EXTERNAL" -> {
                var payment=db.queryForMap("SELECT * FROM mission_financial_payments WHERE id=? AND quote_id=? FOR UPDATE",paymentId,quoteId);
                requireExternalProvider(payment);
                String receipt=text(evidence);
                if(external==null || external.currency()==null || external.collected()==null || external.refunded()==null
                        || external.collected()<number(payment,"collected") || external.refunded()<number(payment,"refunded")
                        || external.refunded()<0 || external.collected()<external.refunded()) throw new IllegalArgumentException("Montants de rapprochement incohérents");
                String currency=java.util.Currency.getInstance(external.currency().toUpperCase(Locale.ROOT)).getCurrencyCode();
                if(payment.get("currency")!=null && !currency.equalsIgnoreCase((String)payment.get("currency"))) throw new IllegalArgumentException("La devise du paiement ne peut pas changer");
                db.update("UPDATE mission_financial_payments SET collected=?,refunded=?,currency=?,state='VERIFIED',checked_at=now() WHERE id=?",
                        external.collected(),external.refunded(),currency,paymentId);
                db.update("UPDATE mission_financial_cases SET accounting_state='REVIEW',state=CASE WHEN state='CLOSED' THEN 'OPEN' ELSE state END WHERE quote_id=?",quoteId);
                event(quoteId,jwt.getSubject(),"EXTERNAL_EVIDENCE",currency+" encaissé="+external.collected()+" remboursé="+external.refunded()+" (unités mineures) ; "+receipt);
            }
            case "CONFIRM_EXTERNAL" -> {
                var decision=db.queryForMap("SELECT d.*,p.provider,p.currency FROM mission_financial_decisions d JOIN mission_financial_payments p ON p.id=d.payment_id WHERE d.id=? AND d.quote_id=? FOR UPDATE OF d",decisionId,quoteId);
                requireExternalProvider(decision);
                if(!"REVIEW".equals(decision.get("state")) || decision.get("approved_by")==null) throw new IllegalStateException("Une proposition approuvée et transmise est requise");
                String receipt=text(evidence);
                var refundedAmount=java.math.BigDecimal.valueOf(number(decision,"amount"),minorDigits((String)decision.get("currency")));
                db.update("""
                    INSERT INTO payment_transactions(organization_id,transaction_ref,provider_type,provider_tx_id,payment_type,status,amount,currency,
                      idempotency_key,source_type,source_id,metadata,created_at,updated_at)
                    SELECT organization_id,?, ?,NULL,'REFUND','COMPLETED',?,?,?,'INTERVENTION',intervention_id,
                      jsonb_build_object('financialQuoteId',quote_id,'financialDecisionId',CAST(? AS text)),now(),now()
                    FROM service_quote_cancellations WHERE quote_id=?
                    """, "RF-"+decisionId,decision.get("provider"),refundedAmount,((String)decision.get("currency")).toUpperCase(Locale.ROOT),"baitly-financial-"+decisionId,decisionId.toString(),quoteId);
                db.update("UPDATE mission_financial_decisions SET state='SUCCEEDED',error=NULL,next_attempt_at=now() WHERE id=?",decisionId);
                // Le total PSP reste un relevé rapproché, jamais incrémenté artificiellement par une décision.
                db.update("UPDATE mission_financial_cases SET accounting_state='REVIEW',next_check_at=now() WHERE quote_id=?",quoteId);
                event(quoteId,jwt.getSubject(),"EXTERNAL_REFUND_CONFIRMED",decisionId+" ; "+receipt);
            }
            case "ASSESS" -> {
                if(!"OPEN".equals(state)) throw new IllegalStateException("Rouvrez le dossier avant d'évaluer le montant dû");
                var agreed=db.queryForObject("SELECT agreed_amount FROM service_quote_cancellations WHERE quote_id=?",java.math.BigDecimal.class,quoteId);
                if(amountDue==null || amountDue.signum()<0 || amountDue.scale()>2 || amountDue.compareTo(agreed)>0)
                    throw new IllegalArgumentException("Le montant dû doit être compris entre zéro et le montant convenu");
                if(db.queryForObject("SELECT count(*) FROM mission_financial_decisions WHERE quote_id=? AND state IN ('PROPOSED','APPROVED','PROCESSING','PENDING','REVIEW')",Long.class,quoteId)>0)
                    throw new IllegalStateException("Traitez les décisions en cours avant de réviser le montant dû");
                db.update("UPDATE mission_financial_cases SET amount_due=?,assessment_reason=? WHERE quote_id=?",amountDue,normalized,quoteId);
            }
            case "PROPOSE" -> {
                if (!"OPEN".equals(state)) throw new IllegalStateException("Rouvrez le dossier ou résolvez le litige avant de proposer un remboursement");
                if(dossier.get("amount_due")==null) throw new IllegalStateException("Évaluez d'abord le montant dû et les frais convenus");
                var payment = db.queryForMap("SELECT * FROM mission_financial_payments WHERE id=? AND quote_id=? FOR UPDATE", paymentId, quoteId);
                if (amount == null || amount <= 0 || amount > number(payment,"collected") - number(payment,"refunded")
                        || !"VERIFIED".equals(payment.get("state"))) throw new IllegalArgumentException("Montant supérieur au solde vérifié ou paiement non rapproché");
                String allocation = Boolean.TRUE.equals(payment.get("shared")) ? text(evidence) : null;
                if(Boolean.TRUE.equals(payment.get("shared"))) {
                    db.execute("SELECT pg_advisory_xact_lock("+((String)payment.get("session_ref")).hashCode()+")");
                    Long others=db.queryForObject("SELECT coalesce(sum(allocation),0) FROM mission_financial_payments WHERE provider=? AND session_ref=? AND id<>?",Long.class,payment.get("provider"),payment.get("session_ref"),paymentId);
                    if(allocated==null || allocated<amount || allocated>number(payment,"collected")-others)
                        throw new IllegalArgumentException("Part encaissée de cette mission requise ; les parts du lot ne peuvent pas dépasser son encaissement");
                    db.update("UPDATE mission_financial_payments SET allocation=? WHERE id=?",allocated,paymentId);
                }
                var currency=db.queryForObject("SELECT currency FROM service_quote_cancellations WHERE quote_id=?",String.class,quoteId);
                if(!currency.equalsIgnoreCase(String.valueOf(payment.get("currency")))) allocation=text(evidence);
                long available=db.queryForObject("""
                    SELECT greatest(0,coalesce(allocation,collected)-greatest(CASE WHEN shared THEN 0 ELSE refunded END,
                      coalesce((SELECT sum(amount) FROM mission_financial_decisions d WHERE d.payment_id=p.id AND d.state='SUCCEEDED'),0)))
                    FROM mission_financial_payments p WHERE p.id=?
                    """,Long.class,paymentId);
                if(amount>available) throw new IllegalArgumentException("La part de cette mission a déjà été remboursée");
                if(currency.equalsIgnoreCase(String.valueOf(payment.get("currency")))) {
                    long balance=db.queryForObject("""
                        SELECT coalesce(sum(greatest(0,CASE WHEN shared THEN coalesce(allocation,0) ELSE collected END
                          - greatest(CASE WHEN shared THEN 0 ELSE refunded END,coalesce((SELECT sum(amount) FROM mission_financial_decisions d
                            WHERE d.payment_id=p.id AND d.state='SUCCEEDED'),0))
                          - coalesce((SELECT sum(amount) FROM mission_financial_decisions d WHERE d.payment_id=p.id
                            AND d.state IN ('PROPOSED','APPROVED','PROCESSING','PENDING','REVIEW')),0))),0)
                        FROM mission_financial_payments p WHERE quote_id=? AND upper(currency)=upper(?) AND state='VERIFIED'
                        """,Long.class,quoteId,currency);
                    long due=((java.math.BigDecimal)dossier.get("amount_due")).movePointRight(minorDigits(currency)).longValueExact();
                    if(amount>Math.max(0,balance-due)) throw new IllegalArgumentException("Le remboursement dépasserait le solde après montant dû et décisions en cours");
                }
                db.update("""
                    INSERT INTO mission_financial_decisions(id,quote_id,payment_id,amount,reason,allocation_evidence,state,proposed_by)
                    VALUES (?,?,?,?,?,?,'PROPOSED',?)
                    """, UUID.randomUUID(), quoteId, paymentId, amount, normalized, allocation, jwt.getSubject());
            }
            case "APPROVE" -> {
                if (!"OPEN".equals(state)) throw new IllegalStateException("Le dossier n'autorise pas de remboursement");
                if (db.update("UPDATE mission_financial_decisions SET state='APPROVED', approved_by=?, approved_at=now() WHERE id=? AND quote_id=? AND state='PROPOSED'",
                        jwt.getSubject(), decisionId, quoteId) != 1) throw new IllegalStateException("Proposition non disponible");
                discussion.financial(em.find(ServiceQuote.class, quoteId), jwt.getSubject(), "Remboursement approuvé", normalized);
            }
            case "WITHDRAW" -> {
                if (db.update("UPDATE mission_financial_decisions SET state='WITHDRAWN' WHERE id=? AND quote_id=? AND state IN ('PROPOSED','APPROVED')",
                        decisionId, quoteId) != 1) throw new IllegalStateException("Le remboursement est déjà en cours ou terminé");
            }
            case "RETRY_REVIEW" -> {
                if(!"OPEN".equals(state)) throw new IllegalStateException("Rouvrez le dossier avant de reprendre le remboursement");
                if(db.update("UPDATE mission_financial_decisions SET state='APPROVED',started_at=NULL,approved_by=?,approved_at=now(),next_attempt_at=now(),error=NULL WHERE id=? AND quote_id=? AND state='REVIEW' AND refund_ref IS NULL",
                        jwt.getSubject(),decisionId,quoteId)!=1) throw new IllegalStateException("Rapprochez d'abord la référence de remboursement existante");
            }
            case "RECONCILE" -> {
                if(evidence==null || !evidence.matches("re_[A-Za-z0-9]+")) throw new IllegalArgumentException("Référence de remboursement Stripe requise");
                if(db.update("UPDATE mission_financial_decisions SET state='PENDING',refund_ref=?,next_attempt_at=now(),error=NULL WHERE id=? AND quote_id=? AND state='REVIEW'",evidence,decisionId,quoteId)!=1)
                    throw new IllegalStateException("Décision non disponible pour rapprochement");
            }
            case "ACCOUNTED" -> {
                db.update("UPDATE mission_financial_cases SET accounting_state='DONE' WHERE quote_id=?",quoteId);
            }
            case "DISPUTE", "REOPEN", "CLOSE" -> {
                long active = db.queryForObject("SELECT count(*) FROM mission_financial_decisions WHERE quote_id=? AND state IN ('PROCESSING','PENDING')", Long.class, quoteId);
                if (active > 0 && !"REOPEN".equals(action)) throw new IllegalStateException("Un remboursement est déjà transmis ; attendre son résultat avant de clôturer ou ouvrir un litige");
                if ("CLOSE".equals(action)) {
                    if("REVIEW".equals(dossier.get("accounting_state"))) throw new IllegalStateException("Confirmez le rapprochement comptable avant clôture");
                    long unresolved = db.queryForObject("SELECT count(*) FROM mission_financial_decisions WHERE quote_id=? AND state IN ('PROPOSED','APPROVED','REVIEW')", Long.class, quoteId);
                    if (unresolved > 0) throw new IllegalStateException("Traitez ou retirez les propositions avant clôture");
                }
                String next = "DISPUTE".equals(action) ? "DISPUTED" : "CLOSE".equals(action) ? "CLOSED" : "OPEN";
                db.update("UPDATE mission_financial_cases SET state=? WHERE quote_id=?", next, quoteId);
                discussion.financial(em.find(ServiceQuote.class, quoteId), jwt.getSubject(), "Décision financière : " + next, normalized);
            }
            case "REFRESH" -> db.update("UPDATE mission_financial_cases SET next_check_at=now() WHERE quote_id=?", quoteId);
            default -> throw new IllegalArgumentException("Action financière inconnue");
        }
        event(quoteId, jwt.getSubject(), action, normalized);
        db.update("UPDATE mission_financial_cases SET version=version+1, updated_at=now() WHERE quote_id=?", quoteId);
    }

    void event(Long quoteId, String actor, String action, String detail) {
        db.update("INSERT INTO mission_financial_events(quote_id,actor,action,detail) VALUES (?,?,?,?)", quoteId, actor, action, detail);
    }
    static long number(Map<String,Object> row, String key) { return ((Number)row.get(key)).longValue(); }
    private static void requireExternalProvider(Map<String,Object> payment) {
        if(!Set.of("PAYTABS","CMI","PAYZONE","PAYPAL").contains(String.valueOf(payment.get("provider"))))
            throw new IllegalArgumentException("Le rapprochement manuel exige un prestataire de paiement identifié hors Stripe");
    }
    public static int minorDigits(String currency) {
        return Set.of("BIF","CLP","DJF","GNF","JPY","KMF","KRW","MGA","PYG","RWF","VND","VUV","XAF","XOF","XPF").contains(currency.toUpperCase(Locale.ROOT)) ? 0 : 2;
    }
    static String text(String value) {
        if (value == null || value.isBlank() || value.trim().length() > 1000) throw new IllegalArgumentException("Motif ou justificatif requis, limité à 1000 caractères");
        return value.trim();
    }
}
