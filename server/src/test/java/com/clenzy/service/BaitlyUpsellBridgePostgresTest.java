package com.clenzy.service;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import static org.assertj.core.api.Assertions.*;

/** Applique le vrai changeset avec Liquibase dans un schéma isolé. */
@EnabledIfSystemProperty(named="baitly.test.jdbc",matches="jdbc:postgresql:.*")
class BaitlyUpsellBridgePostgresTest {
    SingleConnectionDataSource source;
    JdbcTemplate db;
    String schema;
    Path directory;
    String resource(String name) throws Exception {
        try(var input=getClass().getResourceAsStream("/db/changelog/changes/"+name)) {
            return new String(input.readAllBytes(),StandardCharsets.UTF_8).replace("public.",schema+".")
                    .replace("pg_catalog, public","pg_catalog, "+schema);
        }
    }
    @BeforeEach void setup() throws Exception {
        source=new SingleConnectionDataSource(System.getProperty("baitly.test.jdbc"),"postgres","",true);
        db=new JdbcTemplate(source); schema="baitly_upsell_"+java.util.UUID.randomUUID().toString().replace("-","");
        db.execute("CREATE SCHEMA "+schema); db.execute("SET search_path TO "+schema);
        db.execute("CREATE TABLE marketplace_providers(id bigint PRIMARY KEY,user_id bigint)");
        db.execute("CREATE TABLE upsell_offers(id bigint PRIMARY KEY)");
        db.execute("CREATE TABLE upsell_types(code text,organization_id bigint,service_item_code text)");
        db.execute("CREATE TABLE marketplace_service_items(code text,active boolean,slot_required boolean)");
        db.execute("INSERT INTO marketplace_service_items VALUES('culinary-breakfast',true,true)");
        db.execute("INSERT INTO upsell_types VALUES('BREAKFAST',NULL,NULL)");
        db.execute("CREATE TABLE individual_calendars(user_id bigint,weekly_restricted boolean)");
        db.execute("CREATE TABLE individual_weekly_availability(user_id bigint,day_of_week smallint,start_time time,end_time time)");
        db.execute("CREATE TABLE individual_absences(user_id bigint,start_date date,end_date date)");
        db.execute("CREATE TABLE team_members(team_id bigint,user_id bigint)");
        db.execute("CREATE TABLE service_requests(id bigint,assigned_to_type text,assigned_to_id bigint,status text,assignment_phase text,desired_date timestamp,estimated_duration_hours int,service_item_code text)");
        db.execute("CREATE TABLE interventions(id bigint,team_id bigint,assigned_user_id bigint,service_request_id bigint,status text,scheduled_date timestamp,estimated_duration_hours int,service_item_code text)");
        db.execute("CREATE TABLE service_assignment_proposals(request_id bigint,status text,expires_at timestamptz)");
        var calendar=resource("0449__canonical_individual_calendar.sql");
        db.execute(calendar.substring(calendar.indexOf("CREATE OR REPLACE FUNCTION "+schema+".baitly_user_weekly_available"),
                calendar.indexOf("CREATE OR REPLACE FUNCTION "+schema+".baitly_team_declared_available")));
        db.execute(resource("0474__proposal_slot_reservations.sql"));
        directory=Files.createTempDirectory("baitly-upsell-liquibase-");
        Files.createDirectory(directory.resolve("changes"));
        Files.writeString(directory.resolve("changes/0544__upsell_provider_bridge.sql"),resource("0544__upsell_provider_bridge.sql"));
        try(var input=getClass().getResourceAsStream("/db/changelog/db.changelog-master.yaml")) {
            var master=new String(input.readAllBytes(),StandardCharsets.UTF_8);
            var start=master.indexOf("  - changeSet:\n      id: \"0544-upsell-provider-bridge\"");
            var end=master.indexOf("  - changeSet:", start + 16);
            assertThat(start).isGreaterThanOrEqualTo(0);
            Files.writeString(directory.resolve("changelog.yaml"),"databaseChangeLog:\n"+master.substring(start,end<0?master.length():end));
        }
        migrate();
        db.execute("INSERT INTO marketplace_providers VALUES(1,10),(2,NULL)");
    }
    void migrate() throws Exception {
        var migration=new liquibase.integration.spring.SpringLiquibase(); migration.setDataSource(source);
        migration.setDefaultSchema(schema); migration.setLiquibaseSchema(schema);
        migration.setChangeLog(directory.resolve("changelog.yaml").toUri().toString()); migration.afterPropertiesSet();
    }
    Boolean available(long provider,String time) {
        return db.queryForObject("SELECT baitly_provider_slot_available(?,CAST(? AS timestamp),CAST(? AS timestamp)+interval '1 hour')",
                Boolean.class,provider,"2026-10-15 "+time,"2026-10-15 "+time);
    }
    @Test void appliesOnceAndPreservesTheBridge() throws Exception {
        migrate();
        assertThat(db.queryForObject("SELECT count(*) FROM databasechangelog",Integer.class)).isEqualTo(1);
        assertThat(db.queryForObject("SELECT service_item_code FROM upsell_types WHERE code='BREAKFAST'",String.class)).isEqualTo("culinary-breakfast");
        db.execute("INSERT INTO upsell_offers VALUES(11,'culinary-breakfast',1)");
        assertThat(db.queryForObject("SELECT preferred_provider_id FROM upsell_offers",Long.class)).isEqualTo(1L);
        db.execute("DELETE FROM marketplace_providers WHERE id=1");
        assertThat(db.queryForObject("SELECT preferred_provider_id FROM upsell_offers",Long.class)).isNull();
    }
    @Test void checksWeeklyHoursAbsencesAndCrossOrganizationCommitments() {
        assertThat(available(2,"09:00")).isNull();
        assertThat(available(1,"09:00")).isTrue();
        db.execute("INSERT INTO individual_calendars VALUES(10,true)");
        db.execute("INSERT INTO individual_weekly_availability VALUES(10,4,'09:00','12:00')");
        assertThat(available(1,"13:00")).isFalse();
        db.execute("INSERT INTO individual_absences VALUES(10,'2026-10-15','2026-10-15')");
        assertThat(available(1,"09:00")).isFalse();
        db.execute("DELETE FROM individual_absences");
        db.execute("INSERT INTO service_requests VALUES(50,'user',10,'ASSIGNED',NULL,'2026-10-15 09:30',1,'culinary-breakfast')");
        assertThat(available(1,"09:00")).isFalse();
        assertThat(available(1,"11:00")).isTrue();
    }
    @AfterEach void cleanup() throws Exception {
        if(db!=null) { db.execute("DROP SCHEMA "+schema+" CASCADE"); source.destroy(); }
        if(directory!=null) try(var paths=Files.walk(directory)) { for(var path:paths.sorted(java.util.Comparator.reverseOrder()).toList()) Files.deleteIfExists(path); }
    }
}
