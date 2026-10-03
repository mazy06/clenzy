package com.clenzy.service.paymentconnect;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import java.nio.charset.StandardCharsets;
import java.sql.*;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

/** Runs the migration SQL itself against a disposable local database, independently of Hibernate. */
@EnabledIfSystemProperty(named="baitly.payment.test.jdbc", matches="jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/baitly_payment_test")
class PaymentConnectionSchemaPostgresTest {
    @Test void migrationEnforcesTenantAndBeneficiaryConstraints() throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "");
        String schema = "payment_test_" + suffix, role = "payment_role_" + suffix;
        try (var db = DriverManager.getConnection(System.getProperty("baitly.payment.test.jdbc"), System.getProperty("user.name"), "")) {
            db.setAutoCommit(false);
            try (var sql = db.createStatement()) {
                sql.execute("CREATE SCHEMA " + schema);
                sql.execute("SET LOCAL search_path TO " + schema);
                sql.execute("CREATE TABLE organizations(id BIGINT PRIMARY KEY); INSERT INTO organizations VALUES(1),(2)");
                sql.execute("CREATE TABLE users(id BIGINT PRIMARY KEY); INSERT INTO users VALUES(42)");
                try (var file = getClass().getResourceAsStream("/db/changelog/changes/0492__payment_connections.sql")) {
                    sql.execute(new String(file.readAllBytes(), StandardCharsets.UTF_8));
                }
                sql.execute("CREATE ROLE " + role + " NOLOGIN");
                sql.execute("GRANT USAGE ON SCHEMA " + schema + " TO " + role);
                sql.execute("GRANT ALL ON ALL TABLES IN SCHEMA " + schema + " TO " + role);
                sql.execute("SET LOCAL ROLE " + role);
                sql.execute("SELECT set_config('app.current_org','1',true)");
                String insert = "INSERT INTO payment_connections(id,organization_id,beneficiary_key,user_id,country,provider,provider_account_id) VALUES ";
                sql.execute(insert + "('" + UUID.randomUUID() + "',1,'user:42',42,'FR','STRIPE','acct_one')");
                try (var result = sql.executeQuery("SELECT authorized, payouts_enabled, transfers_enabled FROM payment_connections")) {
                    assertThat(result.next()).isTrue(); assertThat(result.getBoolean(1)).isTrue();
                    assertThat(result.getBoolean(2)).isFalse(); assertThat(result.getBoolean(3)).isFalse();
                }
                var point = db.setSavepoint();
                assertThatThrownBy(() -> sql.execute(insert + "('" + UUID.randomUUID() + "',1,'user:42',42,'FR','STRIPE','acct_two')"))
                    .isInstanceOf(SQLException.class).extracting(e -> ((SQLException)e).getSQLState()).isEqualTo("23505");
                db.rollback(point);
                point = db.setSavepoint();
                assertThatThrownBy(() -> sql.execute(insert + "('" + UUID.randomUUID() + "',1,'organization',NULL,'FR','STRIPE','acct_one')"))
                    .isInstanceOf(SQLException.class).extracting(e -> ((SQLException)e).getSQLState()).isEqualTo("23505");
                db.rollback(point);
                sql.execute("SELECT set_config('app.current_org','2',true)");
                try (var result = sql.executeQuery("SELECT count(*) FROM payment_connections")) {
                    result.next(); assertThat(result.getInt(1)).isZero();
                }
                point = db.setSavepoint();
                assertThatThrownBy(() -> sql.execute(insert + "('" + UUID.randomUUID() + "',1,'organization',NULL,'FR','STRIPE','acct_three')"))
                    .isInstanceOf(SQLException.class).extracting(e -> ((SQLException)e).getSQLState()).isEqualTo("42501");
                db.rollback(point);
            } finally { db.rollback(); }
        }
    }
}
