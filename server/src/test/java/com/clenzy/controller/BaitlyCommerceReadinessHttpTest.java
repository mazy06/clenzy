package com.clenzy.controller;

import com.clenzy.service.BaitlyCommerceReadiness;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.time.Instant;
import java.util.List;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringJUnitConfig(BaitlyCommerceReadinessHttpTest.Config.class)
class BaitlyCommerceReadinessHttpTest {
    @Configuration @EnableMethodSecurity static class Config {
        @Bean BaitlyCommerceReadiness readiness() { return mock(BaitlyCommerceReadiness.class); }
        @Bean TenantContext tenant() { return mock(TenantContext.class); }
        @Bean BaitlyCommerceReadinessController controller(BaitlyCommerceReadiness r, TenantContext t) {
            return new BaitlyCommerceReadinessController(r, t);
        }
    }
    @Autowired BaitlyCommerceReadiness readiness;
    @Autowired TenantContext tenant;
    @Autowired BaitlyCommerceReadinessController controller;
    MockMvc mvc;
    @BeforeEach void setup() {
        reset(readiness, tenant); when(tenant.getRequiredOrganizationId()).thenReturn(7L);
        when(readiness.inspect(eq(7L), anyBoolean())).thenAnswer(call -> new BaitlyCommerceReadiness.Report(
                Instant.parse("2026-10-07T12:00:00Z"), call.getArgument(1), List.of(), List.of()));
        mvc = MockMvcBuilders.standaloneSetup(controller).build();
    }
    @Test void anonymousCannotInspectConfiguration() {
        assertThatThrownBy(() -> controller.inspect(true)).isInstanceOf(org.springframework.security.core.AuthenticationException.class);
        verifyNoInteractions(readiness, tenant);
    }
    @Test @WithMockUser(roles="HOST") void organizationMemberCannotInspectGlobalPlatformSettings() {
        assertThatThrownBy(() -> controller.inspect(true)).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(readiness, tenant);
    }
    @Test @WithMockUser(roles="SUPER_MANAGER") void httpDefaultsToLocalReadAndNeverUsesAnOrganizationFromTheQuery() throws Exception {
        mvc.perform(get("/api/payment-configs/diagnostic?organizationId=999"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.remoteVerification").value(false))
                .andExpect(jsonPath("$.providers").isArray());
        verify(readiness).inspect(7L, false);
    }
    @Test @WithMockUser(roles="SUPER_ADMIN") void explicitRemoteCheckIsReadOnlyAndTenantScoped() throws Exception {
        mvc.perform(get("/api/payment-configs/diagnostic?verify=true"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.remoteVerification").value(true));
        verify(readiness).inspect(7L, true);
    }
}
