package com.clenzy.service;

import liquibase.Liquibase;
import liquibase.changelog.DatabaseChangeLog;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import java.sql.*;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

/** Exécute le changeset réel, dans un schéma temporaire PostgreSQL sans données applicatives. */
@EnabledIfSystemProperty(named="baitly.test.jdbc",matches="jdbc:postgresql://127\\.0\\.0\\.1:55440/postgres")
class BaitlyPaidServiceMigrationPostgresTest {
    @Test void preservesHistoricSalesAndEnforcesTheUniqueRequestLink() throws Exception {
        String base=System.getProperty("baitly.test.jdbc");
        String schema="baitly_paid_service_"+UUID.randomUUID().toString().replace("-","");
        try(var c=DriverManager.getConnection(base,"postgres","");var s=c.createStatement()) {s.execute("CREATE SCHEMA "+schema);}
        String url=base+"?currentSchema="+schema;
        try {
            try(var c=DriverManager.getConnection(url,"postgres","");var s=c.createStatement()) {
                s.execute("CREATE TABLE upsell_orders(id bigint PRIMARY KEY, title varchar(200))");
                s.execute("CREATE TABLE service_requests(id bigint PRIMARY KEY)");
                s.execute("INSERT INTO upsell_orders VALUES(1,'Vente historique'),(2,'Autre vente')");
                s.execute("INSERT INTO service_requests VALUES(90)");
            }
            migrate(url); migrate(url);
            try(var c=DriverManager.getConnection(url,"postgres","");var s=c.createStatement()) {
                try(var rows=s.executeQuery("SELECT title,fulfillment_service_code,service_request_id FROM upsell_orders WHERE id=1")) {
                    rows.next(); assertThat(rows.getString(1)).isEqualTo("Vente historique");
                    assertThat(rows.getString(2)).isNull(); assertThat(rows.getObject(3)).isNull();
                }
                s.execute("UPDATE upsell_orders SET fulfillment_service_code='cleaning-mid-stay',service_request_id=90 WHERE id=1");
                assertThatThrownBy(() -> s.execute("UPDATE upsell_orders SET service_request_id=90 WHERE id=2")).isInstanceOf(SQLException.class);
                assertThatThrownBy(() -> s.execute("UPDATE upsell_orders SET service_request_id=999 WHERE id=2")).isInstanceOf(SQLException.class);
                assertThatThrownBy(() -> s.execute("DELETE FROM service_requests WHERE id=90")).isInstanceOf(SQLException.class);
                try(var rows=s.executeQuery("SELECT count(*) FROM databasechangelog")) {rows.next();assertThat(rows.getInt(1)).isEqualTo(1);}
            }
        } finally {
            try(var c=DriverManager.getConnection(base,"postgres","");var s=c.createStatement()) {s.execute("DROP SCHEMA "+schema+" CASCADE");}
        }
    }
    private void migrate(String url) throws Exception {
        try(var c=DriverManager.getConnection(url,"postgres","")) {
            var db=DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(c));
            var resources=new ClassLoaderResourceAccessor();
            try(var master=new Liquibase("db/changelog/db.changelog-master.yaml",resources,db)) {
                var selected=new DatabaseChangeLog("db/changelog/db.changelog-master.yaml");
                master.getDatabaseChangeLog().getChangeSets().stream().filter(s -> s.getId().equals("0567-baitly-paid-service-execution")).forEach(selected::addChangeSet);
                assertThat(selected.getChangeSets()).hasSize(1);
                new Liquibase(selected,resources,db).update("");
            }
        }
    }
}
