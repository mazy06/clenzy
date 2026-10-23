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
class BaitlyAutomationRecoveryTest {
    JdbcTemplate db,observer,admin;
    DriverManagerDataSource source;
    DataSourceTransactionManager manager;
    BaitlyAutomationJournal journal;
    BaitlyAutomationContext codec;
    AutomationExecutionRepository executions;
    AutomationRuleRepository rules;
    ReservationRepository reservations;
    AutomationActionRegistry registry;
    AutomationActionExecutor executor;
    AutomationRule rule;
    Reservation stay;
    String schema;
    Clock clock=Clock.fixed(Instant.parse("2026-10-24T10:00:00Z"),ZoneOffset.UTC);
    LocalDateTime now=LocalDateTime.ofInstant(clock.instant(),ZoneId.systemDefault());
    BaitlyAutomationJournal.Work work=new BaitlyAutomationJournal.Work(11,7);
    @BeforeEach void setup() {
        String jdbc=System.getProperty("baitly.test.jdbc");
        if(jdbc==null) source=new DriverManagerDataSource("jdbc:h2:mem:automation"+UUID.randomUUID()+";MODE=PostgreSQL;DB_CLOSE_DELAY=-1","sa","");
        else {
            if(!jdbc.matches("jdbc:postgresql://(?:127\\.0\\.0\\.1|localhost):[0-9]+/[a-zA-Z0-9_]*(?:test|recipe|ci)[a-zA-Z0-9_]*"))
                throw new IllegalArgumentException("Base de recette dédiée requise");
            admin=new JdbcTemplate(new DriverManagerDataSource(jdbc,"postgres",""));
            schema="baitly_automation_"+UUID.randomUUID().toString().replace("-","");
            admin.execute("CREATE SCHEMA "+schema);
            source=new DriverManagerDataSource(jdbc+"?currentSchema="+schema,"postgres","");
        }
        db=new JdbcTemplate(source);observer=new JdbcTemplate(source);
        db.execute("CREATE TABLE automation_rules(id BIGINT PRIMARY KEY,organization_id BIGINT,enabled BOOLEAN,updated_at TIMESTAMP)");
        db.execute("CREATE TABLE automation_executions(id BIGINT PRIMARY KEY,organization_id BIGINT,automation_rule_id BIGINT REFERENCES automation_rules(id),subject_type VARCHAR(30),subject_id BIGINT,status VARCHAR(20),scheduled_at TIMESTAMP,executed_at TIMESTAMP,error_message TEXT)");
        db.update("INSERT INTO automation_rules VALUES (1,7,true,?)",now);
        db.update("INSERT INTO automation_executions(id,organization_id,automation_rule_id,status,scheduled_at) VALUES (10,7,1,'PENDING',?)",now);
        migrate();migrate();
        manager=new DataSourceTransactionManager(source);journal=new BaitlyAutomationJournal(db,manager);
        codec=new BaitlyAutomationContext(new TokenEncryptionService("synthetic-recipe-password",1,""),new ObjectMapper(),clock);
        executions=mock(AutomationExecutionRepository.class);rules=mock(AutomationRuleRepository.class);
        reservations=mock(ReservationRepository.class);registry=mock(AutomationActionRegistry.class);
        executor=mock(AutomationActionExecutor.class);
        rule=new AutomationRule();rule.setId(1L);rule.setOrganizationId(7L);rule.setTriggerType(AutomationTrigger.RESERVATION_CONFIRMED);
        rule.setActionType(AutomationAction.NOTIFY_STAFF);
        org.springframework.test.util.ReflectionTestUtils.setField(rule,"updatedAt",now);
        stay=new Reservation();stay.setId(100L);stay.setOrganizationId(7L);stay.setStatus("confirmed");
        when(executions.findById(11L)).thenAnswer(c -> Optional.of(model()));
        when(reservations.findById(100L)).thenReturn(Optional.of(stay));
        when(registry.executorFor(any())).thenReturn(executor);
        when(executor.execute(any(),any())).thenReturn(AutomationActionExecutor.ExecutionResult.executed());
    }
    void migrate() {
        try(var connection=source.getConnection()) {
            var database=liquibase.database.DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new liquibase.database.jvm.JdbcConnection(connection));
            var resources=new liquibase.resource.ClassLoaderResourceAccessor();
            try(var master=new liquibase.Liquibase("db/changelog/db.changelog-master.yaml",resources,database)) {
                var selected=new liquibase.changelog.DatabaseChangeLog("db/changelog/db.changelog-master.yaml");
                master.getDatabaseChangeLog().getChangeSets().stream().filter(set->set.getId().equals("0603-baitly-automation-durable-recovery")).forEach(selected::addChangeSet);
                assertThat(selected.getChangeSets()).hasSize(1);
                new liquibase.Liquibase(selected,resources,database).update("");
            }
        } catch(Exception failure) {throw new IllegalStateException("Migration de recette moteur échouée",failure);}
    }
    @AfterEach void close() {if(schema!=null) admin.execute("DROP SCHEMA "+schema+" CASCADE");else db.execute("DROP ALL OBJECTS");}
    void queue() {
        String encrypted=codec.encode(7L,"RESERVATION",100L,Map.of("_baitlyProperty","null","_baitlyGuest","null","_baitlyGuestVersion","null","private","synthetic-secret@example.invalid"));
        db.update("""
            INSERT INTO automation_executions(id,organization_id,automation_rule_id,subject_type,subject_id,status,scheduled_at,
                durable_state,durable_context,durable_key,rule_revision,durable_expires_at)
            VALUES (11,7,1,'RESERVATION',100,'PENDING',?,'PENDING',?,'7:1:RESERVATION:100:once',?,?)
            """,now.minusMinutes(1),encrypted,now,now.plusDays(1));
    }
    AutomationExecution model() {
        return db.queryForObject("SELECT * FROM automation_executions WHERE id=11",(rs,n)->{
            var e=new AutomationExecution();e.setId(11L);e.setOrganizationId(rs.getLong("organization_id"));e.setAutomationRule(rule);
            e.setSubjectType(rs.getString("subject_type"));e.setSubjectId(rs.getLong("subject_id"));
            e.setDurableContext(rs.getString("durable_context"));e.setRuleRevision(rs.getTimestamp("rule_revision").toLocalDateTime());return e;
        });
    }
    AutomationEvaluationService worker(BaitlyAutomationJournal store) {
        var tenant=mock(TenantScopedExecutor.class);
        doAnswer(c->{c.getArgument(1,Runnable.class).run();return null;}).when(tenant).runAsOrganization(anyLong(),any(Runnable.class));
        return new AutomationEvaluationService(rules,executions,new AutomationConditionEvaluator(new ObjectMapper()),registry,reservations,
            tenant,new TenantContext(),new SimpleMeterRegistry(),mock(com.clenzy.service.agent.supervision.SupervisionActivityService.class),
            clock,mock(GuestMessageLogRepository.class),codec,store,manager);
    }
    String state() {return db.queryForObject("SELECT durable_state FROM automation_executions WHERE id=11",String.class);}
    String status() {return db.queryForObject("SELECT status FROM automation_executions WHERE id=11",String.class);}
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
        queue();var guest=new Guest();guest.setId(70L);stay.setGuest(guest);
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
        var guest=new Guest();guest.setId(70L);guest.setUpdatedAt(LocalDateTime.parse("2026-10-24T10:00:00.123456789"));stay.setGuest(guest);
        var encrypted=codec.encode(7L,"RESERVATION",100L,Map.of("_baitlyProperty","null","_baitlyGuest","70","_baitlyGuestVersion","2026-10-24T10:00:00.123457"));
        db.update("UPDATE automation_executions SET durable_context=?",encrypted);
        worker(journal).processScheduledExecutions();assertThat(status()).isEqualTo("EXECUTED");
    }
    @Test void historicalDiagnosticCannotLeakThroughExecutionDto() {
        var e=new AutomationExecution();e.setAutomationRule(rule);e.setStatus(AutomationExecutionStatus.FAILED);
        e.setErrorMessage("private@example.invalid Bearer secret");
        assertThat(com.clenzy.dto.AutomationExecutionDto.from(e).errorMessage()).isEqualTo("AUTOMATION_LEGACY_REVIEW");
    }

}
