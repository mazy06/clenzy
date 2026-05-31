package com.clenzy.controller;

import com.clenzy.dto.SystemEmailTemplateDto;
import com.clenzy.dto.SystemEmailTemplateGroupDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.SystemEmailTemplate;
import com.clenzy.service.messaging.SystemEmailTemplateService;
import com.clenzy.service.messaging.TemplateInterpolationService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SystemEmailTemplateControllerTest {

    @Mock private SystemEmailTemplateService templateService;
    @Mock private TenantContext tenantContext;

    private SystemEmailTemplateController controller;

    private static final Long ORG_ID = 1L;

    @BeforeEach
    void setUp() {
        controller = new SystemEmailTemplateController(templateService, tenantContext);
    }

    private SystemEmailTemplate buildTemplate(Long id, Long orgId, String key, String lang, String subject, String body) {
        SystemEmailTemplate t = new SystemEmailTemplate();
        t.setId(id);
        t.setOrganizationId(orgId);
        t.setTemplateKey(key);
        t.setLanguage(lang);
        t.setRecipientType("OWNER");
        t.setSubject(subject);
        t.setBody(body);
        t.setWrapperStyle("NOTIFICATION_OWNER");
        t.setSystem(orgId == null);
        return t;
    }

    @Nested
    @DisplayName("listGrouped")
    class ListGrouped {
        @Test
        void returnsGroupedTemplates() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);

            Map<String, SystemEmailTemplate> langs = new LinkedHashMap<>();
            langs.put("fr", buildTemplate(1L, null, "noise_alert_owner", "fr", "Sujet {guestName}", "Body"));
            langs.put("en", buildTemplate(2L, ORG_ID, "noise_alert_owner", "en", "Subject", "Body"));

            Map<String, Map<String, SystemEmailTemplate>> grouped = new LinkedHashMap<>();
            grouped.put("noise_alert_owner", langs);

            when(templateService.listGroupedForOrg(ORG_ID)).thenReturn(grouped);

            List<SystemEmailTemplateGroupDto> result = controller.listGrouped();

            assertThat(result).hasSize(1);
            assertThat(result.get(0).templateKey()).isEqualTo("noise_alert_owner");
            assertThat(result.get(0).languages()).hasSize(2);
            assertThat(result.get(0).isCustomized()).isTrue(); // en is override
        }

        @Test
        void emptyMap_returnsEmptyList() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(templateService.listGroupedForOrg(ORG_ID)).thenReturn(Map.of());

            List<SystemEmailTemplateGroupDto> result = controller.listGrouped();

            assertThat(result).isEmpty();
        }

        @Test
        void systemOnlyTemplate_notCustomized() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);

            Map<String, SystemEmailTemplate> langs = new LinkedHashMap<>();
            langs.put("fr", buildTemplate(1L, null, "noise_alert_owner", "fr", "Sujet", "Body"));

            Map<String, Map<String, SystemEmailTemplate>> grouped = new LinkedHashMap<>();
            grouped.put("noise_alert_owner", langs);

            when(templateService.listGroupedForOrg(ORG_ID)).thenReturn(grouped);

            List<SystemEmailTemplateGroupDto> result = controller.listGrouped();

            assertThat(result).hasSize(1);
            assertThat(result.get(0).isCustomized()).isFalse();
        }
    }

    @Nested
    @DisplayName("getByKey")
    class GetByKey {
        @Test
        void whenFound_returnsGroup() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);

            Map<String, SystemEmailTemplate> langs = new LinkedHashMap<>();
            langs.put("fr", buildTemplate(1L, null, "noise_alert_owner", "fr", "Sujet", "Body avec {guestName}"));

            Map<String, Map<String, SystemEmailTemplate>> grouped = new LinkedHashMap<>();
            grouped.put("noise_alert_owner", langs);
            when(templateService.listGroupedForOrg(ORG_ID)).thenReturn(grouped);

            ResponseEntity<SystemEmailTemplateGroupDto> response = controller.getByKey("noise_alert_owner");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().languages()).containsKey("fr");
            assertThat(response.getBody().languages().get("fr").variables()).contains("guestName");
        }

        @Test
        void whenNotFound_returns404() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(templateService.listGroupedForOrg(ORG_ID)).thenReturn(Map.of());

            ResponseEntity<SystemEmailTemplateGroupDto> response = controller.getByKey("nonexistent");

            assertThat(response.getStatusCode().value()).isEqualTo(404);
        }

        @Test
        void whenEmptyLanguages_returns404() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            Map<String, Map<String, SystemEmailTemplate>> grouped = new LinkedHashMap<>();
            grouped.put("some_key", Map.of());
            when(templateService.listGroupedForOrg(ORG_ID)).thenReturn(grouped);

            ResponseEntity<SystemEmailTemplateGroupDto> response = controller.getByKey("some_key");

            assertThat(response.getStatusCode().value()).isEqualTo(404);
        }
    }

    @Nested
    @DisplayName("upsertOverride")
    class UpsertOverride {
        @Test
        void whenSuccess_returnsDto() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            SystemEmailTemplate saved = buildTemplate(99L, ORG_ID, "noise_alert_owner", "fr",
                "Nouveau {guestName}", "Body");
            when(templateService.upsertOverride(ORG_ID, "noise_alert_owner", "fr", "Nouveau {guestName}", "Body"))
                .thenReturn(saved);

            SystemEmailTemplateController.UpsertOverrideRequest req =
                new SystemEmailTemplateController.UpsertOverrideRequest("Nouveau {guestName}", "Body");

            ResponseEntity<SystemEmailTemplateDto> response = controller.upsertOverride(
                "noise_alert_owner", "fr", req);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().id()).isEqualTo(99L);
            assertThat(response.getBody().variables()).contains("guestName");
        }

        @Test
        void whenNotFound_returns404() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(templateService.upsertOverride(anyLong(), anyString(), anyString(), anyString(), anyString()))
                .thenThrow(new NotFoundException("Aucun template systeme"));

            SystemEmailTemplateController.UpsertOverrideRequest req =
                new SystemEmailTemplateController.UpsertOverrideRequest("Subject", "Body");

            ResponseEntity<SystemEmailTemplateDto> response = controller.upsertOverride(
                "bad_key", "xx", req);

            assertThat(response.getStatusCode().value()).isEqualTo(404);
        }

        @Test
        void whenIllegalArgument_returns400() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(templateService.upsertOverride(anyLong(), anyString(), anyString(), anyString(), anyString()))
                .thenThrow(new IllegalArgumentException("subject too long"));

            SystemEmailTemplateController.UpsertOverrideRequest req =
                new SystemEmailTemplateController.UpsertOverrideRequest("X".repeat(300), "Body");

            ResponseEntity<SystemEmailTemplateDto> response = controller.upsertOverride(
                "key", "fr", req);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }
    }

    @Nested
    @DisplayName("removeOverride")
    class RemoveOverride {
        @Test
        void whenSuccess_returns204() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            doNothing().when(templateService).removeOverride(ORG_ID, "key", "fr");

            ResponseEntity<Void> response = controller.removeOverride("key", "fr");

            assertThat(response.getStatusCode().value()).isEqualTo(204);
        }

        @Test
        void whenNotFound_returns404() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            doThrow(new NotFoundException("not found"))
                .when(templateService).removeOverride(ORG_ID, "bad_key", "fr");

            ResponseEntity<Void> response = controller.removeOverride("bad_key", "fr");

            assertThat(response.getStatusCode().value()).isEqualTo(404);
        }
    }

    @Nested
    @DisplayName("getVariables")
    class GetVariables {
        @Test
        void returnsSupportedVariables() {
            List<TemplateInterpolationService.TemplateVariable> result = controller.getVariables();

            assertThat(result).isNotEmpty();
            assertThat(result).isSameAs(TemplateInterpolationService.SUPPORTED_VARIABLES);
        }
    }
}
