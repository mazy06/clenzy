package com.clenzy.controller;

import com.clenzy.service.payout.PayoutMonitoringService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringJUnitConfig(PayoutMonitoringControllerSecurityTest.Config.class)
class PayoutMonitoringControllerSecurityTest {
    @Configuration @EnableMethodSecurity static class Config {
        @Bean PayoutMonitoringService service() { return mock(PayoutMonitoringService.class); }
        @Bean TenantContext tenant() { return mock(TenantContext.class); }
        @Bean PayoutMonitoringController controller(PayoutMonitoringService service,TenantContext tenant) { return new PayoutMonitoringController(service,tenant); }
    }
    @Autowired PayoutMonitoringController controller;
    @Autowired PayoutMonitoringService service;
    @Autowired TenantContext tenant;
    @BeforeEach void setup() { reset(service,tenant);when(tenant.getRequiredOrganizationId()).thenReturn(7L); }
    @Test @WithMockUser(roles="HOST") void hostCannotReadPlatformAlerts() {
        assertThatThrownBy(() -> controller.read(0)).isInstanceOf(AccessDeniedException.class);verifyNoInteractions(service);
    }
    @Test @WithMockUser(roles="TECHNICIAN") void providerCannotReadPlatformAlerts() {
        assertThatThrownBy(() -> controller.read(0)).isInstanceOf(AccessDeniedException.class);verifyNoInteractions(service);
    }
    @Test @WithMockUser(roles="SUPER_MANAGER") void alertsUseOnlySelectedOrganization() {
        controller.read(2);verify(service).read(7L,2);
    }
}
