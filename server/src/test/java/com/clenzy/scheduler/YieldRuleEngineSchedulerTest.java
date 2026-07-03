package com.clenzy.scheduler;

import com.clenzy.model.YieldOrgConfig;
import com.clenzy.repository.YieldOrgConfigRepository;
import com.clenzy.service.yield.YieldRuleEngine;
import com.clenzy.tenant.TenantScopedExecutor;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("YieldRuleEngineScheduler (itération des orgs kill-switch ON)")
class YieldRuleEngineSchedulerTest {

    @Mock private YieldOrgConfigRepository configRepository;
    @Mock private YieldRuleEngine yieldRuleEngine;
    @Mock private TenantScopedExecutor tenantScopedExecutor;

    @InjectMocks private YieldRuleEngineScheduler scheduler;

    private static YieldOrgConfig enabledConfig(Long orgId) {
        YieldOrgConfig config = new YieldOrgConfig(orgId);
        config.setEnabled(true);
        return config;
    }

    @Test
    void whenNoOrgHasYieldEnabled_thenNothingRuns() {
        when(configRepository.findByEnabledTrue()).thenReturn(List.of());

        scheduler.runDaily();

        verifyNoInteractions(tenantScopedExecutor, yieldRuleEngine);
    }

    @Test
    void whenOrgsAreEnabled_thenEachIsEvaluatedInTenantScope() {
        when(configRepository.findByEnabledTrue())
                .thenReturn(List.of(enabledConfig(1L), enabledConfig(2L)));
        doAnswer(invocation -> {
            invocation.getArgument(1, Runnable.class).run();
            return null;
        }).when(tenantScopedExecutor).runAsOrganization(any(), any(Runnable.class));

        scheduler.runDaily();

        verify(yieldRuleEngine).evaluateOrganization(1L);
        verify(yieldRuleEngine).evaluateOrganization(2L);
    }

    @Test
    void whenOneOrgFails_thenOthersStillRun() {
        when(configRepository.findByEnabledTrue())
                .thenReturn(List.of(enabledConfig(1L), enabledConfig(2L)));
        doThrow(new IllegalStateException("boom"))
                .when(tenantScopedExecutor).runAsOrganization(eq(1L), any(Runnable.class));
        doAnswer(invocation -> {
            invocation.getArgument(1, Runnable.class).run();
            return null;
        }).when(tenantScopedExecutor).runAsOrganization(eq(2L), any(Runnable.class));

        scheduler.runDaily();

        verify(yieldRuleEngine).evaluateOrganization(2L);
    }
}
