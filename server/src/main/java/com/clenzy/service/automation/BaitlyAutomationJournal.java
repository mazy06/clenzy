package com.clenzy.service.automation;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.*;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.LocalDateTime;
import java.util.*;

/** Baitly durable fence: STARTED/UNKNOWN never expire back to PENDING. */
@Component
public class BaitlyAutomationJournal {
    private final JdbcTemplate db;
    private final TransactionTemplate tx;
    public record Work(long execution, long org) {}
    public record Ticket(Work work, UUID token) {}
    public BaitlyAutomationJournal(JdbcTemplate db, PlatformTransactionManager manager) {
        this.db=db;tx=new TransactionTemplate(manager);
        tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);tx.setTimeout(10);
    }
    public List<Work> due(LocalDateTime now) {
        return tx.execute(s -> db.query("""
            SELECT id,organization_id FROM automation_executions
            WHERE durable_state='PENDING' AND status='PENDING' AND scheduled_at<=?
            ORDER BY scheduled_at,id LIMIT 25
            """,(rs,n)->new Work(rs.getLong(1),rs.getLong(2)),now));
    }
    public Optional<Ticket> claim(Work work, LocalDateTime now) {
        return tx.execute(s -> {
            UUID token=UUID.randomUUID();
            int count=db.update("""
                UPDATE automation_executions SET durable_state='STARTED',attempt_token=?,attempted_at=?,
                    status='FAILED',error_message='AUTOMATION_ATTEMPT_UNCERTAIN'
                WHERE id=? AND organization_id=? AND durable_state='PENDING' AND status='PENDING'
                    AND scheduled_at<=? AND durable_expires_at>=? AND EXISTS (
                        SELECT 1 FROM automation_rules r WHERE r.id=automation_rule_id
                            AND r.organization_id=? AND r.enabled=true
                            AND r.updated_at IS NOT DISTINCT FROM rule_revision)
                    AND NOT EXISTS (SELECT 1 FROM baitly_automation_outcome_proofs p WHERE p.execution_id=automation_executions.id)
                """,token,now,work.execution(),work.org(),now,now,work.org());
            if(count==0) {
                db.update("""
                    UPDATE automation_executions SET
                        durable_state=CASE WHEN EXISTS (SELECT 1 FROM baitly_automation_outcome_proofs p WHERE p.execution_id=automation_executions.id)
                            THEN 'UNKNOWN' ELSE 'REVIEW' END,status='FAILED',
                        error_message=CASE WHEN EXISTS (SELECT 1 FROM baitly_automation_outcome_proofs p WHERE p.execution_id=automation_executions.id)
                            THEN 'AUTOMATION_ATTEMPT_UNCERTAIN' ELSE 'AUTOMATION_SCOPE_REVIEW' END,durable_context=NULL
                    WHERE id=? AND organization_id=? AND durable_state='PENDING' AND status='PENDING'
                        AND scheduled_at<=?
                    """,work.execution(),work.org(),now);
                return Optional.empty();
            }
            return Optional.of(new Ticket(work,token));
        });
    }
    public boolean finish(Ticket ticket, AutomationActionExecutor.ExecutionResult result, LocalDateTime now,
                          boolean allowDeferral) {
        if(result!=null && result.rescheduledAt()==null) {
            if(recordTerminalProof(ticket,result,now)) return applyProof(ticket,now,false);
            markUnknown(ticket,now);
            return false;
        }
        boolean deferred=result!=null && result.rescheduledAt()!=null && allowDeferral
            && !result.skipped() && result.refId()==null && result.rescheduledAt().isAfter(now);
        if(!deferred) return markUnknown(ticket,now);
        return Boolean.TRUE.equals(tx.execute(s -> {
            if(lockAttempt(ticket).isEmpty()) return false;
            if(hasProof(ticket.work())) {
                dispute(ticket);
                markUnknownInCurrentTransaction(ticket);
                return false;
            }
            return db.update("""
                UPDATE automation_executions SET durable_state='PENDING',status='PENDING',error_message='AUTOMATION_DEFERRED',
                    scheduled_at=?,durable_expires_at=?,executed_at=NULL
                WHERE id=? AND organization_id=? AND durable_state='STARTED' AND attempt_token=?
                """,result.rescheduledAt(),result.rescheduledAt().plusDays(1),ticket.work().execution(),ticket.work().org(),ticket.token())==1;
        }));
    }

    private record Attempt(long rule, String subjectType, long subject, LocalDateTime revision, LocalDateTime attempted) {}
    private record Proof(String outcome, Long reference, LocalDateTime observed, boolean disputed) {}
    private static final String PROOF_SCOPE = """
        p.execution_id=e.id AND p.attempt_token=e.attempt_token AND p.organization_id=e.organization_id
        AND p.automation_rule_id=e.automation_rule_id AND p.subject_type=e.subject_type AND p.subject_id=e.subject_id
        AND p.rule_revision IS NOT DISTINCT FROM e.rule_revision AND p.attempted_at=e.attempted_at
        """;

    private Optional<Attempt> lockAttempt(Ticket ticket) {
        return db.query("""
            SELECT automation_rule_id,subject_type,subject_id,rule_revision,attempted_at FROM automation_executions
            WHERE id=? AND organization_id=? AND attempt_token=? AND status='FAILED'
                AND durable_state IN ('STARTED','UNKNOWN') AND attempted_at IS NOT NULL
            FOR UPDATE
            """,(r,n)->new Attempt(r.getLong(1),r.getString(2),r.getLong(3),r.getObject(4,LocalDateTime.class),
                r.getObject(5,LocalDateTime.class)),ticket.work().execution(),ticket.work().org(),ticket.token()).stream().findFirst();
    }
    private Optional<Proof> proof(Ticket ticket) {
        return db.query("SELECT p.outcome,p.effect_ref_id,p.observed_at,p.disputed FROM baitly_automation_outcome_proofs p "
            +"JOIN automation_executions e ON "+PROOF_SCOPE+" WHERE e.id=? AND e.organization_id=? AND e.attempt_token=?",
            (r,n)->new Proof(r.getString(1),r.getObject(2,Long.class),r.getObject(3,LocalDateTime.class),r.getBoolean(4)),
            ticket.work().execution(),ticket.work().org(),ticket.token()).stream().findFirst();
    }
    private boolean hasProof(Work work) {
        return db.queryForObject("SELECT COUNT(*) FROM baitly_automation_outcome_proofs WHERE execution_id=?",Long.class,work.execution())>0;
    }
    private void dispute(Ticket ticket) {
        db.update("UPDATE baitly_automation_outcome_proofs SET disputed=true WHERE execution_id=? AND organization_id=? AND attempt_token=? AND applied_at IS NULL",
            ticket.work().execution(),ticket.work().org(),ticket.token());
    }

    /** Trusted executor return only, never a caller-supplied claim of provider delivery. No free text retained. */
    public boolean recordTerminalProof(Ticket ticket, AutomationActionExecutor.ExecutionResult result, LocalDateTime now) {
        if(result==null || result.rescheduledAt()!=null || (result.skipped() && result.refId()!=null)
            || (result.refId()!=null && result.refId()<=0)) return false;
        String outcome=result.skipped()?"SKIPPED":"EXECUTED";
        return Boolean.TRUE.equals(tx.execute(s -> {
            var attempt=lockAttempt(ticket).orElse(null);
            if(attempt==null || now.isBefore(attempt.attempted())) return false;
            var existing=proof(ticket).orElse(null);
            if(existing!=null) {
                boolean same=outcome.equals(existing.outcome()) && Objects.equals(result.refId(),existing.reference());
                if(!same) dispute(ticket);
                return same && !existing.disputed();
            }
            if(hasProof(ticket.work())) return false;
            return db.update("""
                INSERT INTO baitly_automation_outcome_proofs(execution_id,attempt_token,organization_id,automation_rule_id,
                    subject_type,subject_id,rule_revision,attempted_at,outcome,effect_ref_id,observed_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?)
                """,ticket.work().execution(),ticket.token(),ticket.work().org(),attempt.rule(),attempt.subjectType(),
                attempt.subject(),attempt.revision(),attempt.attempted(),outcome,result.refId(),now)==1;
        }));
    }

    /** Applies a scoped durable receipt. No executor, provider, replay or return to PENDING. */
    public boolean applyProof(Ticket ticket, LocalDateTime now, boolean recovery) {
        return Boolean.TRUE.equals(tx.execute(s -> {
            if(lockAttempt(ticket).isEmpty()) return false;
            var evidence=proof(ticket).orElse(null);
            if(evidence==null || evidence.disputed() || evidence.observed().isAfter(now.plusSeconds(60))) return false;
            if(!Set.of("EXECUTED","SKIPPED").contains(evidence.outcome())) return false;
            int changed=db.update("""
                UPDATE automation_executions SET durable_state='DONE',status=?,error_message=?,executed_at=?,durable_context=NULL
                WHERE id=? AND organization_id=? AND attempt_token=? AND durable_state IN ('STARTED','UNKNOWN') AND status='FAILED'
                """,evidence.outcome(),evidence.outcome().equals("SKIPPED")?"AUTOMATION_SKIPPED":null,
                evidence.outcome().equals("EXECUTED")?evidence.observed():null,
                ticket.work().execution(),ticket.work().org(),ticket.token());
            if(changed!=1) return false;
            if(db.update("""
                UPDATE baitly_automation_outcome_proofs SET applied_at=?,apply_mode=?
                WHERE execution_id=? AND organization_id=? AND attempt_token=? AND applied_at IS NULL AND disputed=false
                """,now,recovery?"RECOVERY":"NORMAL",ticket.work().execution(),ticket.work().org(),ticket.token())!=1)
                throw new IllegalStateException("AUTOMATION_PROOF_APPLY_UNCONFIRMED");
            return true;
        }));
    }

    public List<Ticket> recoveryCandidates(LocalDateTime now) {
        return tx.execute(s -> db.query("""
            SELECT e.id,e.organization_id,e.attempt_token FROM baitly_automation_outcome_proofs p
            JOIN automation_executions e ON
            """+PROOF_SCOPE+"""
            WHERE p.applied_at IS NULL AND p.disputed=false AND p.observed_at<=?
                AND e.durable_state IN ('STARTED','UNKNOWN') AND e.status='FAILED'
            ORDER BY p.observed_at,e.id LIMIT 25
            """,(r,n)->new Ticket(new Work(r.getLong(1),r.getLong(2)),r.getObject(3,UUID.class)),now.plusSeconds(60)));
    }
    private boolean markUnknown(Ticket ticket, LocalDateTime now) {
        return Boolean.TRUE.equals(tx.execute(s -> markUnknownInCurrentTransaction(ticket)));
    }
    private boolean markUnknownInCurrentTransaction(Ticket ticket) {
        return db.update("""
            UPDATE automation_executions SET durable_state='UNKNOWN',status='FAILED',
                error_message='AUTOMATION_ATTEMPT_UNCERTAIN',durable_context=NULL
            WHERE id=? AND organization_id=? AND attempt_token=? AND durable_state='STARTED'
            """,ticket.work().execution(),ticket.work().org(),ticket.token())==1;
    }
}
