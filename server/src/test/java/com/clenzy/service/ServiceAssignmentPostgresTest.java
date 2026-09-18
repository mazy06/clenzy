package com.clenzy.service;

import com.clenzy.service.assignment.AssignmentProposalStore;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import static org.assertj.core.api.Assertions.*;

@EnabledIfSystemProperty(named="baitly.test.jdbc", matches="jdbc:postgresql:.*")
class ServiceAssignmentPostgresTest {
    SingleConnectionDataSource source;
    JdbcTemplate db;
    String schema;
    AssignmentProposalStore store;
    java.nio.file.Path migrationDirectory;

    @BeforeEach void setup() throws Exception {
        source = new SingleConnectionDataSource(System.getProperty("baitly.test.jdbc"), "postgres", "", true);
        db = new JdbcTemplate(source);
        schema = "baitly_proposals_" + java.util.UUID.randomUUID().toString().replace("-", "");
        db.execute("CREATE SCHEMA " + schema);
        db.execute("SET search_path TO " + schema);
        db.execute("CREATE TABLE users(id bigint PRIMARY KEY)");
        db.execute("CREATE TABLE teams(id bigint PRIMARY KEY,personal_user_id bigint)");
        db.execute("INSERT INTO teams VALUES(9,NULL)");
        db.execute("CREATE TABLE organizations(id bigint PRIMARY KEY)");
        db.execute("INSERT INTO organizations VALUES(1)");
        db.execute("CREATE TABLE marketplace_service_categories(id bigint PRIMARY KEY,code text,family text)");
        db.execute("INSERT INTO marketplace_service_categories VALUES(1,'CLEANING','OPERATIONS')");
        db.execute("CREATE TABLE marketplace_service_items(code text PRIMARY KEY,category_id bigint)");
        db.execute("INSERT INTO marketplace_service_items VALUES('cleaning',1)");
        db.execute("CREATE TABLE team_members(team_id bigint,user_id bigint)");
        db.execute("CREATE TABLE service_requests(id bigint PRIMARY KEY,organization_id bigint DEFAULT 1,marketplace_request_id bigint,property_id bigint NOT NULL,service_item_code text,assigned_to_type text,assigned_to_id bigint,status text,desired_date timestamp,estimated_duration_hours integer)");
        db.execute("CREATE TABLE interventions(id bigint PRIMARY KEY,property_id bigint NOT NULL,service_item_code text,team_id bigint,assigned_user_id bigint,service_request_id bigint,status text,scheduled_date timestamp,estimated_duration_hours integer)");
        db.execute("CREATE TABLE marketplace_quote_requests(id bigint PRIMARY KEY)");
        db.execute("CREATE TABLE service_quotes(id bigint PRIMARY KEY,status text,valid_until date)");
        db.execute("CREATE TABLE outbox_events(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,aggregate_type text,aggregate_id text,event_type text,topic text,partition_key text,payload jsonb,organization_id bigint,status text,retry_count integer,created_at timestamp)");
        execute("0465__service_execution_rules.sql");
        execute("0466__service_execution_reservations.sql");
        migrationDirectory=java.nio.file.Files.createTempDirectory("baitly-liquibase-");
        java.nio.file.Files.createDirectory(migrationDirectory.resolve("changes"));
        for (String file:java.util.List.of("0473__service_assignment_proposals.sql","0474__proposal_slot_reservations.sql","0475__assignment_contact_preferences.sql","0476__assignment_durable_jobs.sql")) {
            try (var input=getClass().getResourceAsStream("/db/changelog/changes/"+file)) {
                java.nio.file.Files.writeString(migrationDirectory.resolve("changes").resolve(file),
                    new String(input.readAllBytes(),StandardCharsets.UTF_8)
                        .replace("public.",schema+".").replace("pg_catalog, public","pg_catalog, "+schema));
            }
        }
        try (var input=getClass().getResourceAsStream("/db/changelog/db.changelog-master.yaml")) {
            String master=new String(input.readAllBytes(),StandardCharsets.UTF_8);
            int start=master.indexOf("  - changeSet:\n      id: \"0473-service-assignment-proposals\"");
            if (start<0) throw new IllegalStateException("Migrations absentes du master");
            java.nio.file.Files.writeString(migrationDirectory.resolve("changelog.yaml"),"databaseChangeLog:\n"+master.substring(start));
        }
        bootMigrations();
        db.execute("INSERT INTO service_requests(id,property_id,service_item_code,assigned_to_type,assigned_to_id,status,desired_date,estimated_duration_hours,assignment_phase) VALUES(1,10,'cleaning','user',9,'ASSIGNED','2026-10-01 09:00',2,'PROPOSED')");
        store = new AssignmentProposalStore(db);
    }

    void execute(String file) throws Exception {
        try (var stream = getClass().getResourceAsStream("/db/changelog/changes/" + file)) {
            db.execute(new String(stream.readAllBytes(), StandardCharsets.UTF_8)
                .replace("public.", schema + ".").replace("pg_catalog, public", "pg_catalog, " + schema));
        }
    }

    void bootMigrations() {
        try (var context=new org.springframework.context.annotation.AnnotationConfigApplicationContext()) {
            context.registerBean("liquibase",liquibase.integration.spring.SpringLiquibase.class,() -> {
                var migration=new liquibase.integration.spring.SpringLiquibase();
                migration.setDataSource(source);
                migration.setDefaultSchema(schema);
                migration.setLiquibaseSchema(schema);
                migration.setChangeLog(migrationDirectory.resolve("changelog.yaml").toUri().toString());
                return migration;
            });
            context.refresh();
        }
    }

    @Test void springStartupAppliesMasterChangesetsExactlyOnce() {
        bootMigrations();
        assertThat(db.queryForObject("SELECT count(*) FROM databasechangelog",Integer.class)).isEqualTo(4);
        assertThat(db.queryForObject("SELECT locked FROM databasechangeloglock",Boolean.class)).isFalse();
    }

    @AfterEach void cleanup() throws Exception {
        if (db != null) db.execute("DROP SCHEMA " + schema + " CASCADE");
        if (source != null) source.destroy();
        if (migrationDirectory!=null) {
            try (var paths=java.nio.file.Files.walk(migrationDirectory)) {
                for (var path:paths.sorted(java.util.Comparator.reverseOrder()).toList()) java.nio.file.Files.deleteIfExists(path);
            }
        }
    }

    @Test void logicalExpirationReleasesTheSlotBeforeSchedulerCleanup() {
        var now = Instant.now();
        var p = store.create(1L,1L,1,"user",9L,"AUTOMATIC",now.minusSeconds(3600),now.plusSeconds(60),"{}");
        assertThat(conflicts()).isTrue();
        db.update("UPDATE service_assignment_proposals SET expires_at=CURRENT_TIMESTAMP-interval '1 second' WHERE id=?",p.id());
        assertThat(store.active(1L)).isPresent();
        assertThat(conflicts()).isFalse();
    }

    @Test void onlyOneActiveProposalAndOneInitialConversionAreAllowed() {
        var now = Instant.now();
        store.create(1L,1L,1,"user",9L,"AUTOMATIC",now,now.plusSeconds(60),"{}");
        assertThatThrownBy(() -> store.create(1L,1L,1,"user",10L,"AUTOMATIC",now,now.plusSeconds(60),"{}"))
            .isInstanceOf(org.springframework.dao.DuplicateKeyException.class);
        db.execute("INSERT INTO interventions(id,service_request_id,initial_acceptance_request_id) VALUES(1,1,1)");
        assertThatThrownBy(() -> db.execute("INSERT INTO interventions(id,service_request_id,initial_acceptance_request_id) VALUES(2,1,1)"))
            .isInstanceOf(org.springframework.dao.DuplicateKeyException.class);
    }

    @Test void replayedNotificationsAndResponsesCannotCreateDuplicates() {
        var now = Instant.now();
        var p = store.create(1L,1L,1,"team",9L,"AUTOMATIC",now,now.plusSeconds(60),"{}");
        store.event(1L,p.id(),"PROPOSED","PROPOSED:"+p.id());
        store.event(1L,p.id(),"PROPOSED","PROPOSED:"+p.id());
        assertThat(db.queryForObject("SELECT count(*) FROM service_assignment_notifications",Integer.class)).isEqualTo(1);
        store.close(p,"DECLINED",now,"Indisponible");
        assertThat(store.excludedTeams(1L,1)).containsExactly(9L);
        assertThat(store.excludedTeams(1L,2)).isEmpty();
        assertThatThrownBy(() -> store.close(p,"ACCEPTED",now,null)).isInstanceOf(IllegalStateException.class);
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings={"ACCEPTED","EXPIRED","WITHDRAWN"})
    void serializedDecisionCannotBeOverwrittenByAConcurrentAcceptance(String winner) throws Exception {
        var now=Instant.now();
        var proposal=store.create(1L,1L,1,"user",9L,"AUTOMATIC",now,now.plusSeconds(120),"{}");
        var started=new java.util.concurrent.CountDownLatch(1);
        try (var first=java.sql.DriverManager.getConnection(System.getProperty("baitly.test.jdbc"),"postgres","");
             var executor=java.util.concurrent.Executors.newSingleThreadExecutor()) {
            first.setAutoCommit(false);
            try (var statement=first.createStatement()) {
                statement.execute("SET search_path TO "+schema);
                statement.executeQuery("SELECT id FROM service_requests WHERE id=1 FOR UPDATE").close();
            }
            var late=executor.submit(() -> {
                try (var connection=java.sql.DriverManager.getConnection(System.getProperty("baitly.test.jdbc"),"postgres","")) {
                    connection.setAutoCommit(false);
                    try (var statement=connection.createStatement()) {
                        statement.execute("SET search_path TO "+schema);
                        started.countDown();
                        statement.executeQuery("SELECT id FROM service_requests WHERE id=1 FOR UPDATE").close();
                        int changed=statement.executeUpdate("UPDATE service_assignment_proposals SET status='ACCEPTED' WHERE id="+proposal.id()+" AND status='PENDING' AND expires_at>CURRENT_TIMESTAMP");
                        connection.commit();
                        return changed;
                    }
                }
            });
            try {
                assertThat(started.await(5,java.util.concurrent.TimeUnit.SECONDS)).isTrue();
                assertThatThrownBy(() -> late.get(100,java.util.concurrent.TimeUnit.MILLISECONDS))
                        .isInstanceOf(java.util.concurrent.TimeoutException.class);
                try (var statement=first.createStatement()) {
                    statement.executeUpdate("UPDATE service_assignment_proposals SET status='"+winner+"' WHERE id="+proposal.id());
                    if ("WITHDRAWN".equals(winner)) statement.executeUpdate("UPDATE service_requests SET assignment_cycle=2 WHERE id=1");
                }
                first.commit();
                assertThat(late.get(5,java.util.concurrent.TimeUnit.SECONDS)).isZero();
                assertThat(store.get(proposal.id()).orElseThrow().status()).isEqualTo(winner);
            } finally { first.rollback(); }
        }
    }

    boolean conflicts() {
        return db.queryForObject("SELECT baitly_assignment_conflicts(0::bigint,0::bigint,'user',9::bigint,timestamp '2026-10-01 10:00',timestamp '2026-10-01 11:00')",Boolean.class);
    }

    @Test void proposalDeadlinesAndOutboxAreAtomicAndSurviveReload() {
        var now=Instant.now();
        var p=store.create(1L,1L,1,"user",9L,"AUTOMATIC",now,now.plusSeconds(2400),"{}");
        var jobs=new com.clenzy.service.assignment.AssignmentJobStore(db);
        var deadlines=jobs.recover(0).stream().filter(j->j.kind().equals("TICK")).toList();
        assertThat(deadlines).hasSize(2);
        assertThat(deadlines.stream().map(j->j.dueAt().getEpochSecond())).containsExactlyInAnyOrder(
            now.plusSeconds(1800).getEpochSecond(),now.plusSeconds(2400).getEpochSecond());
        assertThat(db.queryForObject("SELECT count(*) FROM outbox_events WHERE topic='baitly.assignment.jobs'",Integer.class))
            .isEqualTo(db.queryForObject("SELECT count(*) FROM baitly_assignment_jobs",Integer.class));
        store.close(p,"ACCEPTED",now,null);
        assertThat(jobs.recover(0).stream().filter(j->j.kind().equals("TICK"))).isEmpty();
    }

    @Test void rollbackCannotLeaveAWakeOrNotificationBehind() {
        int before=db.queryForObject("SELECT count(*) FROM outbox_events",Integer.class);
        db.execute("BEGIN");
        try {
            var now=Instant.now();
            var p=store.create(1L,1L,1,"user",9L,"AUTOMATIC",now,now.plusSeconds(2400),"{}");
            store.event(1L,p.id(),"PROPOSED","PROPOSED:"+p.id());
            store.deferContact(1L,now.plusSeconds(7200));
        } finally { db.execute("ROLLBACK"); }
        assertThat(store.active(1L)).isEmpty();
        assertThat(db.queryForObject("SELECT count(*) FROM outbox_events",Integer.class)).isEqualTo(before);
        assertThat(db.queryForObject("SELECT count(*) FROM service_assignment_notifications",Integer.class)).isZero();
    }

    @Test void contactAndFailedDeliveryRemainDurableUntilCompleted() {
        var now=Instant.now();
        store.deferContact(1L,now.plusSeconds(3600));
        store.deferContact(1L,now.plusSeconds(3600));
        var jobs=new com.clenzy.service.assignment.AssignmentJobStore(db);
        var contact=jobs.recover(0).stream().filter(j->j.kind().equals("TICK")).findFirst().orElseThrow();
        assertThat(jobs.recover(0).stream().filter(j->j.kind().equals("TICK"))).hasSize(1);
        int before=db.queryForObject("SELECT count(*) FROM outbox_events",Integer.class);
        jobs.retry(contact.id(),now,new IllegalStateException());
        assertThat(jobs.pending(contact.id()).orElseThrow().dueAt().getEpochSecond()).isEqualTo(now.plusSeconds(5).getEpochSecond());
        assertThat(db.queryForObject("SELECT count(*) FROM outbox_events",Integer.class)).isEqualTo(before+1);
        jobs.complete(contact.id());
        assertThat(jobs.pending(contact.id())).isEmpty();
    }

    @Test void quoteExpiryAndRefusalWakeTheSameLifecycle() {
        var now=Instant.now();
        var p=store.create(1L,1L,1,"user",9L,"AUTOMATIC",now,now.plusSeconds(2400),"{}");
        store.close(p,"QUOTED",now,null);
        db.update("INSERT INTO service_quotes(id,status,valid_until,service_request_id,assignment_proposal_id) VALUES(1,'RECEIVED','2026-10-01',1,?)",p.id());
        assertThat(db.queryForObject("SELECT due_at FROM baitly_assignment_jobs WHERE event_key LIKE 'quote:%'",java.sql.Timestamp.class).toInstant())
            .isEqualTo(Instant.parse("2026-10-02T00:00:00Z"));
        db.execute("UPDATE service_quotes SET status='REJECTED' WHERE id=1");
        assertThat(db.queryForObject("SELECT count(*) FROM baitly_assignment_jobs WHERE event_key LIKE 'quote:%'",Integer.class)).isEqualTo(2);
    }
}
