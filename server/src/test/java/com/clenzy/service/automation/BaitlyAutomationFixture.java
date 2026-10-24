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

/** Shared isolated SQL/migration fixture, no inherited tests or provider calls. */
abstract class BaitlyAutomationFixture {
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
                master.getDatabaseChangeLog().getChangeSets().stream().filter(set->Set.of("0603-baitly-automation-durable-recovery",
                    "0604-baitly-automation-outcome-proofs", "0605-baitly-external-effect-fences").contains(set.getId())).forEach(selected::addChangeSet);
                assertThat(selected.getChangeSets()).hasSize(3);
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
}
