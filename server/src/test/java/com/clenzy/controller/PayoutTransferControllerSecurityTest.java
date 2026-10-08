package com.clenzy.controller;

import com.clenzy.service.payout.PayoutTransferQueryService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringJUnitConfig(PayoutTransferControllerSecurityTest.Config.class)
class PayoutTransferControllerSecurityTest {
    @Configuration @EnableMethodSecurity
    static class Config {
        @Bean PayoutTransferQueryService service() { return mock(PayoutTransferQueryService.class); }
        @Bean TenantContext tenant() { return mock(TenantContext.class); }
        @Bean PayoutTransferController controller(PayoutTransferQueryService service,TenantContext tenant) {
            return new PayoutTransferController(service,tenant);
        }
    }
    @Autowired PayoutTransferController controller;
    @Autowired PayoutTransferQueryService service;
    @Autowired TenantContext tenant;
    @BeforeEach void setup() { reset(service,tenant); when(tenant.getRequiredOrganizationId()).thenReturn(7L); }
    @Test @WithMockUser(roles="TECHNICIAN")
    void providerCannotBrowseOtherBeneficiariesFinancialJournal() {
        assertThatThrownBy(() -> controller.list(0,25,null,null,"")).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.detail(1L)).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(service);
    }
    @Test @WithMockUser(roles="HOST")
    void hostCannotBrowsePlatformFinancialJournal() {
        assertThatThrownBy(() -> controller.detail(1L)).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(service);
    }
    @Test @WithMockUser(roles="SUPER_MANAGER")
    void platformReadAlwaysUsesSelectedTenant() {
        controller.list(0,25,null,null,""); controller.detail(1L);
        verify(service).list(7L,0,25,null,null,""); verify(service).detail(7L,1L);
    }
}
