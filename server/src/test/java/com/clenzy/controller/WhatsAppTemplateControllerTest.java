package com.clenzy.controller;

import com.clenzy.dto.WhatsAppTemplateGroupDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.WhatsAppTemplateContent;
import com.clenzy.service.messaging.whatsapp.WhatsAppTemplateService;
import com.clenzy.service.messaging.whatsapp.WhatsAppVariableConverter;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WhatsAppTemplateControllerTest {

    @Mock private WhatsAppTemplateService templateService;

    private TenantContext tenantContext;
    private WhatsAppVariableConverter converter;
    private WhatsAppTemplateController controller;

    private static final Long ORG_ID = 12L;

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(ORG_ID);
        converter = new WhatsAppVariableConverter(); // real one — simple regex extractor
        controller = new WhatsAppTemplateController(templateService, converter, tenantContext);
    }

    private WhatsAppTemplateContent sysTemplate(String key, String lang, String body) {
        WhatsAppTemplateContent c = new WhatsAppTemplateContent();
        c.setId(1L);
        c.setTemplateKey(key);
        c.setLanguage(lang);
        c.setCategory("UTILITY");
        c.setBodyNamed(body);
        c.setSystem(true);
        return c;
    }

    private WhatsAppTemplateContent orgTemplate(String key, String lang, String body, Long orgId) {
        WhatsAppTemplateContent c = new WhatsAppTemplateContent();
        c.setId(99L);
        c.setOrganizationId(orgId);
        c.setTemplateKey(key);
        c.setLanguage(lang);
        c.setCategory("UTILITY");
        c.setBodyNamed(body);
        c.setSystem(false);
        return c;
    }

    // ===================================================================
    // listGrouped
    // ===================================================================

    @Nested
    @DisplayName("listGrouped")
    class ListGrouped {

        @Test
        @DisplayName("returns grouped DTO with category and isCustomized flags")
        void returnsGroupedDto() {
            Map<String, Map<String, WhatsAppTemplateContent>> grouped = new LinkedHashMap<>();
            Map<String, WhatsAppTemplateContent> sys = new LinkedHashMap<>();
            sys.put("fr_FR", sysTemplate("a", "fr_FR", "Bonjour {x}"));
            sys.put("en_US", sysTemplate("a", "en_US", "Hi {x}"));
            grouped.put("a", sys);
            when(templateService.listGroupedForOrg(ORG_ID)).thenReturn(grouped);

            List<WhatsAppTemplateGroupDto> result = controller.listGrouped();

            assertThat(result).hasSize(1);
            assertThat(result.get(0).templateKey()).isEqualTo("a");
            assertThat(result.get(0).category()).isEqualTo("UTILITY");
            assertThat(result.get(0).isCustomized()).isFalse();
            assertThat(result.get(0).languages()).containsKeys("fr_FR", "en_US");
        }

        @Test
        @DisplayName("isCustomized is true when org template appears")
        void isCustomized_whenOrgOverride() {
            Map<String, Map<String, WhatsAppTemplateContent>> grouped = new LinkedHashMap<>();
            Map<String, WhatsAppTemplateContent> langs = new LinkedHashMap<>();
            langs.put("fr_FR", orgTemplate("k", "fr_FR", "Override {y}", ORG_ID));
            grouped.put("k", langs);
            when(templateService.listGroupedForOrg(ORG_ID)).thenReturn(grouped);

            List<WhatsAppTemplateGroupDto> result = controller.listGrouped();

            assertThat(result.get(0).isCustomized()).isTrue();
        }

        @Test
        @DisplayName("isCustomized is false when only system templates present")
        void noOverride_notCustomized() {
            Map<String, Map<String, WhatsAppTemplateContent>> grouped = new LinkedHashMap<>();
            Map<String, WhatsAppTemplateContent> langs = new LinkedHashMap<>();
            langs.put("fr_FR", sysTemplate("k", "fr_FR", "Bonjour {x}"));
            grouped.put("k", langs);
            when(templateService.listGroupedForOrg(ORG_ID)).thenReturn(grouped);

            List<WhatsAppTemplateGroupDto> result = controller.listGrouped();

            assertThat(result.get(0).isCustomized()).isFalse();
        }

        @Test
        @DisplayName("empty service result yields empty list")
        void emptyResult_emptyList() {
            when(templateService.listGroupedForOrg(ORG_ID)).thenReturn(Map.of());

            assertThat(controller.listGrouped()).isEmpty();
        }
    }

    // ===================================================================
    // getByKey
    // ===================================================================

    @Nested
    @DisplayName("getByKey")
    class GetByKey {

        @Test
        @DisplayName("returns 200 with group when key exists")
        void existing_returnsOk() {
            Map<String, Map<String, WhatsAppTemplateContent>> grouped = new LinkedHashMap<>();
            grouped.put("k", new LinkedHashMap<>(Map.of("fr_FR", sysTemplate("k", "fr_FR", "Bonjour {x}"))));
            when(templateService.listGroupedForOrg(ORG_ID)).thenReturn(grouped);

            ResponseEntity<WhatsAppTemplateGroupDto> response = controller.getByKey("k");

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().templateKey()).isEqualTo("k");
        }

        @Test
        @DisplayName("returns 404 when key not found")
        void unknownKey_returns404() {
            when(templateService.listGroupedForOrg(ORG_ID)).thenReturn(Map.of());

            assertThat(controller.getByKey("missing").getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        }

        @Test
        @DisplayName("returns 404 when key maps to empty language map")
        void emptyLanguages_returns404() {
            Map<String, Map<String, WhatsAppTemplateContent>> grouped = new LinkedHashMap<>();
            grouped.put("k", new LinkedHashMap<>());
            when(templateService.listGroupedForOrg(ORG_ID)).thenReturn(grouped);

            assertThat(controller.getByKey("k").getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        }
    }

    // ===================================================================
    // upsertOverride
    // ===================================================================

    @Nested
    @DisplayName("upsertOverride")
    class UpsertOverride {

        @Test
        @DisplayName("returns 200 with saved DTO")
        void success_returnsDto() {
            WhatsAppTemplateContent saved = orgTemplate("k", "fr_FR", "Override {z}", ORG_ID);
            when(templateService.upsertOverride(ORG_ID, "k", "fr_FR", "Override {z}")).thenReturn(saved);

            ResponseEntity<?> response = controller.upsertOverride("k", "fr_FR",
                new WhatsAppTemplateController.UpsertOverrideRequest("Override {z}"));

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody()).isNotNull();
        }

        @Test
        @DisplayName("returns 404 when service throws NotFoundException")
        void notFound_returns404() {
            when(templateService.upsertOverride(any(), any(), any(), any()))
                .thenThrow(new NotFoundException("missing system template"));

            ResponseEntity<?> response = controller.upsertOverride("k", "fr_FR",
                new WhatsAppTemplateController.UpsertOverrideRequest("body"));

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        }

        @Test
        @DisplayName("returns 400 when service throws IllegalArgumentException")
        void invalidArg_returns400() {
            when(templateService.upsertOverride(any(), any(), any(), any()))
                .thenThrow(new IllegalArgumentException("body too long"));

            ResponseEntity<?> response = controller.upsertOverride("k", "fr_FR",
                new WhatsAppTemplateController.UpsertOverrideRequest("body"));

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        }
    }

    // ===================================================================
    // removeOverride
    // ===================================================================

    @Nested
    @DisplayName("removeOverride")
    class RemoveOverride {

        @Test
        @DisplayName("returns 204 on success")
        void success_returns204() {
            doNothing().when(templateService).removeOverride(ORG_ID, "k", "fr_FR");

            ResponseEntity<Void> response = controller.removeOverride("k", "fr_FR");

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
            verify(templateService).removeOverride(ORG_ID, "k", "fr_FR");
        }

        @Test
        @DisplayName("returns 404 when service throws NotFoundException")
        void notFound_returns404() {
            doThrow(new NotFoundException("no override")).when(templateService)
                .removeOverride(ORG_ID, "k", "fr_FR");

            assertThat(controller.removeOverride("k", "fr_FR").getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
        }
    }

    // ===================================================================
    // preview
    // ===================================================================

    @Nested
    @DisplayName("preview")
    class Preview {

        @Test
        @DisplayName("interpolates mock values")
        void interpolates() {
            WhatsAppTemplateContent t = sysTemplate("k", "fr_FR", "Hi {guestFirstName}, code {accessCode}");
            when(templateService.resolve(ORG_ID, "k", "fr_FR")).thenReturn(Optional.of(t));

            ResponseEntity<WhatsAppTemplateController.PreviewResponse> response =
                controller.preview("k", "fr_FR", new WhatsAppTemplateController.PreviewRequest(
                    Map.of("guestFirstName", "Marie", "accessCode", "1234")));

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody().renderedBody()).isEqualTo("Hi Marie, code 1234");
        }

        @Test
        @DisplayName("leaves unknown variables in place")
        void unknownVar_leftAsIs() {
            WhatsAppTemplateContent t = sysTemplate("k", "fr_FR", "Hi {guestFirstName}, code {accessCode}");
            when(templateService.resolve(ORG_ID, "k", "fr_FR")).thenReturn(Optional.of(t));

            ResponseEntity<WhatsAppTemplateController.PreviewResponse> response =
                controller.preview("k", "fr_FR", new WhatsAppTemplateController.PreviewRequest(
                    Map.of("guestFirstName", "Marie")));

            assertThat(response.getBody().renderedBody()).isEqualTo("Hi Marie, code {accessCode}");
        }

        @Test
        @DisplayName("null mock values returns body unchanged")
        void nullMockValues_unchanged() {
            WhatsAppTemplateContent t = sysTemplate("k", "fr_FR", "Hi {x}");
            when(templateService.resolve(ORG_ID, "k", "fr_FR")).thenReturn(Optional.of(t));

            ResponseEntity<WhatsAppTemplateController.PreviewResponse> response =
                controller.preview("k", "fr_FR", new WhatsAppTemplateController.PreviewRequest(null));

            assertThat(response.getBody().renderedBody()).isEqualTo("Hi {x}");
        }

        @Test
        @DisplayName("empty mock values returns body unchanged")
        void emptyMockValues_unchanged() {
            WhatsAppTemplateContent t = sysTemplate("k", "fr_FR", "Hi {x}");
            when(templateService.resolve(ORG_ID, "k", "fr_FR")).thenReturn(Optional.of(t));

            ResponseEntity<WhatsAppTemplateController.PreviewResponse> response =
                controller.preview("k", "fr_FR", new WhatsAppTemplateController.PreviewRequest(Map.of()));

            assertThat(response.getBody().renderedBody()).isEqualTo("Hi {x}");
        }

        @Test
        @DisplayName("null replacement value replaced as empty string")
        void nullReplacement_emptyString() {
            WhatsAppTemplateContent t = sysTemplate("k", "fr_FR", "Hi {x}");
            when(templateService.resolve(ORG_ID, "k", "fr_FR")).thenReturn(Optional.of(t));

            Map<String, String> mock = new java.util.HashMap<>();
            mock.put("x", null);
            ResponseEntity<WhatsAppTemplateController.PreviewResponse> response =
                controller.preview("k", "fr_FR", new WhatsAppTemplateController.PreviewRequest(mock));

            assertThat(response.getBody().renderedBody()).isEqualTo("Hi ");
        }

        @Test
        @DisplayName("returns 404 when template missing")
        void missingTemplate_returns404() {
            when(templateService.resolve(ORG_ID, "k", "fr_FR")).thenReturn(Optional.empty());

            assertThat(controller.preview("k", "fr_FR",
                new WhatsAppTemplateController.PreviewRequest(Map.of())).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
        }

        @Test
        @DisplayName("empty body returns empty rendered string")
        void emptyBody_emptyRender() {
            WhatsAppTemplateContent t = sysTemplate("k", "fr_FR", "");
            when(templateService.resolve(ORG_ID, "k", "fr_FR")).thenReturn(Optional.of(t));

            ResponseEntity<WhatsAppTemplateController.PreviewResponse> response =
                controller.preview("k", "fr_FR",
                    new WhatsAppTemplateController.PreviewRequest(Map.of("x", "v")));

            assertThat(response.getBody().renderedBody()).isEmpty();
        }
    }

    // ===================================================================
    // getVariables
    // ===================================================================

    @Test
    @DisplayName("getVariables returns SUPPORTED_VARIABLES list")
    void getVariables_returnsList() {
        var result = controller.getVariables();
        assertThat(result).isNotNull();
        // Just check the list is non-null and matches the static
        assertThat(result).isSameAs(com.clenzy.service.messaging.TemplateInterpolationService.SUPPORTED_VARIABLES);
    }

    // ===================================================================
    // Payload records
    // ===================================================================

    @Test
    @DisplayName("UpsertOverrideRequest record accessor")
    void upsertOverrideRequestRecord() {
        var req = new WhatsAppTemplateController.UpsertOverrideRequest("body");
        assertThat(req.bodyNamed()).isEqualTo("body");
    }

    @Test
    @DisplayName("PreviewRequest record accessor")
    void previewRequestRecord() {
        var req = new WhatsAppTemplateController.PreviewRequest(Map.of("a", "b"));
        assertThat(req.mockValues()).containsEntry("a", "b");
    }

    @Test
    @DisplayName("PreviewResponse record accessor")
    void previewResponseRecord() {
        var resp = new WhatsAppTemplateController.PreviewResponse("rendered");
        assertThat(resp.renderedBody()).isEqualTo("rendered");
    }
}
