package com.clenzy.integration.pennylane.service;

import com.clenzy.integration.pennylane.model.PennylaneConnection;
import com.clenzy.integration.pennylane.repository.PennylaneConnectionRepository;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.orm.jpa.SharedEntityManagerCreator;
import org.springframework.orm.jpa.vendor.HibernateJpaDialect;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.UUID;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.*;

/** Vraies requêtes JPA ; H2 local et schéma PostgreSQL dédié dans la recette CI. */
class BaitlyPennylaneSyncPersistenceTest {
    static SessionFactory factory;
    static JdbcTemplate admin;
    static String schema;
    static TransactionTemplate transaction;
    static PennylaneConnectionRepository repository;
    final Instant started = Instant.parse("2026-10-22T10:00:00Z");

    @BeforeAll static void start() {
        String jdbc = System.getProperty("baitly.test.jdbc");
        var ds = new DriverManagerDataSource();
        if (jdbc == null) {
            ds.setUrl("jdbc:h2:mem:baitlypennylanesync;MODE=PostgreSQL;DB_CLOSE_DELAY=-1");
            ds.setUsername("sa");
            ds.setPassword("");
        } else {
            if (!jdbc.matches("jdbc:postgresql://(?:127\\.0\\.0\\.1|localhost):[0-9]+/[a-zA-Z0-9_]+")
                    || !(jdbc.matches(".*[/_](?:test|recipe|ci)(?:_.*)?$")
                    || jdbc.equals("jdbc:postgresql://127.0.0.1:55439/postgres"))) {
                throw new IllegalArgumentException("Base de recette dédiée requise");
            }
            ds.setUrl(jdbc);
            ds.setUsername(System.getProperty("baitly.test.user", "postgres"));
            ds.setPassword(System.getProperty("baitly.test.password", ""));
            admin = new JdbcTemplate(ds);
            schema = "baitly_pennylane_sync_" + UUID.randomUUID().toString().replace("-", "");
            admin.execute("CREATE SCHEMA " + schema);
            ds = new DriverManagerDataSource(jdbc + "?currentSchema=" + schema, ds.getUsername(), ds.getPassword());
        }
        var config = new Configuration().addAnnotatedClass(PennylaneConnection.class)
                .setProperty("hibernate.hbm2ddl.auto", "create-drop");
        config.getProperties().put("hibernate.connection.datasource", ds);
        factory = config.buildSessionFactory();
        var manager = new JpaTransactionManager(factory);
        manager.setDataSource(ds);
        manager.setJpaDialect(new HibernateJpaDialect());
        manager.afterPropertiesSet();
        transaction = new TransactionTemplate(manager);
        repository = new JpaRepositoryFactory(SharedEntityManagerCreator.createSharedEntityManager(factory))
                .getRepository(PennylaneConnectionRepository.class);
    }

    @AfterAll static void close() {
        try { if (factory != null) factory.close(); }
        finally { if (schema != null) admin.execute("DROP SCHEMA " + schema + " CASCADE"); }
    }

    <T> T tx(Supplier<T> work) { return transaction.execute(status -> work.get()); }

    PennylaneConnection fixture(Long org) {
        var c = new PennylaneConnection();
        c.setOrganizationId(org);
        c.setUserId(1L);
        c.setAccessTokenEncrypted("synthetic-old-access");
        c.setRefreshTokenEncrypted("synthetic-old-refresh");
        c.setTokenExpiresAt(started.plusSeconds(3600));
        c.setRefreshTokenExpiresAt(started.plusSeconds(86400));
        c.setConnectedAt(started.minusSeconds(86400));
        c.setLastSyncAt(started.minusSeconds(3600));
        c.setPennylaneCompanyId("synthetic-company");
        c.setScopes("synthetic-scope");
        return tx(() -> repository.saveAndFlush(c));
    }

    int record(Long org, Instant at) {
        return tx(() -> repository.recordSyncAttempt(org, at, Instant.now()));
    }

    @Test void partialUpdateCannotRestoreCredentialsRotatedAfterSnapshotWasLoaded() {
        var stale = fixture(7L);
        tx(() -> {
            var fresh = repository.findById(stale.getId()).orElseThrow();
            fresh.setAccessTokenEncrypted("synthetic-new-access");
            fresh.setRefreshTokenEncrypted("synthetic-new-refresh");
            fresh.setTokenExpiresAt(started.plusSeconds(7200));
            fresh.setRefreshTokenExpiresAt(started.plusSeconds(172800));
            return repository.saveAndFlush(fresh);
        });
        assertThat(record(7L, started)).isEqualTo(1);
        var result = tx(() -> repository.findById(stale.getId()).orElseThrow());
        assertThat(result.getAccessTokenEncrypted()).isEqualTo("synthetic-new-access");
        assertThat(result.getRefreshTokenEncrypted()).isEqualTo("synthetic-new-refresh");
        assertThat(result.getTokenExpiresAt()).isEqualTo(started.plusSeconds(7200));
        assertThat(result.getRefreshTokenExpiresAt()).isEqualTo(started.plusSeconds(172800));
        assertThat(result.getPennylaneCompanyId()).isEqualTo("synthetic-company");
        assertThat(result.getScopes()).isEqualTo("synthetic-scope");
        assertThat(result.getLastSyncAt()).isEqualTo(started);
        assertThat(result.getUpdatedAt()).isAfterOrEqualTo(stale.getUpdatedAt());
    }

    @ParameterizedTest @EnumSource(value = PennylaneConnection.Status.class, names = {"ERROR", "EXPIRED", "REVOKED"})
    void metadataCannotReactivateOrRewriteAnInactiveConnection(PennylaneConnection.Status status) {
        var stale = fixture(8L);
        tx(() -> {
            var fresh = repository.findById(stale.getId()).orElseThrow();
            fresh.setStatus(status);
            fresh.setAccessTokenEncrypted(null);
            fresh.setRefreshTokenEncrypted(null);
            fresh.setErrorMessage("Diagnostic local borné");
            return repository.saveAndFlush(fresh);
        });
        assertThat(record(8L, started)).isZero();
        var result = tx(() -> repository.findById(stale.getId()).orElseThrow());
        assertThat(result.getStatus()).isEqualTo(status);
        assertThat(result.getAccessTokenEncrypted()).isNull();
        assertThat(result.getRefreshTokenEncrypted()).isNull();
        assertThat(result.getErrorMessage()).isEqualTo("Diagnostic local borné");
        assertThat(result.getLastSyncAt()).isEqualTo(stale.getLastSyncAt());
    }

    @Test void organizationsAreIsolated() {
        var first = fixture(9L);
        var second = fixture(10L);
        assertThat(record(9L, started)).isEqualTo(1);
        assertThat(tx(() -> repository.findById(second.getId()).orElseThrow()).getLastSyncAt()).isEqualTo(second.getLastSyncAt());
        assertThat(tx(() -> repository.findById(first.getId()).orElseThrow()).getLastSyncAt()).isEqualTo(started);
    }

    @Test void oldBatchCannotMoveLastAttemptBackwards() {
        var c = fixture(11L);
        assertThat(record(11L, started.plusSeconds(60))).isEqualTo(1);
        assertThat(record(11L, started)).isZero();
        assertThat(tx(() -> repository.findById(c.getId()).orElseThrow()).getLastSyncAt()).isEqualTo(started.plusSeconds(60));
    }

    @Test void batchStartedBeforeReconnectionCannotMarkTheNewConnection() {
        var c = fixture(12L);
        tx(() -> {
            var fresh = repository.findById(c.getId()).orElseThrow();
            fresh.setConnectedAt(started.plusSeconds(1));
            return repository.saveAndFlush(fresh);
        });
        assertThat(record(12L, started)).isZero();
        assertThat(tx(() -> repository.findById(c.getId()).orElseThrow()).getLastSyncAt()).isEqualTo(c.getLastSyncAt());
    }

    @Test void legacyConnectionWithoutConnectedDateStillSupportsMetadata() {
        var c = fixture(13L);
        tx(() -> {
            var fresh = repository.findById(c.getId()).orElseThrow();
            fresh.setConnectedAt(null);
            return repository.saveAndFlush(fresh);
        });
        assertThat(record(13L, started)).isEqualTo(1);
    }

    @Test void missingOrganizationDoesNotCreateAConnection() {
        assertThat(record(999L, started)).isZero();
        assertThat(tx(() -> repository.findByOrganizationId(999L))).isEmpty();
    }
}
