package com.clenzy.config;

import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.core.task.support.TaskExecutorAdapter;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests for {@link ContextPropagatingTaskDecorator} (Z1-BUGS-06).
 *
 * <p>Le decorateur doit propager TenantContext + SecurityContext + MDC du thread
 * soumetteur vers le thread d'execution, puis tout nettoyer en finally.</p>
 */
@DisplayName("ContextPropagatingTaskDecorator")
class ContextPropagatingTaskDecoratorTest {

    private final TenantContext tenantContext = new TenantContext();
    private final ContextPropagatingTaskDecorator decorator =
            new ContextPropagatingTaskDecorator(tenantContext);

    @BeforeEach
    @AfterEach
    void resetThreadLocals() {
        tenantContext.clear();
        SecurityContextHolder.clearContext();
        MDC.clear();
    }

    @Test
    void whenTaskRunsOnAnotherThread_thenTenantContextIsPropagated() throws Exception {
        // Arrange : contexte tenant du thread "HTTP"
        tenantContext.setOrganizationId(42L);
        tenantContext.setSuperAdmin(true);
        tenantContext.setSystemOrg(true);
        tenantContext.setCountryCode("MA");
        tenantContext.setDefaultCurrency("MAD");
        tenantContext.setVatRegistered(false);

        AtomicReference<Long> seenOrgId = new AtomicReference<>();
        AtomicReference<Boolean> seenSuperAdmin = new AtomicReference<>();
        AtomicReference<String> seenCurrency = new AtomicReference<>();
        Runnable decorated = decorator.decorate(() -> {
            seenOrgId.set(tenantContext.getOrganizationId());
            seenSuperAdmin.set(tenantContext.isSuperAdmin());
            seenCurrency.set(tenantContext.getDefaultCurrency());
        });

        // Act : execution sur un autre thread (comme un thread @Async)
        runOnFreshThread(decorated);

        // Assert
        assertThat(seenOrgId.get()).isEqualTo(42L);
        assertThat(seenSuperAdmin.get()).isTrue();
        assertThat(seenCurrency.get()).isEqualTo("MAD");
    }

    @Test
    void whenTaskRunsOnAnotherThread_thenSecurityContextAndMdcArePropagated() throws Exception {
        Authentication auth = new TestingAuthenticationToken("user-123", "n/a", "ROLE_HOST");
        SecurityContextHolder.getContext().setAuthentication(auth);
        MDC.put("requestId", "req-789");

        AtomicReference<Object> seenPrincipal = new AtomicReference<>();
        AtomicReference<String> seenRequestId = new AtomicReference<>();
        Runnable decorated = decorator.decorate(() -> {
            Authentication propagated = SecurityContextHolder.getContext().getAuthentication();
            seenPrincipal.set(propagated == null ? null : propagated.getPrincipal());
            seenRequestId.set(MDC.get("requestId"));
        });

        runOnFreshThread(decorated);

        assertThat(seenPrincipal.get()).isEqualTo("user-123");
        assertThat(seenRequestId.get()).isEqualTo("req-789");
    }

    @Test
    void whenTaskCompletes_thenWorkerThreadLocalsAreCleared() throws Exception {
        tenantContext.setOrganizationId(7L);
        MDC.put("requestId", "req-1");

        AtomicReference<Long> orgAfterTask = new AtomicReference<>();
        AtomicReference<String> mdcAfterTask = new AtomicReference<>();
        AtomicReference<Object> authAfterTask = new AtomicReference<>();
        Runnable decorated = decorator.decorate(() -> { /* no-op */ });

        // Act : execute la tache puis relit les ThreadLocals SUR LE MEME thread
        Thread worker = new Thread(() -> {
            decorated.run();
            orgAfterTask.set(tenantContext.getOrganizationId());
            mdcAfterTask.set(MDC.get("requestId"));
            authAfterTask.set(SecurityContextHolder.getContext().getAuthentication());
        });
        worker.start();
        worker.join(5_000);

        assertThat(orgAfterTask.get()).isNull();
        assertThat(mdcAfterTask.get()).isNull();
        assertThat(authAfterTask.get()).isNull();
    }

    @Test
    void whenTaskThrows_thenThreadLocalsAreStillCleared() throws Exception {
        tenantContext.setOrganizationId(7L);

        AtomicReference<Long> orgAfterTask = new AtomicReference<>();
        Runnable decorated = decorator.decorate(() -> {
            throw new IllegalStateException("boom");
        });

        Thread worker = new Thread(() -> {
            try {
                decorated.run();
            } catch (IllegalStateException expected) {
                // ignore : on verifie le nettoyage
            }
            orgAfterTask.set(tenantContext.getOrganizationId());
        });
        worker.start();
        worker.join(5_000);

        assertThat(orgAfterTask.get()).isNull();
    }

    @Test
    void whenAsyncConfigBuildsExecutor_thenTasksGetTenantContext() throws Exception {
        // Arrange : l'executor expose par AsyncConfig doit appliquer le decorateur
        AsyncConfig asyncConfig = new AsyncConfig(tenantContext);
        var executor = asyncConfig.getAsyncExecutor();
        assertThat(executor).isInstanceOf(TaskExecutorAdapter.class);

        tenantContext.setOrganizationId(99L);
        CompletableFuture<Long> seenOrgId = new CompletableFuture<>();

        // Act
        executor.execute(() -> seenOrgId.complete(tenantContext.getOrganizationId()));

        // Assert
        assertThat(seenOrgId.get(5, TimeUnit.SECONDS)).isEqualTo(99L);
    }

    private void runOnFreshThread(Runnable task) throws InterruptedException {
        Thread worker = new Thread(task);
        worker.start();
        worker.join(5_000);
        assertThat(worker.isAlive()).isFalse();
    }
}
