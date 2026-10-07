package com.clenzy.service.export;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

import java.nio.charset.StandardCharsets;
import java.sql.*;
import java.util.*;

import static org.assertj.core.api.Assertions.*;

/** Runs the export SQL and the 0493 changeset on an isolated local scratch database. */
@EnabledIfSystemProperty(named = "baitly.import.test.jdbc", matches = "jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/baitly_import_test")
class AccountExportPostgresTest {
    private static final AccountExportService.Scope HOST = new AccountExportService.Scope(1L, "owner", false);

    @Test void hostScopedRawExportSkipsOtherPropertiesTenantsAndSecrets() throws Exception {
        String schema = "export_test_" + UUID.randomUUID().toString().replace("-", "");
        try (var connection = DriverManager.getConnection(System.getProperty("baitly.import.test.jdbc"), System.getProperty("user.name"), "")) {
            connection.setAutoCommit(false);
            try (var sql = connection.createStatement()) {
                sql.execute("CREATE SCHEMA " + schema);
                sql.execute("SET LOCAL search_path TO " + schema);
                sql.execute("CREATE TABLE reservations(id BIGINT PRIMARY KEY, organization_id BIGINT, property_id BIGINT, guest_name TEXT, stripe_session_id TEXT, total NUMERIC(10,2), check_in DATE)");
                sql.execute("INSERT INTO reservations VALUES (1,1,42,'Salma','cs_1',120.30,'2026-10-10'),(2,1,43,'Other owner',null,80,'2026-10-11'),(3,2,42,'Other tenant',null,50,'2026-10-12')");
                sql.execute("CREATE TABLE conversations(id BIGINT PRIMARY KEY, organization_id BIGINT, property_id BIGINT)");
                sql.execute("INSERT INTO conversations VALUES (10,1,42),(11,1,43)");
                sql.execute("CREATE TABLE conversation_messages(id BIGINT PRIMARY KEY, organization_id BIGINT, conversation_id BIGINT, content TEXT, data BYTEA)");
                sql.execute("INSERT INTO conversation_messages VALUES (100,1,10,'Bonjour',null),(101,1,11,'Privé',null)");
                assertThat(rows(connection, schema, "reservations")).containsExactly(
                    Map.of("id", "1", "organization_id", "1", "property_id", "42", "guest_name", "Salma", "total", "120.30", "check_in", "2026-10-10"));
                assertThat(rows(connection, schema, "conversation_messages")).extracting(r -> r.get("content")).containsExactly("Bonjour");
            }
            connection.rollback();
        }
    }

    @Test void migrationPlansAreTenantIsolatedAndUniquePerUser() throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "");
        String schema = "plan_test_" + suffix, role = "plan_role_" + suffix;
        try (var connection = DriverManager.getConnection(System.getProperty("baitly.import.test.jdbc"), System.getProperty("user.name"), "")) {
            connection.setAutoCommit(false);
            try (var sql = connection.createStatement()) {
                sql.execute("CREATE SCHEMA " + schema);
                sql.execute("SET LOCAL search_path TO " + schema);
                sql.execute("CREATE TABLE organizations(id BIGINT PRIMARY KEY); INSERT INTO organizations VALUES (1),(2)");
                try (var stream = getClass().getResourceAsStream("/db/changelog/changes/0493__pms_migration_plans.sql")) {
                    sql.execute(new String(stream.readAllBytes(), StandardCharsets.UTF_8));
                }
                sql.execute("CREATE ROLE " + role + " NOLOGIN");
                sql.execute("GRANT USAGE ON SCHEMA " + schema + " TO " + role);
                sql.execute("GRANT ALL ON ALL TABLES IN SCHEMA " + schema + " TO " + role);
                sql.execute("SET LOCAL ROLE " + role);
                sql.execute("SELECT set_config('app.current_org','1',true)");
                sql.execute("INSERT INTO pms_migration_plans(id,organization_id,created_by,notice_days,updated_at) VALUES (gen_random_uuid(),1,'owner',30,now())");
                var savepoint = connection.setSavepoint();
                assertThatThrownBy(() -> sql.execute("INSERT INTO pms_migration_plans(id,organization_id,created_by,updated_at) VALUES (gen_random_uuid(),1,'owner',now())"))
                    .isInstanceOf(SQLException.class).extracting(e -> ((SQLException) e).getSQLState()).isEqualTo("23505");
                connection.rollback(savepoint);
                assertThatThrownBy(() -> sql.execute("INSERT INTO pms_migration_plans(id,organization_id,created_by,updated_at) VALUES (gen_random_uuid(),2,'x',now())"))
                    .isInstanceOf(SQLException.class);
                connection.rollback(savepoint);
                sql.execute("SELECT set_config('app.current_org','2',true)");
                try (var result = sql.executeQuery("SELECT count(*) FROM pms_migration_plans")) {
                    result.next(); assertThat(result.getInt(1)).isZero();
                }
            }
            connection.rollback();
        }
    }

    private static List<Map<String, String>> rows(Connection connection, String schema, String table) throws SQLException {
        List<Object[]> columns = new ArrayList<>();
        try (var statement = connection.prepareStatement("select column_name, data_type from information_schema.columns "
            + "where table_schema = ? and table_name = ? order by ordinal_position")) {
            statement.setString(1, schema); statement.setString(2, table);
            try (var result = statement.executeQuery()) { while (result.next()) columns.add(new Object[]{result.getString(1), result.getString(2)}); }
        }
        Set<String> names = new HashSet<>();
        columns.forEach(c -> names.add((String) c[0]));
        List<String> kept = AccountExportService.keptColumns(columns);
        String filter = AccountExportService.scopeFilter(table, names, HOST, List.of(42L));
        String sql = AccountExportService.rawSelect(table, kept, filter, true).replace(":org", "1").replace(":ids", "42");
        List<Map<String, String>> rows = new ArrayList<>();
        try (var statement = connection.createStatement(); var result = statement.executeQuery(sql)) {
            while (result.next()) {
                Map<String, String> row = new LinkedHashMap<>();
                for (int i = 0; i < kept.size(); i++) row.put(kept.get(i), result.getString(i + 1));
                rows.add(row);
            }
        }
        return rows;
    }
}
