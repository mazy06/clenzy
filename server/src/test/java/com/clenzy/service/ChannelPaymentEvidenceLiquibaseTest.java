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
import static org.assertj.core.api.Assertions.assertThat;

/** Valide le vrai changeset PostgreSQL sans modifier les réservations existantes. */
@EnabledIfSystemProperty(named = "baitly.test.jdbc", matches = "jdbc:postgresql://(localhost|127\\.0\\.0\\.1):.*")
class ChannelPaymentEvidenceLiquibaseTest {
    @Test void migrationPreservesHistoricalStatusesAndDoesNotFabricateEvidence() throws Exception {
        String url = System.getProperty("baitly.test.jdbc");
        String user = System.getProperty("baitly.test.user", "postgres");
        String schema = "baitly_channel_" + UUID.randomUUID().toString().replace("-", "");
        String scoped = url + (url.contains("?") ? "&" : "?") + "currentSchema=" + schema;
        try (Connection admin = DriverManager.getConnection(url, user, ""); Statement sql = admin.createStatement()) {
            sql.execute("CREATE SCHEMA " + schema);
            try {
                sql.execute("CREATE TABLE " + schema + ".reservations(id bigint PRIMARY KEY, payment_status varchar(30))");
                sql.execute("INSERT INTO " + schema + ".reservations VALUES(1,'PAID'),(2,'REFUNDED')");
                for (int pass = 0; pass < 2; pass++) {
                    try (Connection connection = DriverManager.getConnection(scoped, user, "")) {
                        var database = DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(connection));
                        var resources = new ClassLoaderResourceAccessor();
                        try (var master = new Liquibase("db/changelog/db.changelog-master.yaml", resources, database)) {
                            var selected = new DatabaseChangeLog("db/changelog/db.changelog-master.yaml");
                            selected.addChangeSet(master.getDatabaseChangeLog().getChangeSets().stream()
                                .filter(change -> change.getId().equals("0501-reservation-channel-payment-evidence")).findFirst().orElseThrow());
                            new Liquibase(selected, resources, database).update("");
                        }
                    }
                }
                try (ResultSet rows = sql.executeQuery("SELECT payment_status,channel_payment_collect,channel_payment_observed_at FROM " + schema + ".reservations ORDER BY id")) {
                    assertThat(rows.next()).isTrue();
                    assertThat(rows.getString(1)).isEqualTo("PAID");
                    assertThat(rows.getString(2)).isNull();
                    assertThat(rows.getTimestamp(3)).isNull();
                    assertThat(rows.next()).isTrue();
                    assertThat(rows.getString(1)).isEqualTo("REFUNDED");
                }
                try (ResultSet rows = sql.executeQuery("SELECT count(*) FROM " + schema + ".databasechangelog WHERE id='0501-reservation-channel-payment-evidence'")) {
                    rows.next(); assertThat(rows.getInt(1)).isEqualTo(1);
                }
            } finally { sql.execute("DROP SCHEMA " + schema + " CASCADE"); }
        }
    }
}
