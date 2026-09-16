package com.clenzy.marketplace.service;

import com.clenzy.marketplace.model.MarketplaceProvider;
import com.clenzy.service.TokenEncryptionService;
import com.clenzy.util.StringUtils;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.sql.Timestamp;
import java.util.UUID;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

@EnabledIfSystemProperty(named = "baitly.test.jdbc", matches = "jdbc:postgresql:.*")
class MarketplaceActivationDeliveriesPostgresTest {
    JdbcTemplate jdbc;
    DataSourceTransactionManager manager;
    MarketplaceActivationDeliveries deliveries;
    TokenEncryptionService encryption = new TokenEncryptionService("test-only-baitly-delivery-key", 1, "");
    MarketplaceProvider provider;

    @BeforeEach
    void setup() {
        var ds = new DriverManagerDataSource(System.getProperty("baitly.test.jdbc"), System.getProperty("baitly.test.user", "postgres"), "");
        jdbc = new JdbcTemplate(ds);
        manager = new DataSourceTransactionManager(ds);
        var proxy = new ProxyFactory(new MarketplaceActivationDeliveries(jdbc, encryption, Clock.systemDefaultZone()));
        proxy.addAdvice(new TransactionInterceptor(manager, new AnnotationTransactionAttributeSource()));
        deliveries = (MarketplaceActivationDeliveries) proxy.getProxy();
        provider = new MarketplaceProvider();
        provider.setEmail(UUID.randomUUID() + "@example.invalid");
        provider.setUserId(98765L);
        provider.setId(jdbc.queryForObject("""
                INSERT INTO marketplace_providers (public_ref, display_name, email, email_hash, status, email_confirmed_at)
                VALUES (?, 'Baitly delivery test', ?, ?, 'ACTIVE', CURRENT_TIMESTAMP) RETURNING id
                """, Long.class, UUID.randomUUID(), provider.getEmail(), StringUtils.computeEmailHash(provider.getEmail())));
    }

    @AfterEach
    void cleanup() { if (provider != null) jdbc.update("DELETE FROM marketplace_providers WHERE id = ?", provider.getId()); }

    void persist(boolean rollback) {
        new TransactionTemplate(manager).executeWithoutResult(status -> {
            deliveries.enqueue(provider);
            jdbc.update("UPDATE marketplace_providers SET user_id = ?, activation_token_hash = ?, activation_token_expires_at = ? WHERE id = ?",
                    provider.getUserId(), provider.getActivationTokenHash(), Timestamp.valueOf(provider.getActivationTokenExpiresAt()), provider.getId());
            if (rollback) status.setRollbackOnly();
        });
    }

    String status() { return jdbc.queryForObject("SELECT status FROM marketplace_activation_deliveries WHERE provider_id = ?", String.class, provider.getId()); }
    void dueNow() { jdbc.update("UPDATE marketplace_activation_deliveries SET next_attempt_at = CURRENT_TIMESTAMP - INTERVAL '1 minute' WHERE provider_id = ?", provider.getId()); }
    String encryptedToken() { return jdbc.queryForObject("SELECT encrypted_token FROM marketplace_activation_deliveries WHERE provider_id = ?", String.class, provider.getId()); }

    @Test
    void rollbackLeavesNeitherAccountLinkNorInvitationAndRequiresATransaction() {
        assertThatThrownBy(() -> deliveries.enqueue(provider)).isInstanceOf(org.springframework.transaction.IllegalTransactionStateException.class);
        persist(true);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM marketplace_activation_deliveries WHERE provider_id = ?", Integer.class, provider.getId())).isZero();
        assertThat(jdbc.queryForObject("SELECT user_id FROM marketplace_providers WHERE id = ?", Long.class, provider.getId())).isNull();
    }

    @Test
    void successfulDeliveryRemovesEncryptedSecretButLeavesTheOriginalActivationHash() {
        persist(false);
        String encrypted = encryptedToken();
        assertThat(encrypted).startsWith("GCMv1:");
        assertThat(MarketplaceUploadTokens.hash(encryption.decrypt(encrypted))).isEqualTo(provider.getActivationTokenHash());
        var claim = deliveries.claim(provider.getId());
        deliveries.finish(claim, true);
        assertThat(status()).isEqualTo("SENT");
        assertThat(encryptedToken()).isNull();
        assertThat(deliveries.claim(provider.getId())).isNull();
        assertThat(jdbc.queryForObject("SELECT activation_token_hash FROM marketplace_providers WHERE id = ?", String.class, provider.getId())).isEqualTo(provider.getActivationTokenHash());
    }

    @Test
    void interruptedWorkerReusesTheSameLinkAndCannotFinishTheNewAttempt() {
        persist(false);
        var old = deliveries.claim(provider.getId());
        assertThat(deliveries.claim(provider.getId())).isNull();
        dueNow();
        var current = deliveries.claim(provider.getId());
        assertThat(current.encryptedToken()).isEqualTo(old.encryptedToken());
        assertThat(current.claimToken()).isNotEqualTo(old.claimToken());
        deliveries.finish(old, true);
        assertThat(status()).isEqualTo("RUNNING");
        assertThat(encryptedToken()).isNotNull();
        deliveries.finish(current, false);
        assertThat(status()).isEqualTo("PENDING");
        assertThat(deliveries.due()).doesNotContain(provider.getId());
    }

    @Test
    void concurrentWorkersCannotClaimTheSameInvitation() throws Exception {
        persist(false);
        var executor = Executors.newFixedThreadPool(2);
        var start = new CountDownLatch(1);
        Callable<MarketplaceActivationDeliveries.Claim> action = () -> { start.await(); return deliveries.claim(provider.getId()); };
        try {
            var first = executor.submit(action); var second = executor.submit(action); start.countDown();
            assertThat((first.get(15, TimeUnit.SECONDS) != null) ^ (second.get(15, TimeUnit.SECONDS) != null)).isTrue();
        } finally { executor.shutdownNow(); }
    }

    @Test
    void consumedActivationIsNeverRearmedEvenAfterAnUncertainEmailResult() {
        persist(false);
        var old = deliveries.claim(provider.getId());
        var consumer = new MarketplaceActivationTokenConsumer(jdbc, manager);
        assertThat(consumer.consume(provider.getId(), provider.getUserId(), provider.getActivationTokenHash(), java.time.LocalDateTime.now())).isTrue();
        deliveries.discardInvalid();
        assertThat(status()).isEqualTo("CANCELLED");
        assertThat(encryptedToken()).isNull();
        deliveries.finish(old, false);
        assertThat(status()).isEqualTo("CANCELLED");
        assertThat(deliveries.claim(provider.getId())).isNull();
    }

    @Test
    void expiryPurgesTheSecretWithoutMintingAnotherLink() {
        persist(false);
        jdbc.update("UPDATE marketplace_activation_deliveries SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 minute' WHERE provider_id = ?", provider.getId());
        assertThat(deliveries.claim(provider.getId())).isNull();
        deliveries.discardInvalid();
        assertThat(status()).isEqualTo("EXPIRED");
        assertThat(encryptedToken()).isNull();
    }

    @Test
    void suspensionPausesDeliveryAndAnAddressChangeCancelsIt() {
        persist(false);
        jdbc.update("UPDATE marketplace_providers SET status = 'SUSPENDED' WHERE id = ?", provider.getId());
        assertThat(deliveries.due()).doesNotContain(provider.getId());
        assertThat(deliveries.claim(provider.getId())).isNull();
        jdbc.update("UPDATE marketplace_providers SET status = 'ACTIVE', email_hash = 'changed' WHERE id = ?", provider.getId());
        deliveries.discardInvalid();
        assertThat(status()).isEqualTo("CANCELLED");
        assertThat(encryptedToken()).isNull();
    }

    @Test
    void diagnosticReflectsExpiryWithoutWaitingForCleanupOrMutatingTheJob() {
        persist(false);
        jdbc.update("UPDATE marketplace_activation_deliveries SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 minute' WHERE provider_id = ?", provider.getId());
        var state = deliveries.state(provider.getId()).orElseThrow();
        assertThat(state.status()).isEqualTo("EXPIRED");
        assertThat(state.linkAvailable()).isFalse();
        assertThat(state.nextAttemptAt()).isNull();
        assertThat(status()).isEqualTo("PENDING");
    }

    @Test
    void diagnosticDistinguishesAnUncertainSendFromAPausedProfile() {
        persist(false);
        var claim = deliveries.claim(provider.getId());
        assertThat(deliveries.state(provider.getId()).orElseThrow().status()).isEqualTo("RUNNING");
        dueNow();
        assertThat(deliveries.state(provider.getId()).orElseThrow().status()).isEqualTo("RETRY");
        jdbc.update("UPDATE marketplace_providers SET status = 'SUSPENDED' WHERE id = ?", provider.getId());
        var state = deliveries.state(provider.getId()).orElseThrow();
        assertThat(state.status()).isEqualTo("PAUSED");
        assertThat(state.nextAttemptAt()).isNull();
        deliveries.finish(claim, false);
    }

    @Test
    void sentDoesNotMeanActivatedAndConsumedLinksHaveNoAvailability() {
        assertThat(deliveries.state(provider.getId())).isEmpty();
        persist(false);
        deliveries.finish(deliveries.claim(provider.getId()), true);
        assertThat(deliveries.state(provider.getId()).orElseThrow().linkAvailable()).isTrue();
        new MarketplaceActivationTokenConsumer(jdbc, manager).consume(provider.getId(), provider.getUserId(),
                provider.getActivationTokenHash(), java.time.LocalDateTime.now());
        var state = deliveries.state(provider.getId()).orElseThrow();
        assertThat(state.status()).isEqualTo("SENT");
        assertThat(state.sentAt()).isNotNull();
        assertThat(state.linkAvailable()).isFalse();
        assertThat(state.nextAttemptAt()).isNull();
    }
}
