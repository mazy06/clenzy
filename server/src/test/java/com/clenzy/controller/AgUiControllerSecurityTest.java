package com.clenzy.controller;

import com.clenzy.service.agent.AgentOrchestrator;
import com.clenzy.service.agent.PendingToolStore;
import com.clenzy.tenant.TenantContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Verifie le RBAC {@code @PreAuthorize} de {@link AgUiController} : l'orchestrateur
 * multi-agent (lecture financiere, creation/annulation de reservations, blocage de
 * calendrier, ajustement de tarifs) est reserve aux roles de gestion
 * (SUPER_ADMIN / SUPER_MANAGER / HOST / SUPERVISOR), alignes sur
 * SUPERVISION_OPERATOR_ROLES du front. Les roles operationnels (TECHNICIAN,
 * HOUSEKEEPER) sont refuses cote API — pas seulement masques cote UI.
 */
@SpringJUnitConfig(AgUiControllerSecurityTest.Config.class)
class AgUiControllerSecurityTest {

    @Configuration
    @EnableMethodSecurity
    static class Config {
        @Bean AgentOrchestrator orchestrator() { return Mockito.mock(AgentOrchestrator.class); }
        @Bean TenantContext tenantContext() { return Mockito.mock(TenantContext.class); }
        @Bean ObjectMapper objectMapper() { return new ObjectMapper(); }
        @Bean PendingToolStore pendingToolStore() { return Mockito.mock(PendingToolStore.class); }

        @Bean
        AgUiController controller(AgentOrchestrator orchestrator, TenantContext tenantContext,
                                  ObjectMapper objectMapper, PendingToolStore pendingToolStore) {
            return new AgUiController(orchestrator, tenantContext, objectMapper, pendingToolStore);
        }
    }

    @Autowired private AgUiController controller;
    @Autowired private PendingToolStore pendingToolStore;

    @BeforeEach
    void reset() {
        Mockito.reset(pendingToolStore);
    }

    private Jwt jwt() {
        Jwt jwt = Mockito.mock(Jwt.class);
        when(jwt.getSubject()).thenReturn("kc-user-1");
        return jwt;
    }

    @Test
    @WithMockUser(roles = "TECHNICIAN")
    @DisplayName("TECHNICIAN ne peut pas acceder a l'agent (acces refuse)")
    void technician_denied() {
        assertThatThrownBy(() -> controller.pending(jwt()))
                .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(pendingToolStore);
    }

    @Test
    @WithMockUser(roles = "HOUSEKEEPER")
    void housekeeper_denied() {
        assertThatThrownBy(() -> controller.pending(jwt()))
                .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(pendingToolStore);
    }

    @Test
    @WithMockUser(roles = "HOST")
    void host_allowed() {
        when(pendingToolStore.listForUser(anyString())).thenReturn(List.of());
        assertThat(controller.pending(jwt())).isEmpty();
    }

    @Test
    @WithMockUser(roles = "SUPER_ADMIN")
    void superAdmin_allowed() {
        when(pendingToolStore.listForUser(anyString())).thenReturn(List.of());
        assertThat(controller.pending(jwt())).isEmpty();
    }

    @Test
    @WithMockUser(roles = "SUPERVISOR")
    @DisplayName("SUPERVISOR (operateur) est autorise")
    void supervisor_allowed() {
        when(pendingToolStore.listForUser(anyString())).thenReturn(List.of());
        assertThat(controller.pending(jwt())).isEmpty();
    }
}
