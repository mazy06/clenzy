package com.clenzy.controller;

import com.clenzy.dto.HousekeeperPayoutDtos.RetryQuote;
import com.clenzy.dto.HousekeeperPayoutDtos.RetryRequest;
import com.clenzy.model.HousekeeperPayoutRecord;
import com.clenzy.service.payout.HousekeeperPayoutService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import java.math.BigDecimal;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringJUnitConfig(BaitlyPayoutRetryControllerSecurityTest.Config.class)
class BaitlyPayoutRetryControllerSecurityTest {
    @Configuration @EnableMethodSecurity
    static class Config {
        @Bean HousekeeperPayoutService service() { return mock(HousekeeperPayoutService.class); }
        @Bean TenantContext tenant() { return mock(TenantContext.class); }
        @Bean HousekeeperPayoutController controller(HousekeeperPayoutService service, TenantContext tenant) {
            return new HousekeeperPayoutController(service, tenant);
        }
    }
    @Autowired HousekeeperPayoutController controller;
    @Autowired HousekeeperPayoutService service;
    @Autowired TenantContext tenant;
    private final RetryRequest request = new RetryRequest(new BigDecimal("70.00"), BigDecimal.ZERO);
    @BeforeEach void setup() { reset(service, tenant); when(tenant.getRequiredOrganizationId()).thenReturn(7L); }
    @Test @WithMockUser(roles="HOST") void ownerCannotPreviewOrLaunchPlatformPayout() { denied(); }
    @Test @WithMockUser(roles="TECHNICIAN") void providerCannotPreviewOrLaunchPlatformPayout() { denied(); }
    private void denied() {
        assertThatThrownBy(() -> controller.previewRetry(11L)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.retryPayout(11L, request)).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(service);
    }
    @Test @WithMockUser(roles="SUPER_MANAGER") void previewUsesAuthenticatedTenantOnly() {
        controller.previewRetry(11L);
        verify(service).previewRetry(11L, 7L);
        verifyNoMoreInteractions(service);
    }
    @Test @WithMockUser(roles="SUPER_ADMIN") void launchPropagatesExactConfirmedAmounts() {
        var quote = new RetryQuote(request.amount(), request.commissionAmount());
        when(service.retryPayout(11L, 7L, quote)).thenReturn(new HousekeeperPayoutRecord(
                7L, 3L, 352L, request.amount(), BigDecimal.ZERO, HousekeeperPayoutRecord.Status.PENDING));
        controller.retryPayout(11L, request);
        verify(service).retryPayout(11L, 7L, quote);
        verifyNoMoreInteractions(service);
    }
    @Test void monetaryRequestRequiresBothExactNonnegativeAmounts() {
        try (var factory = jakarta.validation.Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            assertThat(validator.validate(new RetryRequest(null, null))).hasSize(2);
            assertThat(validator.validate(new RetryRequest(new BigDecimal("70.001"), BigDecimal.ZERO))).hasSize(1);
            assertThat(validator.validate(new RetryRequest(BigDecimal.ZERO, BigDecimal.valueOf(-1)))).hasSize(2);
            assertThat(validator.validate(request)).isEmpty();
        }
    }

    @Test @WithMockUser(roles="SUPER_ADMIN") void businessRefusalIsVisibleAsConflictInsteadOfServerFailure() throws Exception {
        when(service.previewRetry(11L, 7L)).thenThrow(
                new com.clenzy.exception.BaitlyPayoutNotReadyException("Encaissement non confirmé"));
        var mvc = org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new com.clenzy.exception.GlobalExceptionHandler(mock(com.clenzy.config.SyncMetrics.class)))
                .build();
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/housekeeper-payouts/11/retry-preview"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isConflict())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.message").value("Encaissement non confirmé"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.code").value("PAYOUT_NOT_READY"));
    }
}
