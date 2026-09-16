package com.clenzy.service;

import com.clenzy.service.catalog.ServiceCatalogReference;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import java.nio.charset.StandardCharsets;
import static org.assertj.core.api.Assertions.*;

@EnabledIfSystemProperty(named="baitly.test.jdbc",matches="jdbc:postgresql:.*")
class ServiceExecutionPostgresTest {
    SingleConnectionDataSource source;
    JdbcTemplate db;
    String schema;
    @BeforeEach void setup() throws Exception {
        source=new SingleConnectionDataSource(System.getProperty("baitly.test.jdbc"),System.getProperty("baitly.test.user","postgres"),"",true);
        db=new JdbcTemplate(source); schema="baitly_execution_"+java.util.UUID.randomUUID().toString().replace("-","");
        db.execute("CREATE SCHEMA "+schema); db.execute("SET search_path TO "+schema);
        db.execute("CREATE TABLE marketplace_service_categories(id bigint PRIMARY KEY,code text,family text)");
        db.execute("INSERT INTO marketplace_service_categories VALUES(1,'ACCOUNTING','OWNER'),(2,'CLEANING','OPERATIONS')");
        db.execute("CREATE TABLE marketplace_service_items(code text PRIMARY KEY,category_id bigint)");
        db.execute("INSERT INTO marketplace_service_items VALUES('accounts',1),('cleaning',2)");
        db.execute("CREATE TABLE team_members(team_id bigint,user_id bigint)");
        db.execute("CREATE TABLE service_requests(id bigint,property_id bigint NOT NULL,service_item_code text,assigned_to_type text,assigned_to_id bigint,status text,desired_date timestamp,estimated_duration_hours integer)");
        db.execute("CREATE TABLE interventions(id bigint,property_id bigint NOT NULL,service_item_code text,team_id bigint,assigned_user_id bigint,service_request_id bigint,status text,scheduled_date timestamp,estimated_duration_hours integer)");
        execute("0465__service_execution_rules.sql");
        execute("0466__service_execution_reservations.sql");
    }
    void execute(String file) throws Exception {
        try(var stream=getClass().getResourceAsStream("/db/changelog/changes/"+file)) {
            db.execute(new String(stream.readAllBytes(),StandardCharsets.UTF_8).replace("public.",schema+".").replace("pg_catalog, public","pg_catalog, "+schema));
        }
    }
    @AfterEach void cleanup() { db.execute("DROP SCHEMA "+schema+" CASCADE"); source.destroy(); }
    @Test void catalogueControlsPlaceAndSlotWithoutCodeSwitches() {
        var catalog=new ServiceCatalogReference(db);
        assertThat(catalog.isRemote("accounts")).isTrue();
        assertThat(catalog.propertyOptional("accounts")).isTrue();
        assertThat(catalog.doesNotReserveSlot("accounts")).isTrue();
        assertThatCode(() -> catalog.requireLocation("accounts",null)).doesNotThrowAnyException();
        assertThatThrownBy(() -> catalog.requireLocation("cleaning",null)).hasMessageContaining("Logement requis");
        db.execute("INSERT INTO marketplace_service_items(code,category_id,execution_mode,property_required,slot_required) VALUES('new-service',1,'REMOTE',false,false)");
        assertThat(catalog.isRemote("new-service")).isTrue();
    }
    @Test void asynchronousNeedAndMissionNeverOccupyAnOnSiteSlot() {
        db.execute("INSERT INTO service_requests VALUES(1,null,'accounts','user',9,'ASSIGNED','2026-09-20 09:00',4)");
        db.execute("INSERT INTO interventions VALUES(1,null,'accounts',null,9,1,'IN_PROGRESS','2026-09-20 09:00',4)");
        assertThat(conflicts()).isFalse();
        db.execute("INSERT INTO interventions VALUES(2,10,'cleaning',null,9,null,'IN_PROGRESS','2026-09-20 09:00',4)");
        assertThat(conflicts()).isTrue();
        db.execute("UPDATE interventions SET status='COMPLETED' WHERE id=2");
        assertThat(conflicts()).isFalse();
    }
    @Test void executionAloneReservesAfterReplacementAndReleasesOnCompletion() {
        db.execute("INSERT INTO service_requests VALUES(1,10,'cleaning','user',9,'ASSIGNED','2026-09-20 09:00',4)");
        assertThat(conflicts()).isTrue();
        db.execute("INSERT INTO interventions VALUES(1,10,'cleaning',null,10,1,'IN_PROGRESS','2026-09-20 09:00',4)");
        assertThat(conflicts()).isFalse();
        assertThat(db.queryForObject("SELECT baitly_assignment_conflicts(0::bigint,0::bigint,'user',10::bigint,timestamp '2026-09-20 10:00',timestamp '2026-09-20 11:00')",Boolean.class)).isTrue();
        db.execute("UPDATE interventions SET status='COMPLETED' WHERE id=1");
        assertThat(conflicts()).isFalse();
    }

    @Test void commercialOriginBackfillPreservesTheExistingNeedAndRejectsDuplicateOrigins() throws Exception {
        db.execute("CREATE TABLE marketplace_quote_requests(id bigint PRIMARY KEY,intervention_id bigint)");
        db.execute("INSERT INTO service_requests VALUES(1,10,'cleaning',null,null,'PENDING','2026-09-20 09:00',4)");
        db.execute("INSERT INTO interventions VALUES(1,10,'cleaning',null,9,1,'IN_PROGRESS','2026-09-20 09:00',4)");
        db.execute("INSERT INTO marketplace_quote_requests VALUES(44,1)");
        execute("0468__commercial_service_need.sql");
        assertThat(db.queryForObject("SELECT marketplace_request_id FROM service_requests WHERE id=1",Long.class)).isEqualTo(44);
        assertThatThrownBy(() -> db.execute("INSERT INTO service_requests VALUES(2,10,'cleaning',null,null,'PENDING','2026-09-20 09:00',4,44)"))
            .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }

    @Test void historicalNeedsBackfillIsIdempotentAndNeverCopiesFinancialAmounts() throws Exception {
        db.execute("ALTER TABLE service_requests ADD is_urgent boolean");
        db.execute("CREATE TABLE marketplace_quote_requests(id bigint PRIMARY KEY,intervention_id bigint)");
        db.execute("ALTER TABLE service_requests ALTER COLUMN id SET NOT NULL");
        db.execute("ALTER TABLE service_requests ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY");
        db.execute("ALTER TABLE service_requests ADD organization_id bigint,ADD user_id bigint,ADD title text,ADD description text,ADD service_type text,ADD priority text,ADD auto_assign_status text,ADD created_at timestamp,ADD updated_at timestamp,ADD version bigint,ADD estimated_cost numeric");
        db.execute("ALTER TABLE interventions ADD organization_id bigint,ADD requestor_id bigint,ADD title text,ADD description text,ADD start_time timestamp,ADD created_at timestamp,ADD estimated_cost numeric");
        execute("0468__commercial_service_need.sql");
        db.execute("INSERT INTO service_requests(id,organization_id,service_item_code) VALUES(100,7,null)");
        db.execute("INSERT INTO interventions(id,property_id,service_item_code,service_request_id,status,scheduled_date,organization_id,requestor_id,title,estimated_cost) VALUES(1,10,'cleaning',null,'COMPLETED','2026-09-20 09:00',7,9,'Ménage',90),(2,10,null,null,'PENDING','2026-09-20 09:00',7,9,'À qualifier',90),(3,10,'cleaning',100,'PENDING','2026-09-20 09:00',7,9,'Liée',90)");
        db.execute("INSERT INTO marketplace_quote_requests VALUES(44,1)");
        execute("0470__historical_service_needs.sql");
        execute("0470__historical_service_needs.sql");
        // Reproduce the production-schema mismatch: SQL leaves this Java primitive null.
        assertThat(db.queryForObject("SELECT is_urgent FROM service_requests WHERE marketplace_request_id=44",Boolean.class)).isNull();
        execute("0471__service_request_urgent_invariant.sql");
        assertThat(db.queryForObject("SELECT is_urgent FROM service_requests WHERE marketplace_request_id=44",Boolean.class)).isFalse();
        assertThat(db.queryForObject("SELECT count(*) FROM service_requests",Integer.class)).isEqualTo(2);
        assertThat(db.queryForObject("SELECT status FROM service_requests WHERE marketplace_request_id=44",String.class)).isEqualTo("COMPLETED");
        assertThat(db.queryForObject("SELECT estimated_cost FROM service_requests WHERE marketplace_request_id=44",java.math.BigDecimal.class)).isNull();
        assertThat(db.queryForObject("SELECT service_request_id FROM interventions WHERE id=2",Long.class)).isNull();
        assertThat(db.queryForObject("SELECT service_request_id FROM interventions WHERE id=3",Long.class)).isEqualTo(100);
        assertThat(db.queryForObject("SELECT service_item_code FROM service_requests WHERE id=100",String.class)).isEqualTo("cleaning");
        assertThat(db.queryForObject("SELECT count(*) FROM service_requests WHERE assigned_to_id IS NOT NULL",Integer.class)).isZero();
    }
    @Test void urgencyRepairPreservesExplicitValuesAndEnforcesFutureWrites() throws Exception {
        db.execute("ALTER TABLE service_requests ADD is_urgent boolean");
        db.execute("INSERT INTO service_requests(id,is_urgent) VALUES(1,null),(2,true),(3,false)");
        execute("0471__service_request_urgent_invariant.sql");
        execute("0471__service_request_urgent_invariant.sql");
        assertThat(db.queryForList("SELECT is_urgent FROM service_requests ORDER BY id",Boolean.class))
            .containsExactly(false,true,false);
        db.execute("INSERT INTO service_requests(id) VALUES(4)");
        assertThat(db.queryForObject("SELECT is_urgent FROM service_requests WHERE id=4",Boolean.class)).isFalse();
        assertThatThrownBy(() -> db.execute("INSERT INTO service_requests(id,is_urgent) VALUES(5,null)"))
            .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        assertThatThrownBy(() -> db.execute("UPDATE service_requests SET is_urgent=null WHERE id=2"))
            .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }

    boolean conflicts() {
        return db.queryForObject("SELECT baitly_assignment_conflicts(0::bigint,0::bigint,'user',9::bigint,timestamp '2026-09-20 10:00',timestamp '2026-09-20 11:00')",Boolean.class);
    }
}
