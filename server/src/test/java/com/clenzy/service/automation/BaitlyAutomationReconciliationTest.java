package com.clenzy.service.automation;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.service.TokenEncryptionService;
import com.clenzy.service.messaging.*;
import com.clenzy.tenant.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

/** Real migration/SQL locally and on isolated PostgreSQL CI, no real provider or person. */
class BaitlyAutomationReconciliationTest extends BaitlyAutomationFixture {
    void reconcile() {new BaitlyAutomationReconciler(journal,clock,new SimpleMeterRegistry()).reconcile();}
    long proofs() {return db.queryForObject("SELECT COUNT(*) FROM baitly_automation_outcome_proofs",Long.class);}
    BaitlyAutomationJournal.Ticket claim() {queue();return journal.claim(work,now).orElseThrow();}

    @Test void committedReceiptSurvivesLostFinalCommitAndRestartWithoutCallingExecutorAgain() {
        queue();var failing=spy(journal);
        doAnswer(call->{
            assertThat(observer.queryForObject("SELECT COUNT(*) FROM baitly_automation_outcome_proofs",Long.class)).isEqualTo(1);
            throw new IllegalStateException("synthetic-private SQL token");
        }).when(failing).applyProof(any(),any(),eq(false));
        worker(failing).processScheduledExecutions();
        assertThat(state()).isEqualTo("STARTED");assertThat(proofs()).isEqualTo(1);
        var counters=new SimpleMeterRegistry();
        var restarted=new BaitlyAutomationReconciler(new BaitlyAutomationJournal(db,manager),clock,counters);
        restarted.reconcile();restarted.reconcile();worker(journal).processScheduledExecutions();
        assertThat(state()).isEqualTo("DONE");assertThat(status()).isEqualTo("EXECUTED");
        assertThat(counters.get("baitly.automation.reconciled").counter().count()).isEqualTo(1);
        assertThat(db.queryForObject("SELECT apply_mode FROM baitly_automation_outcome_proofs",String.class)).isEqualTo("RECOVERY");
        verify(executor,times(1)).execute(any(),any());
    }
    @Test void uncertainWithoutReceiptAndHistoricalFailuresRemainBlockedIndefinitely() {
        var t=claim();journal.finish(t,null,now,false);
        new BaitlyAutomationReconciler(journal,Clock.offset(clock,Duration.ofDays(90)),new SimpleMeterRegistry()).reconcile();
        assertThat(state()).isEqualTo("UNKNOWN");assertThat(proofs()).isZero();
        assertThat(db.queryForObject("SELECT status FROM automation_executions WHERE id=10",String.class)).isEqualTo("FAILED");
        assertThat(journal.claim(work,now.plusDays(90))).isEmpty();verifyNoInteractions(executor);
    }
    @Test void normalCompletionRecordsMinimalProofAndCannotBeReconciledOrDowngradedAgain() {
        var t=claim();assertThat(journal.finish(t,AutomationActionExecutor.ExecutionResult.executed(42L),now,false)).isTrue();
        assertThat(journal.applyProof(t,now,true)).isFalse();
        assertThat(journal.finish(t,null,now,false)).isFalse();reconcile();
        assertThat(state()).isEqualTo("DONE");assertThat(proofs()).isEqualTo(1);
        assertThat(db.queryForObject("SELECT apply_mode FROM baitly_automation_outcome_proofs",String.class)).isEqualTo("NORMAL");
        assertThat(db.queryForList("SELECT * FROM baitly_automation_outcome_proofs").toString())
            .doesNotContain("synthetic-secret","private@example.invalid","Bearer","private reason");
        assertThat(db.queryForObject("SELECT durable_context FROM automation_executions WHERE id=11",String.class)).isNull();
        verifyNoInteractions(executor);
    }
    @Test void skippedProofDoesNotBecomeAnExecutedAction() {
        var t=claim();assertThat(journal.recordTerminalProof(t,AutomationActionExecutor.ExecutionResult.skipped("private@example.invalid"),now)).isTrue();
        journal.finish(t,null,now,false);reconcile();
        assertThat(state()).isEqualTo("DONE");assertThat(status()).isEqualTo("SKIPPED");
        assertThat(db.queryForObject("SELECT executed_at FROM automation_executions WHERE id=11",Object.class)).isNull();
        assertThat(db.queryForObject("SELECT error_message FROM automation_executions WHERE id=11",String.class)).isEqualTo("AUTOMATION_SKIPPED");
        assertThat(db.queryForList("SELECT * FROM baitly_automation_outcome_proofs").toString()).doesNotContain("private@example.invalid");
    }
    @Test void duplicateIdenticalProofDoesNotOverwriteItsOriginalObservationTime() {
        var t=claim();assertThat(journal.recordTerminalProof(t,AutomationActionExecutor.ExecutionResult.executed(42L),now)).isTrue();
        assertThat(journal.recordTerminalProof(t,AutomationActionExecutor.ExecutionResult.executed(42L),now.plusHours(1))).isTrue();
        assertThat(proofs()).isEqualTo(1);assertThat(journal.applyProof(t,now.plusHours(1),true)).isTrue();
        assertThat(db.queryForObject("SELECT executed_at FROM automation_executions WHERE id=11",LocalDateTime.class)).isEqualTo(now);
    }
    @ParameterizedTest @ValueSource(strings={"outcome","reference"})
    void contradictoryEvidenceStaysDisputedAndNeverRearms(String kind) {
        var t=claim();journal.recordTerminalProof(t,AutomationActionExecutor.ExecutionResult.executed(42L),now);
        var other=kind.equals("outcome")?AutomationActionExecutor.ExecutionResult.skipped("private"):AutomationActionExecutor.ExecutionResult.executed(43L);
        assertThat(journal.recordTerminalProof(t,other,now)).isFalse();
        assertThat(journal.recordTerminalProof(t,AutomationActionExecutor.ExecutionResult.executed(42L),now)).isFalse();
        journal.finish(t,null,now,false);reconcile();
        assertThat(state()).isEqualTo("UNKNOWN");assertThat(journal.applyProof(t,now,true)).isFalse();
        assertThat(db.queryForObject("SELECT effect_ref_id FROM baitly_automation_outcome_proofs",Long.class)).isEqualTo(42);
        assertThat(db.queryForObject("SELECT disputed FROM baitly_automation_outcome_proofs",Boolean.class)).isTrue();
    }
    @ParameterizedTest @ValueSource(strings={"org","rule","type","subject","revision","attempted","token"})
    void proofFromAnotherScopeOrAttemptCannotConclude(String kind) {
        var t=claim();journal.recordTerminalProof(t,AutomationActionExecutor.ExecutionResult.executed(),now);
        switch(kind) {
            case "org"->db.update("UPDATE baitly_automation_outcome_proofs SET organization_id=8");
            case "rule"->db.update("UPDATE baitly_automation_outcome_proofs SET automation_rule_id=2");
            case "type"->db.update("UPDATE baitly_automation_outcome_proofs SET subject_type='OWNER'");
            case "subject"->db.update("UPDATE baitly_automation_outcome_proofs SET subject_id=101");
            case "revision"->db.update("UPDATE baitly_automation_outcome_proofs SET rule_revision=?",now.plusSeconds(1));
            case "attempted"->db.update("UPDATE baitly_automation_outcome_proofs SET attempted_at=?",now.minusSeconds(1));
            case "token"->db.update("UPDATE baitly_automation_outcome_proofs SET attempt_token=?",UUID.randomUUID());
        }
        assertThat(journal.applyProof(t,now,true)).isFalse();reconcile();
        assertThat(state()).isEqualTo("STARTED");assertThat(status()).isEqualTo("FAILED");
        assertThat(journal.recoveryCandidates(now)).isEmpty();verifyNoInteractions(executor);
    }
    @Test void foreignOrganizationAndWrongTicketCannotApplyOrReplaceProof() {
        var t=claim();journal.recordTerminalProof(t,AutomationActionExecutor.ExecutionResult.executed(),now);
        for(var foreign:List.of(new BaitlyAutomationJournal.Ticket(new BaitlyAutomationJournal.Work(11,8),t.token()),
                new BaitlyAutomationJournal.Ticket(work,UUID.randomUUID()))) {
            assertThat(journal.applyProof(foreign,now,true)).isFalse();
            assertThat(journal.recordTerminalProof(foreign,AutomationActionExecutor.ExecutionResult.executed(),now)).isFalse();
        }
        assertThat(state()).isEqualTo("STARTED");assertThat(proofs()).isEqualTo(1);
    }
    @Test void preEffectDeferralHasNoReceiptAndStaleAttemptCannotCreateOne() {
        var first=claim();journal.finish(first,AutomationActionExecutor.ExecutionResult.rescheduled(now.plusHours(1),"private"),now,true);
        assertThat(proofs()).isZero();reconcile();assertThat(state()).isEqualTo("PENDING");
        var second=journal.claim(work,now.plusHours(1)).orElseThrow();
        assertThat(journal.recordTerminalProof(first,AutomationActionExecutor.ExecutionResult.executed(),now.plusHours(1))).isFalse();
        assertThat(journal.recordTerminalProof(second,AutomationActionExecutor.ExecutionResult.executed(),now.plusHours(1))).isTrue();
        assertThat(journal.applyProof(second,now.plusHours(1),true)).isTrue();
    }
    @Test void aTerminalReceiptForbidsEvenAnAuditedDeferral() {
        var t=claim();journal.recordTerminalProof(t,AutomationActionExecutor.ExecutionResult.executed(),now);
        assertThat(journal.finish(t,AutomationActionExecutor.ExecutionResult.rescheduled(now.plusHours(1),"private"),now,true)).isFalse();
        assertThat(state()).isEqualTo("UNKNOWN");reconcile();assertThat(state()).isEqualTo("UNKNOWN");
        assertThat(journal.claim(work,now.plusHours(1))).isEmpty();
    }
    @Test void applyingProofAndRecordingAuditAreAtomicOnSqlFailure() {
        var t=claim();journal.recordTerminalProof(t,AutomationActionExecutor.ExecutionResult.executed(),now);
        db.execute("ALTER TABLE baitly_automation_outcome_proofs ADD CONSTRAINT synthetic_reject_apply CHECK(applied_at IS NULL)");
        assertThatThrownBy(()->journal.applyProof(t,now,true)).isInstanceOf(org.springframework.dao.DataAccessException.class);
        assertThat(state()).isEqualTo("STARTED");
        db.execute("ALTER TABLE baitly_automation_outcome_proofs DROP CONSTRAINT synthetic_reject_apply");
        assertThat(journal.applyProof(t,now,true)).isTrue();
    }
    @Test void concurrentReconciliationConsumesOneReceiptOnce() throws Exception {
        var t=claim();journal.recordTerminalProof(t,AutomationActionExecutor.ExecutionResult.executed(),now);
        var pool=Executors.newFixedThreadPool(2);var start=new CountDownLatch(1);
        try {
            Callable<Boolean> apply=()->{start.await();return new BaitlyAutomationJournal(db,manager).applyProof(t,now,true);};
            var a=pool.submit(apply);var b=pool.submit(apply);start.countDown();
            assertThat(List.of(a.get(15,TimeUnit.SECONDS),b.get(15,TimeUnit.SECONDS))).containsExactlyInAnyOrder(true,false);
        } finally {pool.shutdownNow();}
        assertThat(state()).isEqualTo("DONE");verifyNoInteractions(executor);
    }
    @Test void missingReceiptTableNeverAllowsASecondEffect() {
        queue();when(executor.execute(any(),any())).thenAnswer(c->{
            db.execute("DROP TABLE baitly_automation_outcome_proofs");return AutomationActionExecutor.ExecutionResult.executed();
        });
        worker(journal).processScheduledExecutions();worker(journal).processScheduledExecutions();reconcile();
        verify(executor,times(1)).execute(any(),any());assertThat(state()).isEqualTo("STARTED");
    }
    @Test void mixedResultsAndDeferralsCannotCreateATerminalProof() {
        var t=claim();
        assertThat(journal.recordTerminalProof(t,new AutomationActionExecutor.ExecutionResult(true,"private",null,42L),now)).isFalse();
        assertThat(journal.recordTerminalProof(t,AutomationActionExecutor.ExecutionResult.executed(-1L),now)).isFalse();
        assertThat(journal.recordTerminalProof(t,AutomationActionExecutor.ExecutionResult.rescheduled(now.plusHours(1),"private"),now)).isFalse();
        assertThat(journal.recordTerminalProof(t,AutomationActionExecutor.ExecutionResult.executed(),now.minusSeconds(1))).isFalse();
        assertThat(proofs()).isZero();reconcile();assertThat(state()).isEqualTo("STARTED");
    }
    @Test void changingCurrentRuleAfterTheEffectDoesNotInvalidateHistoricalReceipt() {
        var t=claim();journal.recordTerminalProof(t,AutomationActionExecutor.ExecutionResult.executed(),now);
        db.update("UPDATE automation_rules SET enabled=false,updated_at=?",now.plusSeconds(1));
        reconcile();assertThat(state()).isEqualTo("DONE");verifyNoInteractions(executor);
    }
    @Test void futureReceiptIsNotAppliedAheadOfItsObservation() {
        var t=claim();journal.recordTerminalProof(t,AutomationActionExecutor.ExecutionResult.executed(),now.plusHours(1));
        reconcile();assertThat(state()).isEqualTo("STARTED");
        assertThat(journal.applyProof(t,now,true)).isFalse();
        assertThat(journal.applyProof(t,now.plusHours(1),true)).isTrue();
    }
    @Test void eachRecoveryPassIsBoundedAndDoesNotReplayTheBusinessFeed() {
        queue();
        for(int i=20;i<50;i++) db.update("""
            INSERT INTO automation_executions(id,organization_id,automation_rule_id,subject_type,subject_id,status,
                scheduled_at,durable_state,durable_key,rule_revision,durable_expires_at)
            VALUES (?,7,1,'RESERVATION',?,'PENDING',?,'PENDING',?,?,?)
            """,i,i,now.minusMinutes(1),"synthetic-"+i,now,now.plusDays(1));
        for(var w:db.query("SELECT id,organization_id FROM automation_executions WHERE durable_state='PENDING'",
                (r,n)->new BaitlyAutomationJournal.Work(r.getLong(1),r.getLong(2)))) {
            var t=journal.claim(w,now).orElseThrow();journal.recordTerminalProof(t,AutomationActionExecutor.ExecutionResult.executed(),now);
        }
        assertThat(journal.recoveryCandidates(now)).hasSize(25);reconcile();
        assertThat(db.queryForObject("SELECT COUNT(*) FROM automation_executions WHERE durable_state='DONE'",Long.class)).isEqualTo(25);
        reconcile();assertThat(journal.recoveryCandidates(now)).isEmpty();
        assertThat(db.queryForObject("SELECT COUNT(*) FROM automation_executions WHERE durable_state='DONE'",Long.class)).isEqualTo(31);
        verifyNoInteractions(executor);
    }
    @Test void receiptPreventsDeletingTheExecutionAndItsFence() {
        var t=claim();journal.recordTerminalProof(t,AutomationActionExecutor.ExecutionResult.executed(),now);
        assertThatThrownBy(()->db.update("DELETE FROM automation_executions WHERE id=11"))
            .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        assertThat(state()).isEqualTo("STARTED");assertThat(proofs()).isEqualTo(1);
    }
    @Test void aStalePendingSnapshotCannotReplayAnExecutionThatAlreadyHasProof() {
        var t=claim();journal.recordTerminalProof(t,AutomationActionExecutor.ExecutionResult.executed(),now);
        db.update("UPDATE automation_executions SET durable_state='PENDING',status='PENDING' WHERE id=11");
        worker(journal).processScheduledExecutions();worker(journal).processScheduledExecutions();reconcile();
        verifyNoInteractions(executor);
        assertThat(state()).isEqualTo("REVIEW");assertThat(proofs()).isEqualTo(1);
    }
    @Test void failuresProduceOnlyFixedDiagnosticAndUnlabelledCounters() {
        var logger=(ch.qos.logback.classic.Logger)org.slf4j.LoggerFactory.getLogger(BaitlyAutomationReconciler.class);
        var appender=new ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent>();appender.start();logger.addAppender(appender);
        var broken=mock(BaitlyAutomationJournal.class);
        when(broken.recoveryCandidates(any())).thenThrow(new IllegalStateException("private@example.invalid token secret"));
        var counters=new SimpleMeterRegistry();
        try {new BaitlyAutomationReconciler(broken,clock,counters).reconcile();}
        finally {logger.detachAppender(appender);}
        assertThat(appender.list).allSatisfy(event->{
            assertThat(event.getThrowableProxy()).isNull();
            assertThat(event.getFormattedMessage()).doesNotContain("private@example.invalid","token secret");
        });
        assertThat(counters.get("baitly.automation.reconciliation.failures").counter().count()).isEqualTo(1);
        assertThat(counters.getMeters()).allSatisfy(m->assertThat(m.getId().getTags()).isEmpty());
    }
}
