package com.clenzy.marketplace.service;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.LocalDateTime;
import java.sql.Timestamp;
import java.util.UUID;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

/** Exécute la consommation réelle sur le schéma migré, avec deux connexions concurrentes. */
@EnabledIfSystemProperty(named = "baitly.test.jdbc", matches = "jdbc:postgresql:.*")
class MarketplaceActivationTokenPostgresTest {
    JdbcTemplate jdbc;
    MarketplaceActivationTokenConsumer consumer;
    DataSourceTransactionManager manager;
    Long id;
    final LocalDateTime now = LocalDateTime.of(2026, 9, 15, 12, 0);
    final String hash = MarketplaceUploadTokens.hash(UUID.randomUUID().toString());

    @BeforeEach
    void setup() {
        var source = new DriverManagerDataSource(System.getProperty("baitly.test.jdbc"),
                System.getProperty("baitly.test.user", "postgres"), "");
        jdbc = new JdbcTemplate(source);
        manager = new DataSourceTransactionManager(source);
        consumer = new MarketplaceActivationTokenConsumer(jdbc, manager);
        id = jdbc.queryForObject("""
                INSERT INTO marketplace_providers (public_ref, display_name, email, user_id,
                    activation_token_hash, activation_token_expires_at)
                VALUES (?, 'Baitly test', 'activation@example.invalid', -42, ?, ?) RETURNING id
                """, Long.class, UUID.randomUUID(), hash, Timestamp.valueOf(now.plusDays(1)));
    }

    @AfterEach
    void cleanup() {
        if (id != null) jdbc.update("DELETE FROM marketplace_providers WHERE id = ?", id);
    }

    @Test
    void twoConcurrentRequestsConsumeExactlyOnce() throws Exception {
        var executor = Executors.newFixedThreadPool(2);
        var start = new CountDownLatch(1);
        Callable<Boolean> task = () -> { start.await(); return consumer.consume(id, -42L, hash, now); };
        try {
            var first = executor.submit(task);
            var second = executor.submit(task);
            start.countDown();
            assertThat(first.get(15, TimeUnit.SECONDS) ^ second.get(15, TimeUnit.SECONDS)).isTrue();
            assertThat(consumer.consume(id, -42L, hash, now)).isFalse();
        } finally { executor.shutdownNow(); }
    }

    @Test
    void aLaterFailureCannotRestoreTheConsumedLink() {
        assertThatThrownBy(() -> new TransactionTemplate(manager).executeWithoutResult(status -> {
            assertThat(consumer.consume(id, -42L, hash, now)).isTrue();
            throw new IllegalStateException("Échec après consommation");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(consumer.consume(id, -42L, hash, now)).isFalse();
    }

    @Test
    void expiredOrReassignedOrReplacedTokensCannotBeConsumed() {
        assertThat(consumer.consume(id, -43L, hash, now)).isFalse();
        assertThat(consumer.consume(id, -42L, "wrong-hash", now)).isFalse();
        assertThat(consumer.consume(id, -42L, hash, now.plusDays(1))).isFalse();
        assertThat(consumer.consume(id, -42L, hash, now)).isTrue();
    }
}
