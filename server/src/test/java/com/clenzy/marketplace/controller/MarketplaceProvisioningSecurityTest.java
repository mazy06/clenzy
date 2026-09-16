package com.clenzy.marketplace.controller;

import com.clenzy.marketplace.service.MarketplaceProvisioningJobs;
import com.clenzy.marketplace.service.MarketplaceActivationDeliveries;
import org.junit.jupiter.api.*;
import org.springframework.context.annotation.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.access.AccessDeniedException;
import java.util.List;
import java.util.Optional;
import java.time.LocalDateTime;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

class MarketplaceProvisioningSecurityTest {
    @Configuration
    @EnableMethodSecurity
    static class Config {
        @Bean MarketplaceProvisioningJobs jobs() { return mock(MarketplaceProvisioningJobs.class); }
        @Bean MarketplaceActivationDeliveries deliveries() { return mock(MarketplaceActivationDeliveries.class); }
        @Bean MarketplaceProvisioningController controller(MarketplaceProvisioningJobs jobs, MarketplaceActivationDeliveries deliveries) {
            return new MarketplaceProvisioningController(jobs, deliveries);
        }
    }

    @AfterEach
    void cleanup() { SecurityContextHolder.clearContext(); }

    @Test
    void providersCannotInspectAnotherCandidatesProvisioning() {
        try (var context = new AnnotationConfigApplicationContext(Config.class)) {
            authenticate("TECHNICIAN");
            assertThatThrownBy(() -> context.getBean(MarketplaceProvisioningController.class).state(7L))
                    .isInstanceOf(AccessDeniedException.class);
            verifyNoInteractions(context.getBean(MarketplaceProvisioningJobs.class));
        }
    }

    @Test
    void platformStaffCanInspectTheProvisioningState() {
        try (var context = new AnnotationConfigApplicationContext(Config.class)) {
            authenticate("SUPER_MANAGER");
            var state = new MarketplaceProvisioningJobs.State("RETRY", 1, LocalDateTime.now(), "FAILED", false);
            when(context.getBean(MarketplaceProvisioningJobs.class).state(7L)).thenReturn(Optional.of(state));
            assertThat(context.getBean(MarketplaceProvisioningController.class).state(7L)).isEqualTo(state);
        }
    }

    @Test
    void onlyPlatformStaffCanRequestATracedRetry() {
        try (var context = new AnnotationConfigApplicationContext(Config.class)) {
            var controller = context.getBean(MarketplaceProvisioningController.class);
            var jwt = org.springframework.security.oauth2.jwt.Jwt.withTokenValue("test").header("alg", "none").subject("staff-id").build();
            authenticate("HOST");
            assertThatThrownBy(() -> controller.retry(7L, jwt)).isInstanceOf(AccessDeniedException.class);
            var jobs = context.getBean(MarketplaceProvisioningJobs.class);
            verifyNoInteractions(jobs);
            authenticate("SUPER_MANAGER");
            when(jobs.retry(7L, "staff-id")).thenReturn(true);
            controller.retry(7L, jwt);
            verify(jobs).retry(7L, "staff-id");
        }
    }

    private void authenticate(String role) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "test", "", List.of(new SimpleGrantedAuthority("ROLE_" + role))));
    }

    @Test
    void invitationDiagnosticsAreReservedForPlatformStaffAndContainNoSecrets() throws Exception {
        try (var context = new AnnotationConfigApplicationContext(Config.class)) {
            var controller = context.getBean(MarketplaceProvisioningController.class);
            var deliveries = context.getBean(MarketplaceActivationDeliveries.class);
            for (String role : List.of("HOST", "TECHNICIAN", "SUPERVISOR")) {
                authenticate(role);
                assertThatThrownBy(() -> controller.invitation(7L)).isInstanceOf(AccessDeniedException.class);
            }
            verifyNoInteractions(deliveries);
            authenticate("SUPER_MANAGER");
            var state = new MarketplaceActivationDeliveries.State("SENT", 1, LocalDateTime.now(), null, LocalDateTime.now(), LocalDateTime.now().plusDays(7), true);
            when(deliveries.state(7L)).thenReturn(Optional.of(state));
            var json = new com.fasterxml.jackson.databind.ObjectMapper().findAndRegisterModules().valueToTree(controller.invitation(7L));
            assertThat(json.size()).isEqualTo(7);
            assertThat(json.has("encryptedToken")).isFalse();
            assertThat(json.has("tokenHash")).isFalse();
            assertThat(json.has("claimToken")).isFalse();
        }
    }
}
