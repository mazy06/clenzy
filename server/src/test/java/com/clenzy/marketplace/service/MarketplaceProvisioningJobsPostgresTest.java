package com.clenzy.marketplace.service;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;
import org.springframework.transaction.support.TransactionTemplate;
import java.util.UUID;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

@EnabledIfSystemProperty(named = "baitly.test.jdbc", matches = "jdbc:postgresql:.*")
class MarketplaceProvisioningJobsPostgresTest {
    JdbcTemplate jdbc;
    DataSourceTransactionManager manager;
    MarketplaceProvisioningJobs jobs;
    Long id;

    @BeforeEach
    void setup() {
        var ds = new DriverManagerDataSource(System.getProperty("baitly.test.jdbc"), System.getProperty("baitly.test.user", "postgres"), "");
        jdbc = new JdbcTemplate(ds);
        manager = new DataSourceTransactionManager(ds);
        var proxy = new ProxyFactory(new MarketplaceProvisioningJobs(jdbc));
        proxy.addAdvice(new TransactionInterceptor(manager, new AnnotationTransactionAttributeSource()));
        jobs = (MarketplaceProvisioningJobs) proxy.getProxy();
        id = jdbc.queryForObject("""
                INSERT INTO marketplace_providers (public_ref, display_name, email, status, email_confirmed_at)
                VALUES (?, 'Baitly test', 'provision@example.invalid', 'ACTIVE', CURRENT_TIMESTAMP) RETURNING id
                """, Long.class, UUID.randomUUID());
    }

    @AfterEach
    void cleanup() { if (id != null) jdbc.update("DELETE FROM marketplace_providers WHERE id = ?", id); }

    @Test
    void aRolledBackModerationDoesNotQueueProvisioning() {
        new TransactionTemplate(manager).executeWithoutResult(status -> { jobs.enqueue(id); status.setRollbackOnly(); });
        assertThat(jobs.state(id)).isEmpty();
    }

    @Test
    void concurrentWorkersCannotBothClaimTheSameAccount() throws Exception {
        jobs.enqueue(id);
        var executor = Executors.newFixedThreadPool(2);
        var start = new CountDownLatch(1);
        Callable<MarketplaceProvisioningJobs.Claim> task = () -> { start.await(); return jobs.claim(id); };
        try {
            var first = executor.submit(task); var second = executor.submit(task);
            start.countDown();
            assertThat((first.get(15, TimeUnit.SECONDS) != null) ^ (second.get(15, TimeUnit.SECONDS) != null)).isTrue();
            assertThat(jobs.state(id).orElseThrow().attempts()).isEqualTo(1);
        } finally { executor.shutdownNow(); }
    }

    @Test
    void reconciliationAndAutomaticWorkerCannotBothOwnTheAccount() throws Exception {
        jobs.enqueue(id);
        var executor = Executors.newFixedThreadPool(2);
        var start = new CountDownLatch(1);
        try {
            var automatic = executor.submit(() -> { start.await(); return jobs.claim(id); });
            var owner = executor.submit(() -> { start.await(); return jobs.claimReconciliation(id, "owner"); });
            start.countDown();
            assertThat((automatic.get(15, TimeUnit.SECONDS) != null) ^ (owner.get(15, TimeUnit.SECONDS) != null)).isTrue();
            assertThat(jobs.claimReconciliation(id, "another-attempt")).isNull();
        } finally { executor.shutdownNow(); }
    }

    @Test
    void verifiedOwnerCanResumeAFailedJobAndIsRecorded() {
        jobs.enqueue(id);
        jdbc.update("UPDATE marketplace_provisioning_jobs SET status = 'FAILED', attempts = 5 WHERE provider_id = ?", id);
        var claim = jobs.claimReconciliation(id, "owner");
        assertThat(claim).isNotNull();
        assertThat(jdbc.queryForObject("SELECT retried_by FROM marketplace_provisioning_jobs WHERE provider_id = ?", String.class, id))
            .isEqualTo("owner");
        jobs.finish(id, claim.token(), MarketplaceOnboardingService.Outcome.EXISTING_ACCOUNT_LINKED);
        assertThat(jobs.state(id).orElseThrow().status()).isEqualTo("SUCCEEDED");
        assertThat(jobs.claimReconciliation(id, "owner")).isNull();
    }

    @Test
    void reconciliationFencesAnExpiredWorkerAndRejectsSuspendedCandidates() {
        jobs.enqueue(id);
        var old = jobs.claim(id);
        jdbc.update("UPDATE marketplace_provisioning_jobs SET updated_at = CURRENT_TIMESTAMP - INTERVAL '30 minutes' WHERE provider_id = ?", id);
        var owner = jobs.claimReconciliation(id, "owner");
        assertThat(owner).isNotNull();
        assertThatThrownBy(() -> new TransactionTemplate(manager).executeWithoutResult(status -> jobs.requireClaim(id, old.token())))
            .isInstanceOf(IllegalStateException.class);
        jobs.finish(id, old.token(), MarketplaceOnboardingService.Outcome.ACCOUNT_CREATED);
        assertThat(jobs.state(id).orElseThrow().status()).isEqualTo("RUNNING");
        jobs.finish(id, owner.token(), MarketplaceOnboardingService.Outcome.FAILED);
        jdbc.update("UPDATE marketplace_providers SET status = 'SUSPENDED' WHERE id = ?", id);
        assertThat(jobs.claimReconciliation(id, "owner")).isNull();
    }

    @Test
    void retriesAreDelayedAndStopAfterFiveAttempts() {
        jobs.enqueue(id);
        String operation = jobs.operationKey(id);
        assertThat(java.util.UUID.fromString(operation)).isNotNull();
        for (int attempt = 1; attempt <= 5; attempt++) {
            var claim = jobs.claim(id);
            assertThat(claim).isNotNull();
            jobs.finish(id, claim.token(), MarketplaceOnboardingService.Outcome.FAILED);
            assertThat(jobs.claim(id)).isNull();
            assertThat(jobs.due()).doesNotContain(id);
            jobs.enqueue(id);
            assertThat(jobs.operationKey(id)).isEqualTo(operation);
            jdbc.update("UPDATE marketplace_provisioning_jobs SET next_attempt_at = CURRENT_TIMESTAMP - INTERVAL '1 minute' WHERE provider_id = ?", id);
        }
        assertThat(jobs.claim(id)).isNull();
        assertThat(jobs.state(id).orElseThrow().status()).isEqualTo("FAILED");
        assertThat(jobs.state(id).orElseThrow().requiresReview()).isTrue();
    }

    @Test
    void suspensionPreventsAQueuedAccountFromBeingCreated() {
        jobs.enqueue(id);
        jdbc.update("UPDATE marketplace_providers SET status = 'SUSPENDED' WHERE id = ?", id);
        assertThat(jobs.claim(id)).isNull();
        assertThat(jobs.due()).doesNotContain(id);
    }

    @Test
    void uncertainInterruptedWorkIsFlaggedWithoutReplayingTheExternalCreation() {
        jobs.enqueue(id);
        var claim = jobs.claim(id);
        assertThat(claim).isNotNull();
        jdbc.update("UPDATE marketplace_provisioning_jobs SET updated_at = CURRENT_TIMESTAMP - INTERVAL '30 minutes' WHERE provider_id = ?", id);
        assertThat(jobs.state(id).orElseThrow().requiresReview()).isTrue();
        assertThat(jobs.claim(id)).isNull();
        assertThat(jobs.due()).doesNotContain(id);
        jobs.finish(id, claim.token(), MarketplaceOnboardingService.Outcome.ACCOUNT_CREATED);
        jobs.enqueue(id);
        assertThat(jobs.claim(id)).isNull();
        assertThat(jobs.state(id).orElseThrow().status()).isEqualTo("SUCCEEDED");
    }

    @Test
    void aStaffRetryInvalidatesEveryWriteFromThePreviousAttempt() {
        jobs.enqueue(id);
        var old = jobs.claim(id);
        assertThat(jobs.retry(id, "staff")).isFalse();
        jdbc.update("UPDATE marketplace_provisioning_jobs SET updated_at = CURRENT_TIMESTAMP - INTERVAL '30 minutes' WHERE provider_id = ?", id);
        assertThat(jobs.retry(id, "staff")).isTrue();
        var current = jobs.claim(id);
        assertThat(current.token()).isNotEqualTo(old.token());
        assertThat(current.operationKey()).isEqualTo(old.operationKey());
        assertThatThrownBy(() -> new TransactionTemplate(manager).executeWithoutResult(status -> {
            jobs.requireClaim(id, old.token());
            jdbc.update("UPDATE marketplace_providers SET display_name = 'Ancienne tentative' WHERE id = ?", id);
        })).isInstanceOf(IllegalStateException.class);
        jobs.finish(id, old.token(), MarketplaceOnboardingService.Outcome.FAILED);
        assertThat(jobs.state(id).orElseThrow().status()).isEqualTo("RUNNING");
        new TransactionTemplate(manager).executeWithoutResult(status -> {
            jobs.requireClaim(id, current.token());
            jdbc.update("UPDATE marketplace_providers SET display_name = 'Tentative courante' WHERE id = ?", id);
        });
        jobs.finish(id, current.token(), MarketplaceOnboardingService.Outcome.ACCOUNT_CREATED);
        assertThat(jdbc.queryForObject("SELECT display_name FROM marketplace_providers WHERE id = ?", String.class, id))
                .isEqualTo("Tentative courante");
        assertThat(jdbc.queryForObject("SELECT retried_by FROM marketplace_provisioning_jobs WHERE provider_id = ?", String.class, id))
                .isEqualTo("staff");
    }

    @Test
    void aRetryWaitsForLocalPersistenceToCommitBeforeInvalidatingItsAttempt() throws Exception {
        jobs.enqueue(id);
        var claim = jobs.claim(id);
        jdbc.update("UPDATE marketplace_provisioning_jobs SET updated_at = CURRENT_TIMESTAMP - INTERVAL '30 minutes' WHERE provider_id = ?", id);
        var locked = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        var executor = Executors.newFixedThreadPool(2);
        try {
            var persistence = executor.submit(() -> new TransactionTemplate(manager).executeWithoutResult(status -> {
                jobs.requireClaim(id, claim.token());
                locked.countDown();
                try {
                    if (!release.await(15, TimeUnit.SECONDS)) throw new IllegalStateException("Test timeout");
                } catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new IllegalStateException(e); }
            }));
            assertThat(locked.await(15, TimeUnit.SECONDS)).isTrue();
            var retry = executor.submit(() -> jobs.retry(id, "staff"));
            assertThatThrownBy(() -> retry.get(200, TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class);
            release.countDown();
            persistence.get(15, TimeUnit.SECONDS);
            assertThat(retry.get(15, TimeUnit.SECONDS)).isTrue();
        } finally { release.countDown(); executor.shutdownNow(); }
    }
}
