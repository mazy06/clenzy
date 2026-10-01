package com.clenzy.service;

import com.clenzy.controller.ConsumablesController;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import java.util.List;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class ConsumablesControllerSecurityTest {
    @Configuration
    @EnableMethodSecurity
    static class Config {
        @Bean ConsumablesOverviewService service() { return mock(ConsumablesOverviewService.class); }
        @Bean TenantContext tenant() { return mock(TenantContext.class); }
        @Bean ConsumablesController controller(ConsumablesOverviewService service, TenantContext tenant) {
            return new ConsumablesController(service, tenant);
        }
    }
    @Test void rolesAreEnforcedAndOrganizationAlwaysComesFromTheAuthenticatedContext() {
        try (var context = new AnnotationConfigApplicationContext(Config.class)) {
            var controller = context.getBean(ConsumablesController.class);
            var service = context.getBean(ConsumablesOverviewService.class);
            var tenant = context.getBean(TenantContext.class);
            when(tenant.getRequiredOrganizationId()).thenReturn(17L);
            SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("worker", "",
                    List.of(new SimpleGrantedAuthority("ROLE_TECHNICIAN"))));
            assertThatThrownBy(controller::properties).isInstanceOf(AccessDeniedException.class);
            assertThatThrownBy(() -> controller.list(ConsumablesOverviewService.View.stock, null, "", 0, 20))
                    .isInstanceOf(AccessDeniedException.class);
            verifyNoInteractions(service);
            SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("host", "",
                    List.of(new SimpleGrantedAuthority("ROLE_HOST"))));
            controller.list(ConsumablesOverviewService.View.stock, 7L, "café", 0, 20);
            controller.properties();
            verify(service).list(17L, ConsumablesOverviewService.View.stock, 7L, "café", 0, 20);
            verify(service).propertyChoices(17L);
        } finally { SecurityContextHolder.clearContext(); }
    }
}
