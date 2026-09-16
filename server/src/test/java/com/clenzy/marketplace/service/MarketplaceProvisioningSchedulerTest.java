package com.clenzy.marketplace.service;

import org.junit.jupiter.api.Test;
import java.util.List;
import static org.mockito.Mockito.*;

class MarketplaceProvisioningSchedulerTest {
    @Test
    void oneUnavailableAccountDoesNotBlockTheRestOfTheBatch() {
        var jobs = mock(MarketplaceProvisioningJobs.class);
        var onboarding = mock(MarketplaceOnboardingService.class);
        when(jobs.due()).thenReturn(List.of(1L, 2L));
        when(onboarding.onboard(1L)).thenThrow(new RuntimeException("indisponible"));
        new MarketplaceProvisioningScheduler(jobs, onboarding).retryDue();
        verify(onboarding).onboard(2L);
    }
}
