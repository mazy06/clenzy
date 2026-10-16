package com.clenzy.integration.baitlyiot;

import java.nio.charset.StandardCharsets;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.UUID;
import liquibase.integration.spring.SpringLiquibase;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import static org.assertj.core.api.Assertions.*;

@EnabledIfEnvironmentVariable(named = "BAITLY_IOT_TEST_DATABASE_URL", matches = ".+")
class BaitlyIotMigrationTest {
    @Test
    void whenMigrationRunsOnLegacyNoiseTable_thenExistingRowsSurviveAndBaitlyIdsAreUnique() throws Exception {
        String schema = "baitly_migration_" + UUID.randomUUID().toString().replace("-", "");
        try (var connection = DriverManager.getConnection(System.getenv("BAITLY_IOT_TEST_DATABASE_URL"),
                System.getenv("BAITLY_IOT_TEST_DATABASE_USER"),
                System.getenv().getOrDefault("BAITLY_IOT_TEST_DATABASE_PASSWORD", ""));
             var sql = connection.createStatement()) {
            sql.execute("CREATE SCHEMA " + schema);
            connection.setSchema(schema);
            try {
                sql.execute("CREATE TABLE properties (id BIGINT PRIMARY KEY)");
                sql.execute("INSERT INTO properties VALUES (11)");
                String baseline;
                try (var input = new ClassPathResource("db/changelog/changes/0036__create_noise_monitoring_tables.sql").getInputStream()) {
                    baseline = new String(input.readAllBytes(), StandardCharsets.UTF_8);
                }
                sql.execute(baseline.substring(baseline.indexOf("CREATE TABLE noise_devices"),
                        baseline.indexOf("CREATE INDEX idx_noise_device_user_id")));
                // The existing 0274 migration removes this constraint before 0561 in the PMS.
                sql.execute("ALTER TABLE noise_devices DROP CONSTRAINT noise_devices_device_type_check");
                sql.execute("INSERT INTO noise_devices (user_id,device_type,name,property_id) VALUES ('host','MINUT','Existing',11)");
                var migration = new SpringLiquibase();
                migration.setDataSource(new SingleConnectionDataSource(connection, true));
                migration.setDefaultSchema(schema);
                migration.setChangeLog("classpath:db/baitly-iot-migration-test.yaml");
                migration.afterPropertiesSet();
                try (var result = sql.executeQuery("SELECT simulation FROM noise_devices WHERE name='Existing'")) {
                    assertThat(result.next()).isTrue(); assertThat(result.getBoolean(1)).isFalse();
                }
                String insert = "INSERT INTO noise_devices (user_id,device_type,name,property_id,external_device_id,simulation) "
                        + "VALUES ('host','BAITLY','Test',11,'unique-baitly-device',TRUE)";
                sql.execute(insert);
                assertThatThrownBy(() -> sql.execute(insert)).isInstanceOf(SQLException.class);
            } finally {
                connection.setSchema("public");
                sql.execute("DROP SCHEMA " + schema + " CASCADE");
            }
        }
    }
}
