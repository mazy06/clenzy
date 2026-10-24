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
                """,token,now,work.execution(),work.org(),now,now,work.org());
            if(count==0) {
                db.update("""
                    UPDATE automation_executions SET durable_state='REVIEW',status='FAILED',
                        error_message='AUTOMATION_SCOPE_REVIEW',durable_context=NULL
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
        boolean deferred=result!=null && result.rescheduledAt()!=null && allowDeferral
            && !result.skipped() && result.refId()==null && result.rescheduledAt().isAfter(now);
        String state=result==null || (result.rescheduledAt()!=null&&!deferred)?"UNKNOWN":deferred?"PENDING":"DONE";
        String status=state.equals("UNKNOWN")?"FAILED":deferred?"PENDING":result.skipped()?"SKIPPED":"EXECUTED";
        String code=state.equals("UNKNOWN")?"AUTOMATION_ATTEMPT_UNCERTAIN":deferred?"AUTOMATION_DEFERRED":result.skipped()?"AUTOMATION_SKIPPED":null;
        return Boolean.TRUE.equals(tx.execute(s -> db.update("""
            UPDATE automation_executions SET durable_state=?,status=?,error_message=?,
                scheduled_at=COALESCE(?,scheduled_at),durable_expires_at=COALESCE(?,durable_expires_at),executed_at=?,
                durable_context=CASE WHEN ?='PENDING' THEN durable_context ELSE NULL END
            WHERE id=? AND organization_id=? AND durable_state='STARTED' AND attempt_token=?
            """,state,status,code,deferred?result.rescheduledAt():null,deferred?result.rescheduledAt().plusDays(1):null,
                status.equals("EXECUTED")?now:null,state,ticket.work().execution(),ticket.work().org(),ticket.token())==1));
    }
}
