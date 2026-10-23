package com.clenzy.integration.homeaway.service;

import com.clenzy.integration.homeaway.model.HomeAwayConnection;
import com.clenzy.integration.homeaway.model.HomeAwayConnection.HomeAwayConnectionStatus;
import com.clenzy.integration.homeaway.repository.HomeAwayConnectionRepository;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.orm.jpa.SharedEntityManagerCreator;
import org.springframework.orm.jpa.vendor.HibernateJpaDialect;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.UUID;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.*;

/** Vraies requêtes du repository et mapping JPA ; PostgreSQL éphémère en recette CI. */
class BaitlyHomeAwaySyncPersistenceTest {
    static SessionFactory factory;
    static JdbcTemplate admin;
    static String schema;
    static TransactionTemplate transaction;
    static HomeAwayConnectionRepository repository;
    final LocalDateTime started = LocalDateTime.of(2026, 10, 22, 10, 0);

    @BeforeAll static void start() {
        String jdbc = System.getProperty("baitly.test.jdbc");
        var ds = new DriverManagerDataSource();
        if (jdbc == null) {
            ds.setUrl("jdbc:h2:mem:baitlyhomeawaysync;MODE=PostgreSQL;DB_CLOSE_DELAY=-1");
            ds.setUsername("sa");
            ds.setPassword("");
        } else {
            // Même garde que la recette : jamais une base métier ni un hôte distant.
            if (!jdbc.matches("jdbc:postgresql://(?:127\\.0\\.0\\.1|localhost):[0-9]+/[a-zA-Z0-9_]+")
                    || !(jdbc.matches(".*[/_](?:test|recipe|ci)(?:_.*)?$")
                    || jdbc.equals("jdbc:postgresql://127.0.0.1:55439/postgres"))) {
                throw new IllegalArgumentException("Base de recette dédiée requise");
            }
            ds.setUrl(jdbc);
            ds.setUsername(System.getProperty("baitly.test.user", "postgres"));
            ds.setPassword(System.getProperty("baitly.test.password", ""));
            admin = new JdbcTemplate(ds);
            schema = "baitly_sync_" + UUID.randomUUID().toString().replace("-", "");
            admin.execute("CREATE SCHEMA " + schema);
            var scoped = new DriverManagerDataSource(jdbc + "?currentSchema=" + schema, ds.getUsername(), ds.getPassword());
            ds = scoped;
        }
        factory = build(ds);
        var manager = new JpaTransactionManager(factory);
        manager.setDataSource(ds);
        manager.setJpaDialect(new HibernateJpaDialect());
        manager.afterPropertiesSet();
        transaction = new TransactionTemplate(manager);
        repository = new JpaRepositoryFactory(SharedEntityManagerCreator.createSharedEntityManager(factory))
                .getRepository(HomeAwayConnectionRepository.class);
    }

    private static SessionFactory build(DriverManagerDataSource ds) {
        var config = new Configuration().addAnnotatedClass(HomeAwayConnection.class)
                .setProperty("hibernate.hbm2ddl.auto", "create-drop");
        config.getProperties().put("hibernate.connection.datasource", ds);
        return config.buildSessionFactory();
    }

    @AfterAll static void close() {
        try { if (factory != null) factory.close(); }
        finally { if (schema != null) admin.execute("DROP SCHEMA " + schema + " CASCADE"); }
    }

    <T> T tx(Supplier<T> work) { return transaction.execute(status -> work.get()); }

    HomeAwayConnection fixture() {
        var c = new HomeAwayConnection(7L, "synthetic-old-access");
        c.setListingId("synthetic-listing");
        c.setRefreshTokenEncrypted("synthetic-old-refresh");
        c.setTokenExpiresAt(started.plusHours(1));
        c.setLastSyncAt(started.minusDays(1));
        return tx(() -> repository.saveAndFlush(c));
    }

    int record(HomeAwayConnection snapshot, boolean success, Long org, String listing, LocalDateTime at) {
        return tx(() -> success ? repository.recordSyncSuccess(snapshot.getId(), org, listing, at)
                : repository.recordSyncFailure(snapshot.getId(), org, listing, at));
    }

    @ParameterizedTest @ValueSource(booleans = {true, false})
    void metadataNeverRestoresOldCredentialsAfterRefresh(boolean success) {
        var stale = fixture();
        tx(() -> {
            var fresh = repository.findById(stale.getId()).orElseThrow();
            fresh.setAccessTokenEncrypted("synthetic-new-access");
            fresh.setRefreshTokenEncrypted("synthetic-new-refresh");
            fresh.setTokenExpiresAt(started.plusDays(1));
            return repository.saveAndFlush(fresh);
        });
        assertThat(record(stale, success, 7L, stale.getListingId(), started)).isEqualTo(1);
        var result = tx(() -> repository.findById(stale.getId()).orElseThrow());
        assertThat(result.getAccessTokenEncrypted()).isEqualTo("synthetic-new-access");
        assertThat(result.getRefreshTokenEncrypted()).isEqualTo("synthetic-new-refresh");
        assertThat(result.getTokenExpiresAt()).isEqualTo(started.plusDays(1));
        assertThat(result.getLastSyncAt()).isEqualTo(success ? started : stale.getLastSyncAt());
        assertThat(result.getErrorMessage()).isEqualTo(success ? null : "Synchronisation HomeAway indisponible");
        assertThat(result.getUpdatedAt()).isAfterOrEqualTo(stale.getUpdatedAt());
    }

    @ParameterizedTest @ValueSource(booleans = {true, false})
    void staleResultCannotReactivateDisconnectedConnection(boolean success) {
        var stale = fixture();
        tx(() -> {
            var current = repository.findById(stale.getId()).orElseThrow();
            current.setStatus(HomeAwayConnectionStatus.INACTIVE);
            current.setAccessTokenEncrypted("");
            current.setRefreshTokenEncrypted(null);
            current.setTokenExpiresAt(null);
            current.setErrorMessage("Déconnexion locale");
            return repository.saveAndFlush(current);
        });
        assertThat(record(stale, success, 7L, stale.getListingId(), started)).isZero();
        var result = tx(() -> repository.findById(stale.getId()).orElseThrow());
        assertThat(result.getStatus()).isEqualTo(HomeAwayConnectionStatus.INACTIVE);
        assertThat(result.getAccessTokenEncrypted()).isEmpty();
        assertThat(result.getRefreshTokenEncrypted()).isNull();
        assertThat(result.getErrorMessage()).isEqualTo("Déconnexion locale");
    }

    @ParameterizedTest @ValueSource(booleans = {true, false})
    void wrongOrganizationListingAndOlderResultCannotOverwriteNewerSync(boolean success) {
        var stale = fixture();
        assertThat(record(stale, success, 8L, stale.getListingId(), started)).isZero();
        assertThat(record(stale, success, 7L, "different-listing", started)).isZero();
        assertThat(record(stale, true, 7L, stale.getListingId(), started.plusMinutes(1))).isEqualTo(1);
        assertThat(record(stale, success, 7L, stale.getListingId(), started)).isZero();
        var result = tx(() -> repository.findById(stale.getId()).orElseThrow());
        assertThat(result.getLastSyncAt()).isEqualTo(started.plusMinutes(1));
        assertThat(result.getErrorMessage()).isNull();
    }

    @ParameterizedTest @ValueSource(booleans = {true, false})
    void nullListingMatchesOnlyTheSameUnassignedConnection(boolean success) {
        var snapshot = fixture();
        assertThat(record(snapshot, success, 7L, null, started)).isZero();
        tx(() -> {
            var current = repository.findById(snapshot.getId()).orElseThrow();
            current.setListingId(null);
            return repository.saveAndFlush(current);
        });
        assertThat(record(snapshot, success, 7L, snapshot.getListingId(), started)).isZero();
        assertThat(record(snapshot, success, 7L, null, started)).isEqualTo(1);
    }
}
