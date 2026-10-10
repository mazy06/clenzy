package com.clenzy.service;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import static org.assertj.core.api.Assertions.*;

/** Vérifie le changeset réel et les évolutions du catalogue dans un schéma isolé. */
@EnabledIfSystemProperty(named="baitly.test.jdbc",matches="jdbc:postgresql:.*")
class BaitlyPaidServiceCatalogPostgresTest {
    SingleConnectionDataSource source;
    JdbcTemplate db;
    String schema;
    Path directory;
    @BeforeEach void setup() throws Exception {
        source=new SingleConnectionDataSource(System.getProperty("baitly.test.jdbc"),"postgres","",true);
        db=new JdbcTemplate(source); schema="baitly_types_"+java.util.UUID.randomUUID().toString().replace("-","");
        db.execute("CREATE SCHEMA "+schema); db.execute("SET search_path TO "+schema);
        db.execute("CREATE TABLE marketplace_service_categories(id bigint PRIMARY KEY,icon_key text,sort_order int,active boolean)");
        db.execute("CREATE TABLE marketplace_service_items(code text PRIMARY KEY,category_id bigint,label_fr text,label_en text,description text,sort_order int,active boolean)");
        db.execute("CREATE TABLE upsell_types(organization_id bigint,code text,label_fr text,label_en text,description text,icon_key text,service_item_code text,sort_order int,active boolean,system boolean,updated_at timestamp)");
        db.execute("CREATE UNIQUE INDEX uq_types ON upsell_types(COALESCE(organization_id,0),code)");
        db.execute("INSERT INTO marketplace_service_categories VALUES(1,'cleaning',1,true)");
        db.execute("INSERT INTO marketplace_service_items VALUES('cleaning-turnover',1,'Ménage entre deux séjours','Turnover cleaning',NULL,10,true)");
        db.execute("INSERT INTO upsell_types(organization_id,code,label_fr,system,active) VALUES(NULL,'CLEANING','Ménage',true,true),(7,'cleaning-turnover','Mon service',false,true)");
        directory=Files.createTempDirectory("baitly-types-liquibase-");
        try(var input=getClass().getResourceAsStream("/db/changelog/changes/0545__shared_paid_service_catalog.sql")) {
            Files.writeString(directory.resolve("catalog.sql"),new String(input.readAllBytes(),StandardCharsets.UTF_8)
                .replace("public.",schema+".").replace("pg_catalog, public","pg_catalog, "+schema));
        }
        Files.writeString(directory.resolve("changelog.yaml"),"databaseChangeLog:\n  - changeSet:\n      id: shared-catalog\n      author: baitly-test\n      changes:\n        - sqlFile:\n            path: catalog.sql\n            relativeToChangelogFile: true\n            splitStatements: false\n            stripComments: false\n");
        var migration=new liquibase.integration.spring.SpringLiquibase(); migration.setDataSource(source);
        migration.setDefaultSchema(schema); migration.setLiquibaseSchema(schema);
        migration.setChangeLog(directory.resolve("changelog.yaml").toUri().toString()); migration.afterPropertiesSet();
    }
    @Test void synchronizesPreciseReferencesAndPreservesOrganizationAndLegacyTypes() {
        assertThat(db.queryForObject("SELECT service_item_code FROM upsell_types WHERE code='cleaning-turnover' AND organization_id IS NULL",String.class)).isEqualTo("cleaning-turnover");
        db.execute("UPDATE marketplace_service_items SET label_fr='Nettoyage après départ' WHERE code='cleaning-turnover'");
        assertThat(db.queryForObject("SELECT label_fr FROM upsell_types WHERE code='cleaning-turnover' AND organization_id IS NULL",String.class)).isEqualTo("Nettoyage après départ");
        assertThat(db.queryForObject("SELECT label_fr FROM upsell_types WHERE organization_id=7",String.class)).isEqualTo("Mon service");
        assertThat(db.queryForObject("SELECT service_item_code FROM upsell_types WHERE code='CLEANING'",String.class)).isNull();
        db.execute("INSERT INTO marketplace_service_items VALUES('cleaning-mid-stay',1,'Ménage en cours de séjour','Mid-stay cleaning',NULL,20,true)");
        assertThat(db.queryForObject("SELECT service_item_code FROM upsell_types WHERE code='cleaning-mid-stay'",String.class)).isEqualTo("cleaning-mid-stay");
        db.execute("UPDATE marketplace_service_categories SET active=false WHERE id=1");
        assertThat(db.queryForObject("SELECT count(*) FROM upsell_types WHERE organization_id IS NULL AND NOT system AND active",Integer.class)).isZero();
        db.execute("UPDATE marketplace_service_categories SET active=true WHERE id=1");
        assertThat(db.queryForObject("SELECT count(*) FROM upsell_types WHERE organization_id IS NULL AND NOT system AND active",Integer.class)).isEqualTo(2);
        db.execute("DELETE FROM marketplace_service_items WHERE code='cleaning-mid-stay'");
        assertThat(db.queryForObject("SELECT active FROM upsell_types WHERE code='cleaning-mid-stay'",Boolean.class)).isFalse();
    }
    @AfterEach void cleanup() throws Exception {
        if(db!=null) { db.execute("DROP SCHEMA "+schema+" CASCADE"); source.destroy(); }
        if(directory!=null) try(var paths=Files.walk(directory)) { for(var path:paths.sorted(java.util.Comparator.reverseOrder()).toList()) Files.deleteIfExists(path); }
    }
}
