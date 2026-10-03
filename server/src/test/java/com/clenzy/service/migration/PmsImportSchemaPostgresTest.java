package com.clenzy.service.migration;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import java.nio.charset.StandardCharsets;
import java.sql.*;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

/** Executes the actual changeset on an isolated local scratch database, no Hibernate-generated schema. */
@EnabledIfSystemProperty(named = "baitly.import.test.jdbc", matches = "jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/baitly_import_test")
class PmsImportSchemaPostgresTest {
    @Test void changesetEnforcesTenantIsolationAndStableSourceKeys() throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "");
        String schema = "import_test_" + suffix;
        String role = "import_role_" + suffix;
        try (var connection = DriverManager.getConnection(System.getProperty("baitly.import.test.jdbc"), System.getProperty("user.name"), "")) {
            connection.setAutoCommit(false);
            try (var sql = connection.createStatement()) {
                sql.execute("CREATE SCHEMA " + schema);
                sql.execute("SET LOCAL search_path TO " + schema);
                // Existing FK targets use the names verified against the JPA entities/changelog.
                sql.execute("CREATE TABLE organizations(id BIGINT PRIMARY KEY); INSERT INTO organizations VALUES (1),(2)");
                sql.execute("CREATE TABLE reservations(id BIGINT PRIMARY KEY, organization_id BIGINT, property_id BIGINT, check_in DATE, check_out DATE, status TEXT, confirmation_code TEXT); "
                    + "INSERT INTO reservations VALUES (1,1,42,'2026-10-11','2026-10-13','confirmed','B1')");
                sql.execute("CREATE TABLE calendar_days(organization_id BIGINT, property_id BIGINT, date DATE, status TEXT); "
                    + "INSERT INTO calendar_days VALUES (1,42,'2026-10-11','BOOKED'),(2,43,'2026-10-11','BLOCKED')");
                try (var stream = getClass().getResourceAsStream("/db/changelog/changes/0491__pms_import_workspace.sql")) {
                    sql.execute(new String(stream.readAllBytes(), StandardCharsets.UTF_8));
                }
                try (var result = sql.executeQuery("SELECT migration_automation_paused FROM reservations WHERE id=1")) {
                    assertThat(result.next()).isTrue(); assertThat(result.getBoolean(1)).isFalse();
                }
                String ranges = "[{\"row_key\":\"overlap\",\"property_id\":42,\"date_from\":\"2026-10-10\",\"date_to\":\"2026-10-12\",\"status\":\"confirmed\",\"confirmation_code\":\"\"},"
                    + "{\"row_key\":\"touch\",\"property_id\":42,\"date_from\":\"2026-10-10\",\"date_to\":\"2026-10-11\",\"status\":\"confirmed\",\"confirmation_code\":\"\"},"
                    + "{\"row_key\":\"other-tenant\",\"property_id\":43,\"date_from\":\"2026-10-10\",\"date_to\":\"2026-10-12\",\"status\":\"confirmed\",\"confirmation_code\":\"\"}]";
                for (Class<?> repository : java.util.List.of(com.clenzy.repository.CalendarDayRepository.class, com.clenzy.repository.ReservationRepository.class)) {
                    String query = repository.getMethod("findPmsImportConflicts", String.class, Long.class)
                        .getAnnotation(org.springframework.data.jpa.repository.Query.class).value().replace(":ranges", "?").replace(":org", "?");
                    try (var statement = connection.prepareStatement(query)) {
                        statement.setString(1, ranges); statement.setLong(2, 1L);
                        try (var result = statement.executeQuery()) {
                            assertThat(result.next()).isTrue(); assertThat(result.getString(1)).isEqualTo("overlap");
                            assertThat(result.next()).isFalse();
                        }
                    }
                }
                sql.execute("CREATE ROLE " + role + " NOLOGIN");
                sql.execute("GRANT USAGE ON SCHEMA " + schema + " TO " + role);
                sql.execute("GRANT ALL ON ALL TABLES IN SCHEMA " + schema + " TO " + role);
                sql.execute("GRANT USAGE ON ALL SEQUENCES IN SCHEMA " + schema + " TO " + role);
                sql.execute("SET LOCAL ROLE " + role);
                sql.execute("SELECT set_config('app.current_org','1',true)");
                String batch = UUID.randomUUID().toString();
                sql.execute("INSERT INTO pms_import_batches(id,organization_id,created_by,source,source_account,payload,created_at) VALUES ('" + batch + "',1,'owner','pms','account','ciphertext',now())");
                sql.execute("INSERT INTO pms_import_bindings(organization_id,source_key,fingerprint,target_id,batch_id) VALUES (1,'key','hash',9,'" + batch + "')");
                var savepoint = connection.setSavepoint();
                assertThatThrownBy(() -> sql.execute("INSERT INTO pms_import_bindings(organization_id,source_key,fingerprint,target_id,batch_id) VALUES (1,'key','hash',10,'" + batch + "')"))
                    .isInstanceOf(SQLException.class).extracting(e -> ((SQLException)e).getSQLState()).isEqualTo("23505");
                connection.rollback(savepoint);
                sql.execute("SELECT set_config('app.current_org','2',true)");
                try (var result = sql.executeQuery("SELECT count(*) FROM pms_import_batches")) {
                    result.next(); assertThat(result.getInt(1)).isZero();
                }
                savepoint = connection.setSavepoint();
                assertThatThrownBy(() -> sql.execute("INSERT INTO pms_import_bindings(organization_id,source_key,fingerprint,target_id,batch_id) VALUES (1,'other','hash',11,'" + batch + "')"))
                    .isInstanceOf(SQLException.class).extracting(e -> ((SQLException)e).getSQLState()).isEqualTo("42501");
                connection.rollback(savepoint);
            } finally { connection.rollback(); }
        }
    }
}
