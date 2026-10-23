package com.clenzy.service;

import com.clenzy.model.NoiseDevice.DeviceType;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.UUID;
import java.util.concurrent.*;

import static org.assertj.core.api.Assertions.*;

/** SQL reel ; H2 local, PostgreSQL dedie obligatoire dans la recette CI. */
class BaitlyNoiseStatusPersistenceTest {
    static JdbcTemplate db, admin;
    static String schema;
    static BaitlyNoiseStatusWriter writer;
    static TransactionTemplate outer;
    final LocalDateTime previous = LocalDateTime.of(2026, 10, 22, 10, 0);
    final LocalDateTime observed = previous.plusMinutes(1);

    @BeforeAll static void start() {
        String jdbc = System.getProperty("baitly.test.jdbc");
        var ds = new DriverManagerDataSource();
        if (jdbc == null) {
            ds.setUrl("jdbc:h2:mem:baitly_noise_status;MODE=PostgreSQL;DB_CLOSE_DELAY=-1");
            ds.setUsername("sa");
            ds.setPassword("");
        } else {
            if (!validRecipeJdbc(jdbc))
                throw new IllegalArgumentException("Base de recette dediee requise");
            ds.setUrl(jdbc);
            ds.setUsername(System.getProperty("baitly.test.user", "postgres"));
            ds.setPassword(System.getProperty("baitly.test.password", ""));
            admin = new JdbcTemplate(ds);
            schema = "baitly_noise_status_" + UUID.randomUUID().toString().replace("-", "");
            admin.execute("CREATE SCHEMA " + schema);
            ds = new DriverManagerDataSource(jdbc + "?currentSchema=" + schema, ds.getUsername(), ds.getPassword());
        }
        db = new JdbcTemplate(ds);
        db.execute("""
            CREATE TABLE noise_devices (
                id BIGINT PRIMARY KEY, organization_id BIGINT NOT NULL, property_id BIGINT NOT NULL,
                device_type VARCHAR(10) NOT NULL, external_device_id VARCHAR(255),
                status VARCHAR(20) NOT NULL, simulation BOOLEAN NOT NULL DEFAULT false,
                online BOOLEAN, last_seen_at TIMESTAMP, updated_at TIMESTAMP,
                name VARCHAR(255), room_name VARCHAR(255), user_id VARCHAR(255))
            """);
        var manager = new DataSourceTransactionManager(ds);
        writer = new BaitlyNoiseStatusWriter(db, manager);
        outer = new TransactionTemplate(manager);
    }

    static boolean validRecipeJdbc(String jdbc) {
        return jdbc != null && jdbc.matches("jdbc:postgresql://(?:127\\.0\\.0\\.1|localhost):[0-9]+/[a-zA-Z0-9_]+")
            && (jdbc.matches(".*[/_](?:test|recipe|ci)(?:_.*)?$")
                || jdbc.equals("jdbc:postgresql://127.0.0.1:55439/postgres"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"jdbc:postgresql://127.0.0.1:5432/baitly_test",
        "jdbc:postgresql://localhost:5432/baitly_recipe", "jdbc:postgresql://127.0.0.1:55439/postgres"})
    void isolatedRecipeUrlsAreAccepted(String jdbc) {
        assertThat(validRecipeJdbc(jdbc)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"jdbc:postgresql://prod.example:5432/baitly_test",
        "jdbc:postgresql://localhost:5432/clenzy", "jdbc:postgresql://127.0.0.1:5432/postgres",
        "jdbc:postgresql://localhost:5432/baitly_test?password=synthetic"})
    void businessRemoteAndCredentialUrlsAreRefused(String jdbc) {
        assertThat(validRecipeJdbc(jdbc)).isFalse();
    }

    @AfterAll static void close() {
        if (schema != null) admin.execute("DROP SCHEMA " + schema + " CASCADE");
    }

    @BeforeEach void fixture() {
        db.update("DELETE FROM noise_devices");
        db.update("""
            INSERT INTO noise_devices
            (id,organization_id,property_id,device_type,external_device_id,status,simulation,
             online,last_seen_at,updated_at,name,room_name,user_id)
            VALUES (1,7,11,'MINUT','synthetic-device','ACTIVE',false,true,?,?,'old','room','synthetic-owner')
            """, Timestamp.valueOf(previous), Timestamp.valueOf(previous));
    }

    BaitlyNoiseStatusWriter.Snapshot snapshot() {
        return new BaitlyNoiseStatusWriter.Snapshot(1L,7L,11L,DeviceType.MINUT,"synthetic-device",true,previous);
    }

    void refused(Runnable action) {
        assertThatThrownBy(action::run).hasMessage("Actualisation du capteur non confirmee")
            .hasNoCause().satisfies(error -> assertThat(error.getSuppressed()).isEmpty());
    }

    @Test void partialWritePreservesMetadataChangedDuringHttp() {
        db.update("UPDATE noise_devices SET name='new', room_name='new room', user_id='new owner' WHERE id=1");
        writer.record(snapshot(), false, observed);
        var row = db.queryForMap("SELECT * FROM noise_devices WHERE id=1");
        assertThat(row).containsEntry("online", false).containsEntry("name", "new")
            .containsEntry("room_name", "new room").containsEntry("user_id", "new owner");
        assertThat(db.queryForObject("SELECT last_seen_at FROM noise_devices WHERE id=1", Timestamp.class).toLocalDateTime()).isEqualTo(observed);
    }

    @ParameterizedTest @ValueSource(strings = {"organization", "property", "external", "type", "inactive", "simulation", "online", "time", "deleted"})
    void changedScopeOrEpisodeCannotBeOverwritten(String mutation) {
        switch (mutation) {
            case "organization" -> db.update("UPDATE noise_devices SET organization_id=8 WHERE id=1");
            case "property" -> db.update("UPDATE noise_devices SET property_id=12 WHERE id=1");
            case "external" -> db.update("UPDATE noise_devices SET external_device_id='different' WHERE id=1");
            case "type" -> db.update("UPDATE noise_devices SET device_type='TUYA' WHERE id=1");
            case "inactive" -> db.update("UPDATE noise_devices SET status='INACTIVE' WHERE id=1");
            case "simulation" -> db.update("UPDATE noise_devices SET simulation=true WHERE id=1");
            case "online" -> db.update("UPDATE noise_devices SET online=false WHERE id=1");
            case "time" -> db.update("UPDATE noise_devices SET last_seen_at=? WHERE id=1",Timestamp.valueOf(observed.plusMinutes(1)));
            case "deleted" -> db.update("DELETE FROM noise_devices WHERE id=1");
        }
        var before = db.queryForList("SELECT * FROM noise_devices");
        refused(() -> writer.record(snapshot(), false, observed));
        assertThat(db.queryForList("SELECT * FROM noise_devices")).isEqualTo(before);
    }

    @Test void nullInitialStatusCanBeRecordedOnlyOnce() {
        db.update("UPDATE noise_devices SET online=NULL,last_seen_at=NULL WHERE id=1");
        var initial = new BaitlyNoiseStatusWriter.Snapshot(1L,7L,11L,DeviceType.MINUT,"synthetic-device",null,null);
        writer.record(initial, true, observed);
        refused(() -> writer.record(initial, false, observed.plusMinutes(1)));
        assertThat(db.queryForObject("SELECT online FROM noise_devices WHERE id=1",Boolean.class)).isTrue();
    }

    @Test void olderObservationCannotMoveFreshnessBackwards() {
        refused(() -> writer.record(snapshot(), false, previous.minusSeconds(1)));
        assertThat(db.queryForObject("SELECT online FROM noise_devices WHERE id=1",Boolean.class)).isTrue();
    }

    @Test void independentCommitSurvivesCallerRollback() {
        assertThatThrownBy(() -> outer.execute(status -> {
            writer.record(snapshot(), false, observed);
            throw new IllegalStateException("synthetic-rollback");
        })).hasMessage("synthetic-rollback");
        assertThat(db.queryForObject("SELECT online FROM noise_devices WHERE id=1",Boolean.class)).isFalse();
    }

    @Test void twoConcurrentResultsCannotBothOverwriteTheSameSnapshot() throws Exception {
        var start = new CountDownLatch(1);
        var pool = Executors.newFixedThreadPool(2);
        Callable<Boolean> attempt = () -> {
            start.await();
            try { writer.record(snapshot(), false, observed); return true; }
            catch (IllegalStateException refused) { return false; }
        };
        try {
            var a = pool.submit(attempt);
            var b = pool.submit(attempt);
            start.countDown();
            int accepted = (a.get(15,TimeUnit.SECONDS) ? 1 : 0) + (b.get(15,TimeUnit.SECONDS) ? 1 : 0);
            assertThat(accepted).isEqualTo(1);
        } finally { pool.shutdownNow(); }
    }

    @Test void invalidIdentityNeverWrites() {
        refused(() -> writer.record(new BaitlyNoiseStatusWriter.Snapshot(1L,null,11L,
            DeviceType.MINUT,"synthetic-device",true,previous),false,observed));
        assertThat(db.queryForObject("SELECT online FROM noise_devices WHERE id=1",Boolean.class)).isTrue();
    }
}
