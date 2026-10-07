package com.clenzy.service.payout;

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

/** Vraie migration PostgreSQL, rejouée sans toucher aux bases ou conteneurs de développement. */
@EnabledIfSystemProperty(named = "baitly.test.jdbc", matches = "jdbc:postgresql://(localhost|127\\.0\\.0\\.1):.*")
class OwnerPayoutFundingLiquibaseTest {
    @Test void migrationPreservesHistoryAndEnforcesExclusiveTenantScopedClaims() throws Exception {
        String url = System.getProperty("baitly.test.jdbc");
        String user = System.getProperty("baitly.test.user", "postgres");
        String schema = "baitly_payout_" + UUID.randomUUID().toString().replace("-", "");
        String role = schema + "_reader";
        String scopedUrl = url + (url.contains("?") ? "&" : "?") + "currentSchema=" + schema;
        try (Connection admin = DriverManager.getConnection(url, user, ""); Statement sql = admin.createStatement()) {
            sql.execute("CREATE SCHEMA " + schema);
            sql.execute("CREATE ROLE " + role);
            try {
                try (Connection c = DriverManager.getConnection(scopedUrl, user, ""); Statement s = c.createStatement()) {
                    s.execute("CREATE TABLE owner_payouts(id bigint PRIMARY KEY, organization_id bigint, status text)");
                    s.execute("CREATE TABLE reservations(id bigint PRIMARY KEY)");
                    s.execute("INSERT INTO owner_payouts VALUES(1,7,'PAID'),(2,7,'PENDING'),(3,8,'PENDING')");
                    s.execute("INSERT INTO reservations VALUES(11),(12)");
                }
                migrate(scopedUrl, user);
                migrate(scopedUrl, user);
                try (Connection c = DriverManager.getConnection(scopedUrl, user, ""); Statement s = c.createStatement()) {
                    try (ResultSet rows = s.executeQuery("SELECT status,funding_version FROM owner_payouts WHERE id=1")) {
                        assertThat(rows.next()).isTrue();
                        assertThat(rows.getString(1)).isEqualTo("PAID");
                        assertThat(rows.getInt(2)).isZero();
                    }
                    try (ResultSet rows = s.executeQuery("SELECT count(*) FROM databasechangelog WHERE id='0493-owner-payout-funding'")) {
                        rows.next(); assertThat(rows.getInt(1)).isEqualTo(1);
                    }
                }
                assertConcurrentClaims(scopedUrl, user);
                sql.execute("GRANT USAGE ON SCHEMA " + schema + " TO " + role);
                sql.execute("GRANT SELECT, INSERT ON " + schema + ".owner_payout_reservations TO " + role);
                sql.execute("GRANT USAGE ON ALL SEQUENCES IN SCHEMA " + schema + " TO " + role);
                try (Connection c = DriverManager.getConnection(scopedUrl, user, ""); Statement s = c.createStatement()) {
                    s.execute("SET ROLE " + role);
                    s.execute("SET app.current_org='8'");
                    try (ResultSet rows = s.executeQuery("SELECT count(*) FROM owner_payout_reservations")) {
                        rows.next(); assertThat(rows.getInt(1)).isZero();
                    }
                    assertThatThrownBy(() -> s.execute(insert(12, 7, 2)))
                            .isInstanceOf(SQLException.class).extracting(e -> ((SQLException)e).getSQLState()).isEqualTo("42501");
                    s.execute("SET app.current_org='7'");
                    try (ResultSet rows = s.executeQuery("SELECT count(*) FROM owner_payout_reservations")) {
                        rows.next(); assertThat(rows.getInt(1)).isEqualTo(1);
                    }
                }
            } finally {
                sql.execute("DROP SCHEMA " + schema + " CASCADE");
                sql.execute("DROP ROLE " + role);
            }
        }
    }

    private void assertConcurrentClaims(String url, String user) throws Exception {
        try (Connection first = DriverManager.getConnection(url, user, "");
             Connection second = DriverManager.getConnection(url, user, "");
             Statement a = first.createStatement(); Statement b = second.createStatement()) {
            first.setAutoCommit(false); second.setAutoCommit(false);
            a.execute(insert(11, 7, 1));
            b.execute("SET LOCAL lock_timeout='150ms'");
            assertThatThrownBy(() -> b.execute(insert(11, 7, 2))).isInstanceOf(SQLException.class)
                    .extracting(e -> ((SQLException)e).getSQLState()).isEqualTo("55P03");
            second.rollback(); first.commit();
            assertThatThrownBy(() -> b.execute(insert(11, 7, 2))).isInstanceOf(SQLException.class)
                    .extracting(e -> ((SQLException)e).getSQLState()).isEqualTo("23505");
            second.rollback();
        }
    }

    private String insert(long stay, long org, long payout) {
        return "INSERT INTO owner_payout_reservations(reservation_id,organization_id,payout_id,collected_amount,currency,payment_transaction_ids) VALUES("
                + stay + "," + org + "," + payout + ",100,'EUR','[91]')";
    }

    private void migrate(String url, String user) throws Exception {
        try (Connection c = DriverManager.getConnection(url, user, "")) {
            var database = DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(c));
            var resources = new ClassLoaderResourceAccessor();
            try (var master = new Liquibase("db/changelog/db.changelog-master.yaml", resources, database)) {
                var selected = new DatabaseChangeLog("db/changelog/db.changelog-master.yaml");
                var change = master.getDatabaseChangeLog().getChangeSets().stream()
                        .filter(s -> s.getId().equals("0493-owner-payout-funding")).findFirst().orElseThrow();
                selected.addChangeSet(change);
                // Les deux instances partagent la connexion ; master la ferme une seule fois.
                var migration = new Liquibase(selected, resources, database);
                migration.update("");
            }
        }
    }
}
