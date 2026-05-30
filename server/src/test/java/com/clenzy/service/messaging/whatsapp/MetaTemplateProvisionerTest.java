package com.clenzy.service.messaging.whatsapp;

import com.clenzy.model.OrgWhatsAppTemplate;
import com.clenzy.model.WhatsAppConfig;
import com.clenzy.repository.OrgWhatsAppTemplateRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MetaTemplateProvisionerTest {

    @Mock private WhatsAppTemplateLoader templateLoader;
    @Mock private OrgWhatsAppTemplateRepository orgTemplateRepository;
    @Mock private RestTemplate restTemplate;

    private ObjectMapper objectMapper;
    private MetaTemplateProvisioner provisioner;

    private static final Long ORG_ID = 7L;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        provisioner = new MetaTemplateProvisioner(templateLoader, orgTemplateRepository, objectMapper,
                "https://graph.facebook.com/v18.0");
        // Inject our mocked RestTemplate (default constructor builds its own)
        ReflectionTestUtils.setField(provisioner, "restTemplate", restTemplate);
    }

    private WhatsAppConfig newConfig() {
        WhatsAppConfig cfg = new WhatsAppConfig();
        cfg.setOrganizationId(ORG_ID);
        cfg.setBusinessAccountId("waba-123");
        cfg.setApiToken("token-xyz");
        return cfg;
    }

    private WhatsAppTemplateDefinition def(String key, Map<String, String> langs) {
        Map<String, WhatsAppTemplateDefinition.LanguageBody> lb = new LinkedHashMap<>();
        langs.forEach((k, v) -> lb.put(k, new WhatsAppTemplateDefinition.LanguageBody(v)));
        return new WhatsAppTemplateDefinition(key, "UTILITY", lb);
    }

    // ===================================================================
    // provisionAll — guard clauses
    // ===================================================================

    @Nested
    @DisplayName("provisionAll — guard clauses")
    class Guards {

        @Test
        @DisplayName("returns empty result when no WABA id")
        void noWaba_returnsEmpty() {
            WhatsAppConfig cfg = newConfig();
            cfg.setBusinessAccountId(null);

            MetaTemplateProvisioner.ProvisionResult result = provisioner.provisionAll(cfg);

            assertThat(result.submitted()).isZero();
            assertThat(result.failed()).isZero();
            assertThat(result.details()).isEmpty();
            verifyNoInteractions(restTemplate);
        }

        @Test
        @DisplayName("returns empty when WABA id is blank")
        void blankWaba_returnsEmpty() {
            WhatsAppConfig cfg = newConfig();
            cfg.setBusinessAccountId("   ");

            assertThat(provisioner.provisionAll(cfg).submitted()).isZero();
            verifyNoInteractions(restTemplate);
        }

        @Test
        @DisplayName("returns empty when no apiToken")
        void noApiToken_returnsEmpty() {
            WhatsAppConfig cfg = newConfig();
            cfg.setApiToken(null);

            assertThat(provisioner.provisionAll(cfg).submitted()).isZero();
            verifyNoInteractions(restTemplate);
        }

        @Test
        @DisplayName("returns empty when apiToken is blank")
        void blankApiToken_returnsEmpty() {
            WhatsAppConfig cfg = newConfig();
            cfg.setApiToken("");

            assertThat(provisioner.provisionAll(cfg).submitted()).isZero();
        }

        @Test
        @DisplayName("returns empty when loader returns no templates")
        void noTemplates_returnsEmpty() {
            when(templateLoader.getAllTemplates()).thenReturn(List.of());

            MetaTemplateProvisioner.ProvisionResult result = provisioner.provisionAll(newConfig());

            assertThat(result.submitted()).isZero();
            assertThat(result.details()).isEmpty();
        }
    }

    // ===================================================================
    // provisionAll — happy path
    // ===================================================================

    @Nested
    @DisplayName("provisionAll — happy path")
    class HappyPath {

        @Test
        @DisplayName("submits template for each language and persists mapping")
        void submitsAndPersists() {
            WhatsAppTemplateDefinition def = def("booking_confirmation",
                Map.of("fr_FR", "Bonjour {{1}}", "en_US", "Hi {{1}}"));
            when(templateLoader.getAllTemplates()).thenReturn(List.of(def));
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                .thenReturn(new ResponseEntity<>("{\"id\":\"meta-1\"}", HttpStatus.OK));
            when(orgTemplateRepository.findByOrganizationIdAndTemplateKey(any(), any()))
                .thenReturn(Optional.empty());
            when(orgTemplateRepository.save(any(OrgWhatsAppTemplate.class)))
                .thenAnswer(inv -> inv.getArgument(0));

            MetaTemplateProvisioner.ProvisionResult result = provisioner.provisionAll(newConfig());

            assertThat(result.submitted()).isEqualTo(2);
            assertThat(result.failed()).isZero();
            assertThat(result.details()).hasSize(2)
                .allMatch(r -> "SUBMITTED".equals(r.status()));
            verify(orgTemplateRepository, times(2)).save(any(OrgWhatsAppTemplate.class));
        }

        @Test
        @DisplayName("updates existing mapping when present")
        void updatesExistingMapping() {
            WhatsAppTemplateDefinition def = def("briefing", Map.of("fr_FR", "Bonjour"));
            when(templateLoader.getAllTemplates()).thenReturn(List.of(def));
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                .thenReturn(new ResponseEntity<>("{}", HttpStatus.OK));
            OrgWhatsAppTemplate existing = new OrgWhatsAppTemplate(ORG_ID, "briefing", "old-name", "en");
            when(orgTemplateRepository.findByOrganizationIdAndTemplateKey(ORG_ID, "briefing"))
                .thenReturn(Optional.of(existing));
            when(orgTemplateRepository.save(any(OrgWhatsAppTemplate.class)))
                .thenAnswer(inv -> inv.getArgument(0));

            MetaTemplateProvisioner.ProvisionResult result = provisioner.provisionAll(newConfig());

            assertThat(result.submitted()).isEqualTo(1);
            assertThat(existing.getTemplateName()).isEqualTo("clenzy_briefing_v1");
            assertThat(existing.getTemplateLanguage()).isEqualTo("fr_FR");
        }
    }

    // ===================================================================
    // provisionAll — error handling
    // ===================================================================

    @Nested
    @DisplayName("provisionAll — error handling")
    class ErrorHandling {

        @Test
        @DisplayName("counts failed templates when Meta returns non-2xx")
        void non2xx_marksFailed() {
            WhatsAppTemplateDefinition def = def("checkin", Map.of("fr_FR", "Bonjour"));
            when(templateLoader.getAllTemplates()).thenReturn(List.of(def));
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                .thenReturn(new ResponseEntity<>("", HttpStatus.BAD_REQUEST));

            MetaTemplateProvisioner.ProvisionResult result = provisioner.provisionAll(newConfig());

            assertThat(result.submitted()).isZero();
            assertThat(result.failed()).isEqualTo(1);
            assertThat(result.details()).hasSize(1);
            assertThat(result.details().get(0).status()).isEqualTo("FAILED");
        }

        @Test
        @DisplayName("does not stop batch when one template throws")
        void exceptionOnOneTemplate_othersContinue() {
            WhatsAppTemplateDefinition def1 = def("a", Map.of("fr_FR", "Bonjour"));
            WhatsAppTemplateDefinition def2 = def("b", Map.of("fr_FR", "Hello"));
            when(templateLoader.getAllTemplates()).thenReturn(List.of(def1, def2));
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                .thenThrow(new RestClientException("Meta down"))
                .thenReturn(new ResponseEntity<>("{}", HttpStatus.OK));
            when(orgTemplateRepository.findByOrganizationIdAndTemplateKey(any(), any()))
                .thenReturn(Optional.empty());
            when(orgTemplateRepository.save(any(OrgWhatsAppTemplate.class)))
                .thenAnswer(inv -> inv.getArgument(0));

            MetaTemplateProvisioner.ProvisionResult result = provisioner.provisionAll(newConfig());

            assertThat(result.submitted()).isEqualTo(1);
            assertThat(result.failed()).isEqualTo(1);
        }

        @Test
        @DisplayName("extracts Meta error message from response body")
        void extractsMetaErrorMessage() {
            WhatsAppTemplateDefinition def = def("k", Map.of("fr_FR", "Bonjour"));
            when(templateLoader.getAllTemplates()).thenReturn(List.of(def));
            String metaError = "Meta error response: {\"error\":{\"message\":\"Template name already exists\",\"code\":123}}";
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                .thenThrow(new RestClientException(metaError));

            MetaTemplateProvisioner.ProvisionResult result = provisioner.provisionAll(newConfig());

            assertThat(result.failed()).isEqualTo(1);
            assertThat(result.details().get(0).errorMessage()).contains("Template name already exists");
        }

        @Test
        @DisplayName("falls back to truncated raw error when JSON parse fails")
        void rawErrorTruncated() {
            WhatsAppTemplateDefinition def = def("k", Map.of("fr_FR", "Bonjour"));
            when(templateLoader.getAllTemplates()).thenReturn(List.of(def));
            String longMsg = "X".repeat(250);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                .thenThrow(new RestClientException(longMsg));

            MetaTemplateProvisioner.ProvisionResult result = provisioner.provisionAll(newConfig());

            assertThat(result.details().get(0).errorMessage()).endsWith("...");
        }

        @Test
        @DisplayName("returns 'Erreur inconnue' when exception has no message")
        void nullMessage_unknownError() {
            WhatsAppTemplateDefinition def = def("k", Map.of("fr_FR", "Bonjour"));
            when(templateLoader.getAllTemplates()).thenReturn(List.of(def));
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                .thenThrow(new RestClientException(null));

            MetaTemplateProvisioner.ProvisionResult result = provisioner.provisionAll(newConfig());

            // null message → "Erreur inconnue"
            assertThat(result.details().get(0).errorMessage()).contains("Erreur");
        }
    }

    // ===================================================================
    // ProvisionResult / TemplateResult records
    // ===================================================================

    @Nested
    @DisplayName("records")
    class Records {

        @Test
        @DisplayName("ProvisionResult exposes its fields")
        void provisionResult_fields() {
            MetaTemplateProvisioner.TemplateResult tr =
                new MetaTemplateProvisioner.TemplateResult("k", "fr_FR", "name", "SUBMITTED", null);
            MetaTemplateProvisioner.ProvisionResult pr =
                new MetaTemplateProvisioner.ProvisionResult(3, 2, List.of(tr));

            assertThat(pr.submitted()).isEqualTo(3);
            assertThat(pr.failed()).isEqualTo(2);
            assertThat(pr.details()).containsExactly(tr);
            assertThat(tr.key()).isEqualTo("k");
            assertThat(tr.language()).isEqualTo("fr_FR");
            assertThat(tr.templateName()).isEqualTo("name");
            assertThat(tr.status()).isEqualTo("SUBMITTED");
            assertThat(tr.errorMessage()).isNull();
        }
    }
}
