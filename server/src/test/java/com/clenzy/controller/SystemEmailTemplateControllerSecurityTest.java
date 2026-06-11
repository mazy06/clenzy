package com.clenzy.controller;

import com.clenzy.dto.SystemEmailTemplateDto;
import com.clenzy.model.SystemEmailTemplate;
import com.clenzy.service.messaging.SystemEmailTemplateService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Verifie les regles {@code @PreAuthorize} de {@link SystemEmailTemplateController}
 * (Z7-SEC-01) : l'ecriture des overrides de templates email — emis a des tiers
 * (owners, guests) — est reservee aux roles d'administration d'org ; les roles
 * operationnels (TECHNICIAN, HOUSEKEEPER…) gardent la lecture seule.
 */
@SpringJUnitConfig(SystemEmailTemplateControllerSecurityTest.Config.class)
class SystemEmailTemplateControllerSecurityTest {

    @Configuration
    @EnableMethodSecurity
    static class Config {
        @Bean
        SystemEmailTemplateService templateService() {
            return Mockito.mock(SystemEmailTemplateService.class);
        }

        @Bean
        TenantContext tenantContext() {
            return Mockito.mock(TenantContext.class);
        }

        @Bean
        SystemEmailTemplateController controller(SystemEmailTemplateService templateService,
                                                   TenantContext tenantContext) {
            return new SystemEmailTemplateController(templateService, tenantContext);
        }
    }

    @Autowired private SystemEmailTemplateController controller;
    @Autowired private SystemEmailTemplateService templateService;
    @Autowired private TenantContext tenantContext;

    private static final Long ORG_ID = 1L;

    @BeforeEach
    void resetMocks() {
        Mockito.reset(templateService, tenantContext);
    }

    private SystemEmailTemplateController.UpsertOverrideRequest upsertRequest() {
        return new SystemEmailTemplateController.UpsertOverrideRequest("Sujet", "Body");
    }

    private SystemEmailTemplate savedTemplate() {
        SystemEmailTemplate t = new SystemEmailTemplate();
        t.setId(99L);
        t.setOrganizationId(ORG_ID);
        t.setTemplateKey("noise_alert_owner");
        t.setLanguage("fr");
        t.setRecipientType("OWNER");
        t.setSubject("Sujet");
        t.setBody("Body");
        t.setWrapperStyle("NOTIFICATION_OWNER");
        return t;
    }

    @Test
    @WithMockUser(roles = "TECHNICIAN")
    @DisplayName("TECHNICIAN ne peut pas modifier un template (acces refuse)")
    void whenTechnicianUpsertsOverride_thenAccessDenied() {
        assertThatThrownBy(() -> controller.upsertOverride("noise_alert_owner", "fr", upsertRequest()))
            .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(templateService);
    }

    @Test
    @WithMockUser(roles = "HOUSEKEEPER")
    void whenHousekeeperRemovesOverride_thenAccessDenied() {
        assertThatThrownBy(() -> controller.removeOverride("noise_alert_owner", "fr"))
            .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(templateService);
    }

    @Test
    @WithMockUser(roles = "SUPERVISOR")
    void whenSupervisorUpsertsOverride_thenAccessDenied() {
        assertThatThrownBy(() -> controller.upsertOverride("noise_alert_owner", "fr", upsertRequest()))
            .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(templateService);
    }

    @Test
    @WithMockUser(roles = "HOST")
    void whenHostUpsertsOverride_thenAllowed() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
        when(templateService.upsertOverride(anyLong(), anyString(), anyString(), anyString(), anyString()))
            .thenReturn(savedTemplate());

        ResponseEntity<SystemEmailTemplateDto> response =
            controller.upsertOverride("noise_alert_owner", "fr", upsertRequest());

        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    @WithMockUser(roles = "SUPER_ADMIN")
    void whenSuperAdminRemovesOverride_thenAllowed() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);

        ResponseEntity<Void> response = controller.removeOverride("noise_alert_owner", "fr");

        assertThat(response.getStatusCode().value()).isEqualTo(204);
    }

    @Test
    @WithMockUser(roles = "TECHNICIAN")
    @DisplayName("la lecture reste ouverte a tous les roles authentifies")
    void whenTechnicianListsTemplates_thenAllowed() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
        when(templateService.listGroupedForOrg(ORG_ID)).thenReturn(Map.of());

        assertThat(controller.listGrouped()).isEmpty();
    }
}
