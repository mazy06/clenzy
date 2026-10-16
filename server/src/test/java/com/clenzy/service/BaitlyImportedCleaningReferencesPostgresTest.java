package com.clenzy.service;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import static org.assertj.core.api.Assertions.*;

/** Applique la réparation réelle avec le trigger tarifaire de production, dans un schéma jetable. */
@EnabledIfSystemProperty(named="baitly.test.jdbc",matches="jdbc:postgresql:.*")
class BaitlyImportedCleaningReferencesPostgresTest {
    SingleConnectionDataSource source; JdbcTemplate db; String schema; Path directory;
    String sql(String filename) throws Exception {
        try(var input=getClass().getResourceAsStream("/db/changelog/changes/"+filename)) {
            return new String(input.readAllBytes(),StandardCharsets.UTF_8).replace("public.",schema+".")
                .replace("pg_catalog,public","pg_catalog,"+schema);
        }
    }
    @BeforeEach void setup() throws Exception {
        source=new SingleConnectionDataSource(System.getProperty("baitly.test.jdbc"),"postgres","",true);
        db=new JdbcTemplate(source);schema="baitly_reference_"+java.util.UUID.randomUUID().toString().replace("-","");
        db.execute("CREATE SCHEMA "+schema);db.execute("SET search_path TO "+schema);
        db.execute("CREATE TABLE users(id bigint PRIMARY KEY,role text)");
        db.execute("CREATE TABLE marketplace_providers(id bigint PRIMARY KEY,user_id bigint,headline text)");
        db.execute("CREATE TABLE marketplace_service_categories(id bigint PRIMARY KEY,code text)");
        db.execute("CREATE TABLE marketplace_service_items(id bigint PRIMARY KEY,category_id bigint,code text,active boolean)");
        db.execute("CREATE TABLE provider_tariffs(id bigint PRIMARY KEY,user_id bigint,service_key text,pricing_model text,amount numeric,currency text,unit_label text,UNIQUE(user_id,service_key))");
        db.execute("CREATE TABLE marketplace_provider_services(id bigint PRIMARY KEY,provider_id bigint,category_id bigint,service_item_id bigint,tariff_id bigint,label text,amount numeric,pricing_model text DEFAULT 'ON_QUOTE',currency text DEFAULT 'EUR',unit_label text)");
        db.execute("CREATE TABLE provider_tariff_migration_archive(source_table text,source_id bigint,payload jsonb,UNIQUE(source_table,source_id))");
        db.execute("INSERT INTO marketplace_service_categories VALUES(1,'CLEANING')");
        db.execute("INSERT INTO marketplace_service_items VALUES(1,1,'cleaning-turnover',true),(2,1,'cleaning-deep',true)");
        for(int index=1;index<=5;index++) {
            db.update("INSERT INTO users VALUES(?,'HOUSEKEEPER')",index);
            db.update("INSERT INTO marketplace_providers VALUES(?,?,?)",index,index,index==3 ? "Offre personnalisée" : "Ménage entre deux séjours");
            db.update("INSERT INTO provider_tariffs VALUES(?,?,?,'HOURLY',35,'EUR',NULL)",index,index,index==5 ? "cleaning-deep" : "custom:1:prestation à l’heure");
            db.update("INSERT INTO marketplace_provider_services(id,provider_id,category_id,tariff_id,label) VALUES(?,?,1,?,'Prestation à l’heure')",index,index,index);
            if(index!=2) db.update("INSERT INTO provider_tariff_migration_archive VALUES('housekeeper_rates',?,jsonb_build_object('user_id',?,'property_id',NULL))",index,index);
        }
        db.execute("INSERT INTO provider_tariffs VALUES(44,4,'cleaning-turnover','FLAT',80,'EUR',NULL)");
        db.execute("CREATE FUNCTION "+schema+".baitly_offer_tariff_key(bigint,bigint,text) RETURNS text LANGUAGE sql AS 'SELECT COALESCE((SELECT code FROM marketplace_service_items WHERE id=$1),''custom:''||$2::text||'':''||lower(btrim($3)))'");
        String original=sql("0451__canonical_provider_tariffs.sql");
        db.execute(original.substring(original.indexOf("CREATE FUNCTION "+schema+".baitly_attach_offer_tariff()"),original.indexOf("CREATE FUNCTION "+schema+".baitly_activate_provider_tariffs()")));
        directory=Files.createTempDirectory("baitly-reference-liquibase-");
        Files.writeString(directory.resolve("repair.sql"),sql("0546__repair_imported_cleaning_service_references.sql"));
        Files.writeString(directory.resolve("changelog.yaml"),"databaseChangeLog:\n  - changeSet:\n      id: repair-references\n      author: baitly-test\n      changes:\n        - sqlFile:\n            path: repair.sql\n            relativeToChangelogFile: true\n            splitStatements: false\n            stripComments: false\n");
        var migration=new liquibase.integration.spring.SpringLiquibase();migration.setDataSource(source);
        migration.setDefaultSchema(schema);migration.setLiquibaseSchema(schema);
        migration.setChangeLog(directory.resolve("changelog.yaml").toUri().toString());migration.afterPropertiesSet();
    }
    @Test void repairsOnlyProvenLegacyReferencesAndPreservesPricesAndCustomServices() {
        assertThat(db.queryForObject("SELECT service_item_id FROM marketplace_provider_services WHERE id=1",Long.class)).isEqualTo(1L);
        assertThat(db.queryForObject("SELECT service_key FROM provider_tariffs WHERE id=1",String.class)).isEqualTo("cleaning-turnover");
        assertThat(db.queryForObject("SELECT amount FROM provider_tariffs WHERE id=1",java.math.BigDecimal.class)).isEqualByComparingTo("35");
        assertThat(db.queryForObject("SELECT pricing_model FROM provider_tariffs WHERE id=1",String.class)).isEqualTo("HOURLY");
        assertThat(db.queryForObject("SELECT count(*) FROM marketplace_provider_services WHERE id IN (2,3,4) AND service_item_id IS NULL",Integer.class)).isEqualTo(3);
        assertThat(db.queryForObject("SELECT amount FROM provider_tariffs WHERE id=44",java.math.BigDecimal.class)).isEqualByComparingTo("80");
        assertThat(db.queryForObject("SELECT service_item_id FROM marketplace_provider_services WHERE id=5",Long.class)).isEqualTo(2L);
        assertThat(db.queryForObject("SELECT payload->>'service_key' FROM provider_tariff_migration_archive WHERE source_table='baitly_service_reference_0546'",String.class)).isEqualTo("custom:1:prestation à l’heure");
    }
    @AfterEach void cleanup() throws Exception {
        if(db!=null){db.execute("DROP SCHEMA "+schema+" CASCADE");source.destroy();}
        if(directory!=null)try(var paths=Files.walk(directory)){for(var p:paths.sorted(java.util.Comparator.reverseOrder()).toList())Files.deleteIfExists(p);}
    }
}
