package com.baitly.iot;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.postgresql.ds.PGSimpleDataSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.dao.DataAccessException;
import liquibase.integration.spring.SpringLiquibase;
import org.springframework.boot.builder.SpringApplicationBuilder;
import static org.assertj.core.api.Assertions.*;

/** Provision and destroy only a randomly named database on the explicitly supplied disposable test cluster. */
@EnabledIfEnvironmentVariable(named = "BAITLY_IOT_TEST_DATABASE_URL", matches = ".+")
class RuntimeDatabaseGuardTest {
    @Test void whenRuntimeIsRestricted_thenIngestionWorksButDdlAndOtherTablesAreInaccessible() throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "");
        String database = "baitly_security_" + suffix;
        String role = "baitly_runtime_" + suffix;
        var bootstrap = dataSource(null, null, null);
        var admin = new JdbcTemplate(bootstrap);
        // A fresh PostgreSQL database grants CONNECT to PUBLIC. Remove that grant on the
        // disposable bootstrap DB while testing isolation, then restore its original state.
        String bootstrapDatabase = "\"" + bootstrap.getDatabaseName().replace("\"", "\"\"") + "\"";
        boolean publicConnect = Boolean.TRUE.equals(admin.queryForObject("""
                SELECT EXISTS (SELECT 1 FROM pg_database d,
                  LATERAL aclexplode(COALESCE(d.datacl, acldefault('d', d.datdba))) a
                  WHERE d.datname = current_database() AND a.grantee = 0 AND a.privilege_type = 'CONNECT')
                """, Boolean.class));
        admin.execute("CREATE ROLE " + role + " LOGIN PASSWORD '" + UUID.randomUUID() + "' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS");
        try {
            admin.execute("REVOKE CONNECT ON DATABASE " + bootstrapDatabase + " FROM PUBLIC");
            admin.execute("CREATE DATABASE " + database);
            try {
                var migrationSource = dataSource(database, null, null);
                var sql = new JdbcTemplate(migrationSource);
                var migration = new SpringLiquibase();
                migration.setDataSource(migrationSource);
                migration.setChangeLog("classpath:db/changelog/db.changelog-master.yaml");
                migration.afterPropertiesSet();
                sql.execute("REVOKE ALL ON DATABASE " + database + " FROM PUBLIC");
                sql.execute("GRANT CONNECT ON DATABASE " + database + " TO " + role);
                sql.execute("REVOKE ALL ON SCHEMA public FROM PUBLIC");
                sql.execute("GRANT USAGE ON SCHEMA public TO " + role);
                sql.execute("GRANT SELECT, INSERT, UPDATE ON baitly_iot_devices TO " + role);
                sql.execute("GRANT SELECT, INSERT ON baitly_iot_noise_measurements TO " + role);
                // Trust authentication is allowed only in the disposable local test cluster.
                // CI uses SCRAM and therefore needs the actual password too.
                String password = UUID.randomUUID().toString();
                sql.execute("ALTER ROLE " + role + " PASSWORD '" + password + "'");
                var runtimeSource = dataSource(database, role, password);
                var runtime = new JdbcTemplate(runtimeSource);
                var guard = new RuntimeDatabaseGuard(runtime, false);
                assertThatCode(guard::afterPropertiesSet).doesNotThrowAnyException();
                int internalPort;
                try (var socket = new java.net.ServerSocket(0)) { internalPort = socket.getLocalPort(); }
                try (var application = new SpringApplicationBuilder(BaitlyIotApplication.class).run(
                        "--spring.profiles.active=hardened", "--server.port=0",
                        "--baitly.iot.internal-port=" + internalPort,
                        "--spring.datasource.url=" + runtimeSource.getURL(),
                        "--spring.datasource.username=" + role,
                        "--spring.datasource.password=" + password,
                        "--baitly.iot.service-token=hardened-fixture-only-service-key-never-deploy")) {
                    assertThat(application.getEnvironment().getProperty("spring.liquibase.enabled", Boolean.class)).isFalse();
                    assertThat(application.getBean(RuntimeDatabaseGuard.class)).isNotNull();
                    var service = application.getBean(DeviceService.class);
                    var registered = service.register(1, new DeviceContracts.RegisterDevice(11, "Restricted runtime", 60));
                    var result = service.ingest(DeviceIdentity.http(registered.device().id(), new DeviceSecrets().hash(registered.token())),
                            new DeviceContracts.NoiseMeasurement(UUID.randomUUID(), java.time.Instant.now(), 10, 62.0));
                    assertThat(result.duplicate()).isFalse();
                    assertThat(runtime.queryForObject("SELECT count(*) FROM baitly_iot_noise_measurements", Integer.class)).isEqualTo(1);
                }
                runtime.update("INSERT INTO baitly_iot_devices (id,organization_id,property_id,name,token_hash,reporting_interval_seconds,created_at,mqtt_identity) VALUES (?,1,11,'Test',?,60,now(),?)",
                        UUID.randomUUID(), "a".repeat(64), "c".repeat(64));
                assertThat(runtime.queryForObject("SELECT count(*) FROM baitly_iot_devices", Integer.class)).isEqualTo(2);
                assertThatThrownBy(() -> runtime.execute("CREATE TABLE escape_attempt (id BIGINT)"))
                        .isInstanceOf(DataAccessException.class);
                assertThatThrownBy(() -> runtime.execute("DELETE FROM baitly_iot_devices"))
                        .isInstanceOf(DataAccessException.class);
                assertThatThrownBy(() -> runtime.queryForList("SELECT * FROM databasechangelog"))
                        .isInstanceOf(DataAccessException.class);
                sql.execute("CREATE TABLE pms_private_fixture (id BIGINT)");
                assertThatThrownBy(() -> runtime.queryForList("SELECT * FROM pms_private_fixture"))
                        .isInstanceOf(DataAccessException.class);
                sql.execute("GRANT SELECT ON pms_private_fixture TO " + role);
                assertThatThrownBy(guard::afterPropertiesSet).isInstanceOf(IllegalStateException.class);
                sql.execute("REVOKE SELECT ON pms_private_fixture FROM " + role);
                sql.execute("GRANT SELECT (id) ON pms_private_fixture TO " + role);
                assertThatThrownBy(guard::afterPropertiesSet).isInstanceOf(IllegalStateException.class);
                sql.execute("REVOKE SELECT (id) ON pms_private_fixture FROM " + role);
                sql.execute("ALTER ROLE " + role + " CREATEDB");
                assertThatThrownBy(guard::afterPropertiesSet).isInstanceOf(IllegalStateException.class);
                sql.execute("ALTER ROLE " + role + " NOCREATEDB");
                sql.execute("GRANT pg_read_server_files TO " + role);
                assertThatThrownBy(guard::afterPropertiesSet).isInstanceOf(IllegalStateException.class);
                sql.execute("REVOKE pg_read_server_files FROM " + role);
                sql.execute("GRANT UPDATE ON baitly_iot_noise_measurements TO " + role);
                assertThatThrownBy(guard::afterPropertiesSet).isInstanceOf(IllegalStateException.class);
                sql.execute("REVOKE UPDATE ON baitly_iot_noise_measurements FROM " + role);
                assertThatCode(guard::afterPropertiesSet).doesNotThrowAnyException();
            } finally {
                admin.execute("DROP DATABASE " + database + " WITH (FORCE)");
            }
        } finally {
            try { admin.execute("DROP ROLE " + role); }
            finally { if (publicConnect) admin.execute("GRANT CONNECT ON DATABASE " + bootstrapDatabase + " TO PUBLIC"); }
        }
    }

    private PGSimpleDataSource dataSource(String database, String role, String password) {
        var source = new PGSimpleDataSource();
        source.setURL(System.getenv("BAITLY_IOT_TEST_DATABASE_URL"));
        source.setUser(role == null ? System.getenv("BAITLY_IOT_TEST_DATABASE_USER") : role);
        source.setPassword(password == null ? System.getenv().getOrDefault("BAITLY_IOT_TEST_DATABASE_PASSWORD", "") : password);
        if (database != null) source.setDatabaseName(database);
        return source;
    }
}
