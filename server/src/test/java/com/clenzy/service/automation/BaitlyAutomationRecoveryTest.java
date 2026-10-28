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
class BaitlyAutomationRecoveryTest extends BaitlyAutomationFixture {
    @Test void migrationQuarantinesHistoricalPendingWithoutRearmingAnything() {
        assertThat(journal.due(now)).isEmpty();
        assertThat(db.queryForObject("SELECT error_message FROM automation_executions WHERE id=10",String.class)).isEqualTo("AUTOMATION_LEGACY_REVIEW");
    }
    @Test void queueRollsBackWithBusinessTransaction() {
        new TransactionTemplate(manager).executeWithoutResult(s->{queue();s.setRollbackOnly();});
        assertThat(journal.due(now)).isEmpty();verifyNoInteractions(executor);
    }
    @Test void committedQueueSurvivesRestartAndRunsOnlyOnce() {
        queue();worker(new BaitlyAutomationJournal(db,manager)).processScheduledExecutions();worker(journal).processScheduledExecutions();
        verify(executor,times(1)).execute(any(),any());assertThat(state()).isEqualTo("DONE");assertThat(status()).isEqualTo("EXECUTED");
        assertThat(db.queryForObject("SELECT durable_context FROM automation_executions WHERE id=11",String.class)).isNull();
    }
    @Test void deliveryTemplateFromAnotherOrganizationBlocksWithoutCallingTheExecutor() {
        queue();var template=new MessageTemplate();template.setOrganizationId(8L);rule.setTemplate(template);
        worker(journal).processScheduledExecutions();worker(journal).processScheduledExecutions();
        assertThat(state()).isEqualTo("UNKNOWN");verifyNoInteractions(executor);
    }
    @Test void deliveryOwnerIsInitializedDuringPreparationAndExecutorRemainsOutsideTransaction() {
        queue();var owner=mock(User.class,withSettings().extraInterfaces(org.hibernate.proxy.HibernateProxy.class).defaultAnswer(CALLS_REAL_METHODS));
        var lazy=mock(org.hibernate.proxy.LazyInitializer.class);
        when(((org.hibernate.proxy.HibernateProxy)owner).getHibernateLazyInitializer()).thenReturn(lazy);
        doAnswer(call->{assertThat(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive()).isTrue();return null;})
            .when(lazy).initialize();
        var property=new Property();property.setOrganizationId(7L);property.setOwner(owner);stay.setProperty(property);
        when(executor.execute(any(),any())).thenAnswer(call->{
            assertThat(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            return AutomationActionExecutor.ExecutionResult.executed();
        });
        worker(journal).processScheduledExecutions();verify(lazy).initialize();assertThat(status()).isEqualTo("EXECUTED");
    }
    @Test void attemptIsVisibleFromAnotherConnectionBeforeEffects() {
        queue();when(executor.execute(any(),any())).thenAnswer(c->{
            assertThat(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            assertThat(observer.queryForObject("SELECT durable_state FROM automation_executions WHERE id=11",String.class)).isEqualTo("STARTED");
            return AutomationActionExecutor.ExecutionResult.executed();
        });worker(journal).processScheduledExecutions();assertThat(status()).isEqualTo("EXECUTED");
    }
    @Test void partialEffectThenExceptionNeverReplaysOrLeaksDiagnostics() {
        queue();var effects=new AtomicInteger();
        var logger=(ch.qos.logback.classic.Logger)org.slf4j.LoggerFactory.getLogger(AutomationEvaluationService.class);
        var appender=new ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent>();
        appender.start();logger.addAppender(appender);
        when(executor.execute(any(),any())).thenAnswer(c->{effects.incrementAndGet();throw new IllegalStateException("synthetic-secret@example.invalid Bearer secret");});
        worker(journal).processScheduledExecutions();worker(journal).processScheduledExecutions();
        logger.detachAppender(appender);
        assertThat(appender.list.toString()).doesNotContain("synthetic-secret","Bearer secret");
        assertThat(appender.list).allSatisfy(event -> assertThat(event.getThrowableProxy()).isNull());
        assertThat(effects).hasValue(1);assertThat(state()).isEqualTo("UNKNOWN");
        assertThat(db.queryForObject("SELECT error_message FROM automation_executions WHERE id=11",String.class)).isEqualTo("AUTOMATION_ATTEMPT_UNCERTAIN");
        assertThat(db.queryForList("SELECT * FROM automation_executions").toString()).doesNotContain("synthetic-secret","Bearer secret");
    }
    @Test void crashAfterClaimRemainsBlockedEvenMuchLater() {
        queue();assertThat(journal.claim(work,now)).isPresent();
        assertThat(new BaitlyAutomationJournal(db,manager).claim(work,now.plusDays(90))).isEmpty();
        worker(journal).processScheduledExecutions();assertThat(state()).isEqualTo("STARTED");verifyNoInteractions(executor);
    }
    @Test void failedResultCommitCannotReleaseTheFence() {
        queue();var failing=spy(journal);doThrow(new IllegalStateException("DB_UNAVAILABLE")).when(failing).finish(any(),any(),any(),anyBoolean());
        worker(failing).processScheduledExecutions();worker(journal).processScheduledExecutions();
        assertThat(state()).isEqualTo("STARTED");verify(executor,times(1)).execute(any(),any());
    }
    @Test void concurrentWorkersReserveOnlyOneAttempt() throws Exception {
        queue();var pool=Executors.newFixedThreadPool(2);var start=new CountDownLatch(1);
        try {
            Callable<Boolean> claim=()->{start.await();return new BaitlyAutomationJournal(db,manager).claim(work,now).isPresent();};
            var a=pool.submit(claim);var b=pool.submit(claim);start.countDown();
            assertThat(List.of(a.get(15,TimeUnit.SECONDS),b.get(15,TimeUnit.SECONDS))).containsExactlyInAnyOrder(true,false);
        } finally {pool.shutdownNow();}
    }
    @Test void resultFromWrongTicketCannotChangeAnAttempt() {
        queue();var ticket=journal.claim(work,now).orElseThrow();
        assertThat(journal.finish(new BaitlyAutomationJournal.Ticket(work,UUID.randomUUID()),AutomationActionExecutor.ExecutionResult.executed(),now,false)).isFalse();
        assertThat(state()).isEqualTo("STARTED");assertThat(journal.finish(ticket,AutomationActionExecutor.ExecutionResult.executed(),now,false)).isTrue();
    }
    @Test void completedResultCannotBeDowngradedByLateFailure() {
        queue();var t=journal.claim(work,now).orElseThrow();journal.finish(t,AutomationActionExecutor.ExecutionResult.executed(),now,false);
        assertThat(journal.finish(t,null,now.plusDays(1),false)).isFalse();assertThat(state()).isEqualTo("DONE");
    }
    @ParameterizedTest @ValueSource(strings={"disabled","revision","rule-org","expired"})
    void changedAdmissionScopeNeverCallsExecutor(String change) {
        queue();switch(change) {
            case "disabled"->db.update("UPDATE automation_rules SET enabled=false");
            case "revision"->db.update("UPDATE automation_rules SET updated_at=?",now.plusMinutes(1));
            case "rule-org"->db.update("UPDATE automation_rules SET organization_id=8");
            case "expired"->db.update("UPDATE automation_executions SET durable_expires_at=?",now.minusSeconds(1));
        }
        worker(journal).processScheduledExecutions();assertThat(state()).isEqualTo("REVIEW");verifyNoInteractions(executor);
    }
    @Test void wrongOrganizationCannotClaimOrFinish() {
        queue();assertThat(journal.claim(new BaitlyAutomationJournal.Work(11,8),now)).isEmpty();assertThat(state()).isEqualTo("PENDING");
    }
    @Test void changedGuestCannotReceiveAnOldQueuedMessage() {
        queue();var guest=new Guest();guest.setId(70L);guest.setOrganizationId(7L);stay.setGuest(guest);
        worker(journal).processScheduledExecutions();assertThat(state()).isEqualTo("UNKNOWN");verifyNoInteractions(executor);
    }
    @Test void reservationTransferredToAnotherTenantCannotExecute() {
        queue();stay.setOrganizationId(8L);worker(journal).processScheduledExecutions();assertThat(state()).isEqualTo("UNKNOWN");verifyNoInteractions(executor);
    }
    @Test void cancelledReservationConsumesNoMessage() {
        queue();stay.setStatus("cancelled");worker(journal).processScheduledExecutions();assertThat(status()).isEqualTo("SKIPPED");verifyNoInteractions(executor);
    }
    @Test void missingSubjectConsumesNoMessage() {
        queue();when(reservations.findById(100L)).thenReturn(Optional.empty());worker(journal).processScheduledExecutions();assertThat(status()).isEqualTo("SKIPPED");verifyNoInteractions(executor);
    }
    @Test void unsupportedExecutorCannotRearmItselfAfterPartialEffect() {
        queue();when(executor.execute(any(),any())).thenReturn(AutomationActionExecutor.ExecutionResult.rescheduled(now.plusHours(1),"private reason"));
        worker(journal).processScheduledExecutions();assertThat(state()).isEqualTo("UNKNOWN");
    }
    @Test void auditedPreEffectDeferralRemainsDurableAndDoesNotRunEarly() {
        queue();var message=mock(SendMessageExecutor.class);when(registry.executorFor(any())).thenReturn(message);
        when(message.permitsPreEffectDeferral()).thenReturn(true);
        when(message.execute(any(),any())).thenReturn(AutomationActionExecutor.ExecutionResult.rescheduled(now.plusHours(1),"private reason"));
        worker(journal).processScheduledExecutions();worker(journal).processScheduledExecutions();
        verify(message,times(1)).execute(any(),any());assertThat(state()).isEqualTo("PENDING");assertThat(journal.due(now)).isEmpty();
        assertThat(journal.claim(work,now.plusHours(1))).isPresent();
    }
    @Test void deferredAttemptCannotBeOverwrittenByAnEarlierTicket() {
        queue();var first=journal.claim(work,now).orElseThrow();journal.finish(first,AutomationActionExecutor.ExecutionResult.rescheduled(now.plusHours(1),"quiet"),now,true);
        var second=journal.claim(work,now.plusHours(1)).orElseThrow();assertThat(first.token()).isNotEqualTo(second.token());
        assertThat(journal.finish(first,null,now.plusHours(1),false)).isFalse();assertThat(state()).isEqualTo("STARTED");
    }
    @Test void payloadIsEncryptedBoundToSubjectAndBounded() {
        var encrypted=codec.encode(7L,"INVOICE",100L,Map.of("synthetic","private@example.invalid"));
        assertThat(encrypted).startsWith("GCMv1:").doesNotContain("private@example.invalid");
        assertThat(codec.decode(7L,"INVOICE",100L,encrypted)).containsEntry("synthetic","private@example.invalid");
        assertThatThrownBy(()->codec.decode(8L,"INVOICE",100L,encrypted)).hasMessage("AUTOMATION_CONTEXT_UNAVAILABLE");
        assertThatThrownBy(()->codec.decode(7L,"INVOICE",101L,encrypted)).hasMessage("AUTOMATION_CONTEXT_UNAVAILABLE");
        assertThatThrownBy(()->codec.encode(7L,"INVOICE",100L,Map.of("x","x".repeat(9000)))).hasMessage("AUTOMATION_CONTEXT_UNAVAILABLE");
    }
    @Test void corruptCiphertextCannotInvokeAction() {
        queue();db.update("UPDATE automation_executions SET durable_context='corrupt'");
        worker(journal).processScheduledExecutions();assertThat(state()).isEqualTo("UNKNOWN");verifyNoInteractions(executor);
    }
    @Test void recurrenceKeepsMonthlyBoundariesAndDoesNotStorePersonalDataInKey() {
        rule.setTriggerType(AutomationTrigger.OWNER_MONTHLY_STATEMENT);
        var data=codec.freeze(rule,Map.of("ownerName","private@example.invalid"));
        assertThat(data).containsEntry("periodStart","2026-09-01").containsEntry("periodEnd","2026-09-30");
        assertThat(codec.key(rule,"OWNER",100L,data)).endsWith("month:2026-09-01").doesNotContain("private");
    }
    @Test void invoiceDailyAdmissionAndOfflineEpisodesHaveStableKeys() {
        rule.setTriggerType(AutomationTrigger.INVOICE_OVERDUE);
        assertThat(codec.key(rule,"INVOICE",100L,Map.of("daysOverdue",3))).isEqualTo(codec.key(rule,"INVOICE",100L,Map.of("daysOverdue",6)));
        var tomorrow=new BaitlyAutomationContext(new TokenEncryptionService("synthetic-recipe-password",1,""),new ObjectMapper(),Clock.offset(clock,Duration.ofDays(1)));
        assertThat(tomorrow.key(rule,"INVOICE",100L,Map.of("daysOverdue",7))).isNotEqualTo(codec.key(rule,"INVOICE",100L,Map.of("daysOverdue",3)));
        rule.setTriggerType(AutomationTrigger.IOT_DEVICE_OFFLINE);
        assertThat(codec.key(rule,"IOT_DEVICE",100L,Map.of("offlineSince","2026-10-24T10:00:00Z")))
            .isNotEqualTo(codec.key(rule,"IOT_DEVICE",100L,Map.of("offlineSince","2026-10-24T10:00:01Z")));
        assertThatThrownBy(()->codec.key(rule,"IOT_DEVICE",100L,Map.of())).hasMessage("AUTOMATION_EPISODE_REQUIRED");
    }
    @Test void uniqueOccurrencePreventsDuplicateQueueAndAlreadyExecutedRowsNeverDrain() {
        queue();
        assertThatThrownBy(this::queue).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        worker(journal).processScheduledExecutions();
        assertThat(journal.due(now.plusDays(1))).isEmpty();
    }
    @Test void committedSkipIsTerminalAndDoesNotPersistPrivateReason() {
        queue();when(executor.execute(any(),any())).thenReturn(AutomationActionExecutor.ExecutionResult.skipped("private@example.invalid"));
        worker(journal).processScheduledExecutions();worker(journal).processScheduledExecutions();
        verify(executor,times(1)).execute(any(),any());assertThat(status()).isEqualTo("SKIPPED");
        assertThat(db.queryForObject("SELECT error_message FROM automation_executions WHERE id=11",String.class)).isEqualTo("AUTOMATION_SKIPPED");
    }
    @Test void nonFutureDeferralAndNullOutcomeRemainUncertain() {
        queue();var t=journal.claim(work,now).orElseThrow();
        journal.finish(t,AutomationActionExecutor.ExecutionResult.rescheduled(now,"private"),now,true);
        assertThat(state()).isEqualTo("UNKNOWN");assertThat(journal.due(now.plusDays(1))).isEmpty();
    }
    @Test void corruptionOfEncryptedContextCannotCrossResourceTypes() {
        String encrypted=codec.encode(7L,"INVOICE",100L,Map.of());
        assertThatThrownBy(()->codec.decode(7L,"RESERVATION",100L,encrypted)).hasMessage("AUTOMATION_CONTEXT_UNAVAILABLE");
    }
    @Test void drainIsBoundedToTwentyFiveCandidates() {
        queue();
        for(int i=20;i<50;i++) db.update("""
            INSERT INTO automation_executions(id,organization_id,automation_rule_id,subject_type,subject_id,status,
                scheduled_at,durable_state,durable_key,durable_expires_at)
            VALUES (?,7,1,'RESERVATION',?,'PENDING',?,'PENDING',?,?)
            """,i,i,now.minusMinutes(1),"synthetic-"+i,now.plusDays(1));
        assertThat(journal.due(now)).hasSize(25);
    }

    @Test void publicSerializationCannotExposeRecoveryContextOrInternalKeys() throws Exception {
        var e=new AutomationExecution();e.setDurableContext("encrypted-private");e.setDurableKey("internal-private");
        e.setDurableState("PENDING");
        assertThat(new ObjectMapper().writeValueAsString(e)).doesNotContain("encrypted-private","internal-private","durableContext","durableKey","durableState");
    }

    @Test void timestampPrecisionDoesNotBlockAFreshlySavedGuest() {
        queue();
        var guest=new Guest();guest.setId(70L);guest.setOrganizationId(7L);guest.setUpdatedAt(LocalDateTime.parse("2026-10-24T10:00:00.123456789"));stay.setGuest(guest);
        var encrypted=codec.encode(7L,"RESERVATION",100L,Map.of("_baitlyProperty","null","_baitlyGuest","70","_baitlyGuestVersion","2026-10-24T10:00:00.123457"));
        db.update("UPDATE automation_executions SET durable_context=?",encrypted);
        worker(journal).processScheduledExecutions();assertThat(status()).isEqualTo("EXECUTED");
    }
    @Test void historicalDiagnosticCannotLeakThroughExecutionDto() {
        var e=new AutomationExecution();e.setAutomationRule(rule);e.setStatus(AutomationExecutionStatus.FAILED);
        e.setErrorMessage("private@example.invalid Bearer secret");
        assertThat(com.clenzy.dto.AutomationExecutionDto.from(e).errorMessage()).isEqualTo("AUTOMATION_LEGACY_REVIEW");
    }

    @Test void aForeignGuestCannotBeReadEvenIfAnOldReservationLinksToIt() {
        queue();var guest=new Guest();guest.setId(70L);guest.setOrganizationId(8L);stay.setGuest(guest);
        worker(journal).processScheduledExecutions();assertThat(state()).isEqualTo("UNKNOWN");verifyNoInteractions(executor);
    }
    @Test void aForeignPropertyCannotSupplyContentToAnAutomation() {
        queue();var property=new Property();property.setId(91L);property.setOrganizationId(8L);stay.setProperty(property);
        worker(journal).processScheduledExecutions();assertThat(state()).isEqualTo("UNKNOWN");verifyNoInteractions(executor);
    }

}
