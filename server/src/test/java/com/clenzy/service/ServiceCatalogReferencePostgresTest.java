package com.clenzy.service;

import com.clenzy.service.catalog.ServiceCatalogReference;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

import java.nio.charset.StandardCharsets;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

@EnabledIfSystemProperty(named="baitly.test.jdbc", matches="jdbc:postgresql:.*")
class ServiceCatalogReferencePostgresTest {
    SingleConnectionDataSource source;
    JdbcTemplate db;
    String schema;
    ServiceCatalogReference catalog;

    @BeforeEach void setup() throws Exception {
        source = new SingleConnectionDataSource(System.getProperty("baitly.test.jdbc"),
                System.getProperty("baitly.test.user", "postgres"), "", true);
        db = new JdbcTemplate(source);
        schema = "baitly_catalog_" + UUID.randomUUID().toString().replace("-", "");
        db.execute("CREATE SCHEMA " + schema);
        db.execute("SET search_path TO " + schema);
        db.execute("CREATE TABLE marketplace_service_categories(id bigint PRIMARY KEY,active boolean)");
        db.execute("INSERT INTO marketplace_service_categories VALUES(1,true)");
        db.execute("CREATE TABLE marketplace_service_items(code varchar(60) PRIMARY KEY,category_id bigint,active boolean DEFAULT true)");
        for (String code : new String[]{"cleaning-turnover","cleaning-deep","cleaning-windows","cleaning-disinfection",
                "maintenance-plumbing","maintenance-electrical","maintenance-hvac","maintenance-appliance",
                "maintenance-preventive","maintenance-emergency","exterior-garden","exterior-terrace","pest-insects","photo-new-service"}) {
            db.update("INSERT INTO marketplace_service_items(code,category_id) VALUES(?,1)", code);
        }
        db.execute("CREATE TABLE service_requests(id bigint PRIMARY KEY,organization_id bigint,service_type text)");
        db.execute("CREATE TABLE interventions(id bigint PRIMARY KEY,organization_id bigint,type text,service_request_id bigint)");
        db.execute("CREATE TABLE marketplace_quote_requests(intervention_id bigint,service_item_code text)");
        db.execute("INSERT INTO service_requests VALUES(1,7,'ELECTRICAL_REPAIR'),(2,7,'OTHER'),(3,8,'RESTORATION')");
        db.execute("INSERT INTO interventions VALUES(10,7,'PREVENTIVE_MAINTENANCE',1),(11,7,'OTHER',NULL),(12,7,'OTHER',NULL),(13,7,'CLEANING',NULL),(14,7,'PREVENTIVE_MAINTENANCE',2),(15,7,'CLEANING',NULL),(16,7,'OTHER',1)");
        db.execute("INSERT INTO marketplace_quote_requests VALUES(11,'photo-new-service'),(12,'photo-new-service'),(12,'maintenance-plumbing'),(15,'deleted-service'),(16,'maintenance-plumbing')");
        db.execute("INSERT INTO interventions VALUES(17,7,'CLEANING',NULL)");
        db.execute("INSERT INTO marketplace_quote_requests VALUES(17,'cleaning-turnover'),(17,'deleted-service')");
        try (var sql = getClass().getResourceAsStream("/db/changelog/changes/0461__canonical_service_references.sql")) {
            db.execute(new String(sql.readAllBytes(), StandardCharsets.UTF_8));
        }
        catalog = new ServiceCatalogReference(db);
    }

    @AfterEach void cleanup() { db.execute("DROP SCHEMA " + schema + " CASCADE"); source.destroy(); }

    String code(long id) { return db.queryForObject("SELECT service_item_code FROM interventions WHERE id=?",String.class,id); }

    @Test void specializedCleaningBackfillPreservesAgreementsAndExistingReferences() throws Exception {
        db.execute("ALTER TABLE marketplace_service_categories ADD code text");
        db.execute("UPDATE marketplace_service_categories SET code='CLEANING'");
        db.execute("ALTER TABLE marketplace_service_items ADD label_fr text,ADD label_en text,ADD sort_order integer");
        db.execute("ALTER TABLE service_requests ADD marketplace_request_id bigint");
        db.execute("INSERT INTO service_requests(id,organization_id,service_type) VALUES(20,7,'KITCHEN_CLEANING')");
        db.execute("INSERT INTO interventions(id,organization_id,type,service_request_id) VALUES(20,7,'KITCHEN_CLEANING',20),(21,7,'BATHROOM_CLEANING',NULL),(22,7,'FLOOR_CLEANING',NULL),(23,7,'BATHROOM_CLEANING',NULL)");
        db.execute("INSERT INTO marketplace_quote_requests VALUES(23,'cleaning-deep')");
        for (int repeat=0; repeat<2; repeat++) {
            try (var sql=getClass().getResourceAsStream("/db/changelog/changes/0472__precise_cleaning_references.sql")) {
                db.execute(new String(sql.readAllBytes(),StandardCharsets.UTF_8));
            }
        }
        assertThat(code(20)).isEqualTo("cleaning-kitchen");
        assertThat(code(21)).isEqualTo("cleaning-bathroom");
        assertThat(code(22)).isEqualTo("cleaning-floors");
        assertThat(code(23)).isNull();
        assertThat(code(11)).isEqualTo("photo-new-service");
        assertThat(db.queryForObject("SELECT count(*) FROM marketplace_service_items WHERE code IN ('cleaning-kitchen','cleaning-bathroom','cleaning-floors')",Integer.class)).isEqualTo(3);
    }

    @Test void migrationPreservesExactSourceInsteadOfGenericMissionType() {
        assertThat(code(10)).isEqualTo("maintenance-electrical");
        assertThat(code(11)).isEqualTo("photo-new-service");
        assertThat(code(13)).isEqualTo("cleaning-turnover");
        assertThat(code(14)).isNull();
    }

    @Test void contradictoryAndUnknownHistoryIsListedWithoutChoosingAService() {
        assertThat(code(12)).isNull();
        assertThat(code(15)).isNull();
        assertThat(code(17)).isNull();
        assertThat(db.queryForObject("SELECT service_item_code FROM service_requests WHERE id=3",String.class)).isNull();
        assertThat(db.queryForObject("SELECT reason FROM service_catalog_reference_issues WHERE source_type='INTERVENTION' AND source_id=16",String.class))
                .isEqualTo("SOURCE_MISMATCH");
        assertThat(db.queryForObject("SELECT organization_id FROM service_catalog_reference_issues WHERE source_type='SERVICE_REQUEST' AND source_id=3",Long.class)).isEqualTo(8L);
    }

    @Test void explicitCatalogEntryNeedsNoJavaEnumAndCannotConflictWithLegacyType() {
        assertThat(catalog.resolve("photo-new-service","OTHER",null,null)).isEqualTo("photo-new-service");
        assertThatThrownBy(() -> catalog.resolve("maintenance-electrical","CLEANING",null,null))
                .hasMessageContaining("contradictoires");
        assertThat(catalog.resolve(null,"ELECTRICAL_REPAIR",null,null)).isEqualTo("maintenance-electrical");
        assertThat(catalog.resolve(null,"RESTORATION",null,null)).isNull();
    }

    @Test void oldFormCannotErasePreciseReferenceAndInactiveHistoryRemainsReadable() {
        db.execute("UPDATE marketplace_service_items SET active=false WHERE code='photo-new-service'");
        assertThat(catalog.resolve(null,"OTHER","photo-new-service","OTHER")).isEqualTo("photo-new-service");
        assertThat(catalog.resolve("photo-new-service","OTHER","photo-new-service","OTHER")).isEqualTo("photo-new-service");
        assertThatThrownBy(() -> catalog.resolve("photo-new-service","OTHER",null,null)).hasMessageContaining("inactive");
        assertThatThrownBy(() -> catalog.resolve("missing","OTHER",null,null)).hasMessageContaining("inconnue");
    }

    @Test void deactivatedCategoryPreventsNewSelectionAndReferencesCannotDangle() {
        db.execute("UPDATE marketplace_service_categories SET active=false");
        assertThat(catalog.resolve(null,"CLEANING",null,null)).isNull();
        assertThatThrownBy(() -> catalog.resolve("photo-new-service","OTHER",null,null)).hasMessageContaining("inactive");
        assertThatThrownBy(() -> db.execute("UPDATE interventions SET service_item_code='missing' WHERE id=13"))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }
}
