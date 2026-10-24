package com.clenzy.config;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;

/** Real aggregate SQL and migration; no provider, customer or business execution. */
class BaitlyAutomationMetricsTest {
    JdbcTemplate db, admin;
    DriverManagerDataSource source;
    String schema;
    static final class MutableClock extends Clock {
        Instant time=Instant.parse("2026-10-24T10:00:00Z");
        public ZoneId getZone() {return ZoneOffset.UTC;}
        public Clock withZone(ZoneId zone) {return Clock.fixed(time,zone);}
        public Instant instant() {return time;}
    }
    MutableClock clock=new MutableClock();
    LocalDateTime now=LocalDateTime.ofInstant(clock.instant(),ZoneId.systemDefault());
    SimpleMeterRegistry registry=new SimpleMeterRegistry();
    BaitlyAutomationMetrics metrics;
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
        db=new JdbcTemplate(source);
        db.execute("CREATE TABLE automation_rules(id BIGINT PRIMARY KEY,organization_id BIGINT,enabled BOOLEAN,updated_at TIMESTAMP)");
        db.execute("CREATE TABLE automation_executions(id BIGINT PRIMARY KEY,organization_id BIGINT,automation_rule_id BIGINT REFERENCES automation_rules(id),subject_type VARCHAR(30),subject_id BIGINT,status VARCHAR(20),scheduled_at TIMESTAMP,executed_at TIMESTAMP,error_message TEXT)");
        db.update("INSERT INTO automation_rules VALUES (1,7,true,?)",now);
        db.update("INSERT INTO automation_executions(id,organization_id,automation_rule_id,status,scheduled_at) VALUES (10,7,1,'PENDING',?)",now);
        migrate();migrate();
        metrics=new BaitlyAutomationMetrics(db,registry,clock);
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

    double value(String suffix) {return registry.get("baitly.automation."+suffix).gauge().value();}
    void row(long id,String state,String status,LocalDateTime scheduled,LocalDateTime attempted,LocalDateTime expires) {
        db.update("INSERT INTO automation_executions(id,status,durable_state,scheduled_at,attempted_at,durable_expires_at,durable_context,error_message) VALUES (?,?,?,?,?,?,?,?)",
            id,status,state,scheduled,attempted,expires,"private@example.invalid","Bearer synthetic-private");
    }
    @Test void migrationAndPartitionsAreVisibleWithoutReadingPrivateFields() {
        row(20,"PENDING","PENDING",now.minusMinutes(4),null,now.plusHours(1));
        row(21,"PENDING","PENDING",now.minusMinutes(1),null,now.plusHours(1));
        row(22,"PENDING","PENDING",now.plusHours(2),null,now.plusHours(3));
        row(23,"PENDING","PENDING",now.minusDays(2),null,now.minusDays(1));
        row(24,"STARTED","FAILED",now.minusDays(3),now.minusDays(2),now.minusDays(1));
        row(25,"UNKNOWN","FAILED",now.minusDays(2),now.minusMinutes(8),now.minusDays(1));
        row(26,"REVIEW","FAILED",null,null,null);
        row(27,"DONE","EXECUTED",now.minusDays(5),now.minusDays(4),null);
        row(28,null,"EXECUTED",now.minusDays(5),null,null);
        var before=db.queryForList("SELECT * FROM automation_executions ORDER BY id");
        metrics.refresh(); metrics.refresh();
        assertThat(value("ready")).isEqualTo(2);
        assertThat(value("oldest.ready.seconds")).isEqualTo(240);
        assertThat(value("uncertain")).isEqualTo(2);
        assertThat(value("oldest.uncertain.seconds")).isEqualTo(172800);
        assertThat(value("expired")).isEqualTo(1);
        assertThat(value("review")).isEqualTo(1);
        assertThat(value("legacy.review")).isEqualTo(1);
        assertThat(value("snapshot.healthy")).isEqualTo(1);
        assertThat(db.queryForList("SELECT * FROM automation_executions ORDER BY id")).isEqualTo(before);
        assertThat(registry.getMeters()).hasSize(9).allSatisfy(m->assertThat(m.getId().getTags()).isEmpty());
    }
    @Test void startupDoesNotPretendToHaveCollected() {
        assertThat(value("snapshot.healthy")).isZero();
        assertThat(value("snapshot.last.success.timestamp.seconds")).isZero();
    }
    @Test void failureRetainsEvidenceAndRecoveryPublishesFreshSnapshot() {
        row(20,"UNKNOWN","FAILED",now,now.minusMinutes(7),now.plusDays(1));
        metrics.refresh();
        double success=value("snapshot.last.success.timestamp.seconds");
        clock.time=clock.time.plusSeconds(120);
        db.execute("ALTER TABLE automation_executions RENAME TO offline_automation");
        metrics.refresh();
        assertThat(value("uncertain")).isEqualTo(1);
        assertThat(value("oldest.uncertain.seconds")).isEqualTo(420);
        assertThat(value("snapshot.healthy")).isZero();
        assertThat(value("snapshot.last.success.timestamp.seconds")).isEqualTo(success);
        db.execute("ALTER TABLE offline_automation RENAME TO automation_executions");
        db.update("UPDATE automation_executions SET durable_state='DONE',status='EXECUTED'");
        metrics.refresh();
        assertThat(value("uncertain")).isZero();
        assertThat(value("snapshot.healthy")).isEqualTo(1);
        assertThat(value("snapshot.last.success.timestamp.seconds")).isEqualTo(success+120);
    }
    @Test void scrapeNeverQueriesSqlAndExportsOnlyFixedAggregates() {
        var prom=new io.micrometer.prometheusmetrics.PrometheusMeterRegistry(io.micrometer.prometheusmetrics.PrometheusConfig.DEFAULT);
        try {
            var collector=new BaitlyAutomationMetrics(db,prom,clock);
            row(20,"UNKNOWN","FAILED",now,now.minusMinutes(7),now.plusDays(1));
            collector.refresh();
            db.execute("DROP TABLE automation_executions");
            String scrape=prom.scrape();
            for(String suffix:List.of("ready","oldest_ready_seconds","uncertain","oldest_uncertain_seconds","expired","review","legacy_review","snapshot_healthy","snapshot_last_success_timestamp_seconds"))
                assertThat(scrape).contains("baitly_automation_"+suffix+" ");
            assertThat(scrape).doesNotContain("private@example.invalid","Bearer","organization","rule_id","subject","context","error_message","{");
        } finally {prom.close();}
    }
    @ParameterizedTest @ValueSource(strings={"missing-attempt","future-attempt","missing-schedule","missing-expiry","wrong-status","invalid-window","unknown-state","review-status"})
    void malformedActiveJournalCannotBecomeHealthyZero(String change) {
        row(20,"PENDING","PENDING",now.minusMinutes(4),null,now.plusDays(1));
        metrics.refresh();
        switch(change) {
            case "missing-attempt"->db.update("UPDATE automation_executions SET durable_state='UNKNOWN',status='FAILED'");
            case "future-attempt"->db.update("UPDATE automation_executions SET durable_state='STARTED',status='FAILED',attempted_at=?",now.plusMinutes(2));
            case "missing-schedule"->db.update("UPDATE automation_executions SET scheduled_at=NULL");
            case "missing-expiry"->db.update("UPDATE automation_executions SET durable_expires_at=NULL");
            case "wrong-status"->db.update("UPDATE automation_executions SET status='EXECUTED'");
            case "invalid-window"->db.update("UPDATE automation_executions SET durable_expires_at=?",now.minusDays(1));
            case "unknown-state"->db.update("UPDATE automation_executions SET durable_state='CORRUPT'");
            case "review-status"->db.update("UPDATE automation_executions SET durable_state='REVIEW'");
        }
        metrics.refresh();
        assertThat(value("snapshot.healthy")).isZero();
        assertThat(value("ready")).isEqualTo(1);
    }
    @Test void serverWallTimeIsIndependentOfDatabaseSessionTimezone() throws Exception {
        TimeZone previous=TimeZone.getDefault();
        try {
            TimeZone.setDefault(TimeZone.getTimeZone("Asia/Tokyo"));
            LocalDateTime serverNow=LocalDateTime.ofInstant(clock.instant(),ZoneId.systemDefault());
            row(20,"PENDING","PENDING",serverNow.minusMinutes(3),null,serverNow.plusHours(1));
            row(21,"STARTED","FAILED",serverNow,serverNow.minusMinutes(7),serverNow.plusHours(1));
            var scoped=new org.springframework.jdbc.datasource.SingleConnectionDataSource(source.getConnection(),true);
            try {
                var session=new JdbcTemplate(scoped);
                session.execute("SET TIME ZONE 'America/New_York'");
                // Read through the SAME connection whose SQL session zone differs from the server.
                registry.clear();
                metrics=new BaitlyAutomationMetrics(session,registry,clock);
                metrics.refresh();
            } finally {scoped.destroy();}
            assertThat(value("snapshot.healthy")).isEqualTo(1);
            assertThat(value("ready")).isEqualTo(1);
            assertThat(value("oldest.ready.seconds")).isEqualTo(180);
            assertThat(value("oldest.uncertain.seconds")).isEqualTo(420);
            assertThat(value("snapshot.last.success.timestamp.seconds")).isEqualTo(clock.instant().getEpochSecond());
        } finally {TimeZone.setDefault(previous);}
    }
    @Test void dueAndExpiryBoundariesMatchClaim() {
        row(20,"PENDING","PENDING",now,null,now);
        row(21,"PENDING","PENDING",now.plusSeconds(1),null,now.plusHours(1));
        metrics.refresh();
        assertThat(value("ready")).isEqualTo(1);
        assertThat(value("expired")).isZero();
        assertThat(value("oldest.ready.seconds")).isZero();
    }
}
