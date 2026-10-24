package com.clenzy.controller;

import com.clenzy.service.agent.BaitlyChatRecoveryService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

/** Baitly recovery is protected by method security before reading the journal. */
@SpringJUnitConfig(BaitlyChatRecoverySecurityTest.Config.class)
class BaitlyChatRecoverySecurityTest {
    @Configuration
    @EnableMethodSecurity
    static class Config {
        @Bean BaitlyChatRecoveryService recovery() { return Mockito.mock(BaitlyChatRecoveryService.class); }
        @Bean TenantContext tenant() { return Mockito.mock(TenantContext.class); }
        @Bean BaitlyChatRecoveryController controller(BaitlyChatRecoveryService recovery, TenantContext tenant) {
            return new BaitlyChatRecoveryController(recovery, tenant);
        }
    }
    @Autowired BaitlyChatRecoveryController controller;
    @Autowired BaitlyChatRecoveryService recovery;
    @Autowired TenantContext tenant;

    @BeforeEach void resetMocks() { reset(recovery, tenant); }
    private Jwt jwt() {
        var jwt = mock(Jwt.class);
        when(jwt.getSubject()).thenReturn("recipe-user");
        return jwt;
    }
    @Test @WithMockUser(roles = "HOST")
    void hostScopeComesFromAuthenticatedSubjectAndTenant() {
        when(tenant.getRequiredOrganizationId()).thenReturn(7L);
        var proof = new BaitlyChatRecoveryService.Recovery(1, "durable-decision-v1", 9L, false, List.of());
        when(recovery.read(9L, "recipe-user", 7L)).thenReturn(proof);
        assertThat(controller.read(9L, jwt())).isSameAs(proof);
        verify(recovery).read(9L, "recipe-user", 7L);
    }
    @Test @WithMockUser(roles = "HOUSEKEEPER")
    void operationalRoleCannotReadRecovery() {
        assertThatThrownBy(() -> controller.read(9L, jwt())).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(recovery, tenant);
    }
    @Test void anonymousCannotReadRecovery() {
        assertThatThrownBy(() -> controller.read(9L, jwt()))
                .isInstanceOf(AuthenticationCredentialsNotFoundException.class);
        verifyNoInteractions(recovery, tenant);
    }
}
