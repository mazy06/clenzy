package com.clenzy.service;

import liquibase.Liquibase;
import liquibase.changelog.DatabaseChangeLog;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import java.sql.*;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

/** Valide le vrai changeset PostgreSQL, y compris son second passage sans réapplication. */
@EnabledIfEnvironmentVariable(named="BAITLY_CAUTION_POSTGRES",matches="true")
class BaitlyCautionLiquibasePostgresIT {
    @Test void migrationPreservesHistoryAndDefaultsNewPropertyAmountsToZero() throws Exception {
        String base="jdbc:postgresql://127.0.0.1:55439/postgres";
        String schema="baitly_caution_migration_"+UUID.randomUUID().toString().replace("-","");
        try(var c=DriverManager.getConnection(base,"postgres","");var s=c.createStatement()) {s.execute("CREATE SCHEMA "+schema);}
        String url=base+"?currentSchema="+schema;
        try {
            try(var c=DriverManager.getConnection(url,"postgres","");var s=c.createStatement()) {
                s.execute("CREATE TABLE properties(id bigint primary key)");
                s.execute("CREATE TABLE reservations(id bigint primary key)");
                s.execute("CREATE TABLE security_deposits(id bigint primary key, status varchar(16) CHECK(status IN ('PENDING','HELD','RELEASED','CAPTURED','FAILED','EXPIRED')))");
                s.execute("INSERT INTO properties VALUES(1)");s.execute("INSERT INTO reservations VALUES(2)");
                s.execute("INSERT INTO security_deposits VALUES(3,'HELD')");
            }
            migrate(url);migrate(url);
            try(var c=DriverManager.getConnection(url,"postgres","");var s=c.createStatement()) {
                try(var r=s.executeQuery("SELECT security_deposit_amount FROM properties WHERE id=1")) {r.next();assertThat(r.getBigDecimal(1)).isZero();}
                try(var r=s.executeQuery("SELECT security_deposit_amount FROM reservations WHERE id=2")) {r.next();assertThat(r.getBigDecimal(1)).isNull();}
                try(var r=s.executeQuery("SELECT status FROM security_deposits WHERE id=3")) {r.next();assertThat(r.getString(1)).isEqualTo("HELD");}
                s.execute("UPDATE properties SET security_deposit_amount=300.25 WHERE id=1");
                s.execute("UPDATE security_deposits SET status='RELEASING' WHERE id=3");
                s.execute("UPDATE security_deposits SET status='CAPTURING', operation_amount=25, operation_reason='Recette' WHERE id=3");
                assertThatThrownBy(()->s.execute("UPDATE properties SET security_deposit_amount=-1 WHERE id=1")).isInstanceOf(SQLException.class);
                assertThatThrownBy(()->s.execute("UPDATE reservations SET security_deposit_amount=-1 WHERE id=2")).isInstanceOf(SQLException.class);
                assertThatThrownBy(()->s.execute("UPDATE security_deposits SET status='INVENTED' WHERE id=3")).isInstanceOf(SQLException.class);
                try(var r=s.executeQuery("SELECT count(*) FROM databasechangelog")) {r.next();assertThat(r.getInt(1)).isEqualTo(1);}
            }
        } finally {
            try(var c=DriverManager.getConnection(base,"postgres","");var s=c.createStatement()) {s.execute("DROP SCHEMA "+schema+" CASCADE");}
        }
    }
    void migrate(String url) throws Exception {
        try(var c=DriverManager.getConnection(url,"postgres","")) {
            var db=DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(c));
            var resources=new ClassLoaderResourceAccessor();
            try(var master=new Liquibase("db/changelog/db.changelog-master.yaml",resources,db)) {
                var selected=new DatabaseChangeLog("db/changelog/db.changelog-master.yaml");
                master.getDatabaseChangeLog().getChangeSets().stream().filter(s->s.getId().equals("0566-baitly-property-security-deposit")).forEach(selected::addChangeSet);
                assertThat(selected.getChangeSets()).hasSize(1);
                new Liquibase(selected,resources,db).update("");
            }
        }
    }
}
