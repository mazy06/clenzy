package com.clenzy.service.messaging.whatsapp;

import com.clenzy.model.WhatsAppConfig;
import com.clenzy.model.WhatsAppProviderType;
import com.clenzy.repository.WhatsAppConfigRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MetaSignupServiceTest {

    @Mock private WhatsAppConfigRepository configRepository;
    @Mock private MetaTemplateProvisioner templateProvisioner;
    @Mock private RestTemplate restTemplate;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private MetaSignupService service;

    @BeforeEach
    void setUp() {
        service = new MetaSignupService(
                objectMapper, configRepository, templateProvisioner,
                "app-id-123", "app-secret-xyz", "config-id-abc",
                "https://graph.facebook.com/v18.0",
                "https://graph.facebook.com/v18.0/oauth/access_token",
                "");
        ReflectionTestUtils.setField(service, "restTemplate", restTemplate);
    }

    @Nested
    @DisplayName("getPublicAppConfig")
    class GetPublicConfig {

        @Test
        void whenConfigured_thenReturnsAppIdAndConfigId() {
            Map<String, Object> result = service.getPublicAppConfig();
            assertThat(result).containsEntry("appId", "app-id-123")
                    .containsEntry("configId", "config-id-abc");
            assertThat(result.get("graphApiVersion").toString()).startsWith("v");
        }

        @Test
        void whenNotConfigured_thenThrows() {
            MetaSignupService unconfigured = new MetaSignupService(
                    objectMapper, configRepository, templateProvisioner,
                    "", "", "", "https://graph.facebook.com/v18.0",
                    "https://graph.facebook.com/v18.0/oauth/access_token", "");

            assertThatThrownBy(unconfigured::getPublicAppConfig)
                    .isInstanceOf(MetaSignupService.MetaSignupException.class);
        }
    }

    @Nested
    @DisplayName("completeSignup")
    class CompleteSignup {

        @Test
        void whenCodeBlank_thenThrows() {
            assertThatThrownBy(() -> service.completeSignup("", 100L))
                    .isInstanceOf(MetaSignupService.MetaSignupException.class)
                    .hasMessageContaining("Code OAuth manquant");
        }

        @Test
        void whenCodeNull_thenThrows() {
            assertThatThrownBy(() -> service.completeSignup(null, 100L))
                    .isInstanceOf(MetaSignupService.MetaSignupException.class);
        }

        @Test
        void whenExchangeFails_thenThrows() {
            // First call (token exchange) returns non-2xx
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                    .thenReturn(new ResponseEntity<>("{\"error\":\"invalid_code\"}", HttpStatus.BAD_REQUEST));

            assertThatThrownBy(() -> service.completeSignup("bad-code", 100L))
                    .isInstanceOf(MetaSignupService.MetaSignupException.class)
                    .hasMessageContaining("Echec exchange code Meta");
        }

        @Test
        void whenExchangeReturnsEmptyToken_thenThrows() {
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                    .thenReturn(ResponseEntity.ok("{}"));

            assertThatThrownBy(() -> service.completeSignup("bad-code", 100L))
                    .isInstanceOf(MetaSignupService.MetaSignupException.class)
                    .hasMessageContaining("Reponse Meta sans access_token");
        }

        @Test
        void whenFullFlowSucceeds_thenProvisionsConfig() {
            // Mock token exchange (first GET)
            String tokenJson = "{\"access_token\":\"long-lived-token\"}";
            // Mock /me/businesses
            String businessesJson = "{\"data\":[{\"id\":\"biz-1\"}]}";
            // Mock /{bizId}/owned_whatsapp_business_accounts
            String wabasJson = "{\"data\":[{\"id\":\"waba-1\"}]}";
            // Mock /{wabaId}/phone_numbers
            String phonesJson = "{\"data\":[{\"id\":\"phone-1\",\"display_phone_number\":\"+33612345678\"}]}";

            // Sequence of REST calls: token exchange (1) → businesses (2) → wabas (3) → phones (4)
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                    .thenReturn(ResponseEntity.ok(tokenJson))
                    .thenReturn(ResponseEntity.ok(businessesJson))
                    .thenReturn(ResponseEntity.ok(wabasJson))
                    .thenReturn(ResponseEntity.ok(phonesJson));

            when(configRepository.findByOrganizationId(100L)).thenReturn(Optional.empty());
            when(configRepository.save(any(WhatsAppConfig.class))).thenAnswer(inv -> {
                WhatsAppConfig c = inv.getArgument(0);
                c.setId(1L);
                return c;
            });

            when(templateProvisioner.provisionAll(any(WhatsAppConfig.class)))
                    .thenReturn(new MetaTemplateProvisioner.ProvisionResult(5, 0, List.of()));

            MetaSignupService.SignupResult result = service.completeSignup("code-123", 100L);

            assertThat(result.success()).isTrue();
            assertThat(result.phoneNumber()).isEqualTo("+33612345678");
            assertThat(result.wabaId()).isEqualTo("waba-1");
            assertThat(result.phoneNumberId()).isEqualTo("phone-1");
            assertThat(result.templatesSubmitted()).isEqualTo(5);
        }

        @Test
        void whenNoBusiness_thenThrows() {
            String tokenJson = "{\"access_token\":\"long-lived\"}";
            String emptyBusinesses = "{\"data\":[]}";

            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                    .thenReturn(ResponseEntity.ok(tokenJson))
                    .thenReturn(ResponseEntity.ok(emptyBusinesses));

            assertThatThrownBy(() -> service.completeSignup("code", 100L))
                    .isInstanceOf(MetaSignupService.MetaSignupException.class);
        }

        @Test
        void whenTemplateProvisioningFails_thenSignupStillSucceeds() {
            String tokenJson = "{\"access_token\":\"long-lived\"}";
            String businessesJson = "{\"data\":[{\"id\":\"biz-1\"}]}";
            String wabasJson = "{\"data\":[{\"id\":\"waba-1\"}]}";
            String phonesJson = "{\"data\":[{\"id\":\"phone-1\",\"display_phone_number\":\"+1234\"}]}";

            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                    .thenReturn(ResponseEntity.ok(tokenJson))
                    .thenReturn(ResponseEntity.ok(businessesJson))
                    .thenReturn(ResponseEntity.ok(wabasJson))
                    .thenReturn(ResponseEntity.ok(phonesJson));

            when(configRepository.findByOrganizationId(100L)).thenReturn(Optional.empty());
            when(configRepository.save(any())).thenAnswer(inv -> {
                WhatsAppConfig c = inv.getArgument(0);
                c.setId(2L);
                return c;
            });

            when(templateProvisioner.provisionAll(any())).thenThrow(new RuntimeException("Templates down"));

            MetaSignupService.SignupResult result = service.completeSignup("code", 100L);

            assertThat(result.success()).isTrue();
            assertThat(result.templatesSubmitted()).isEqualTo(0);
        }

        @Test
        void whenExistingConfig_thenReuses() {
            WhatsAppConfig existing = new WhatsAppConfig();
            existing.setOrganizationId(100L);
            existing.setId(99L);
            existing.setProvider(WhatsAppProviderType.OPENWA); // Will be updated to META

            String tokenJson = "{\"access_token\":\"long-lived\"}";
            String businessesJson = "{\"data\":[{\"id\":\"biz-1\"}]}";
            String wabasJson = "{\"data\":[{\"id\":\"waba-1\"}]}";
            String phonesJson = "{\"data\":[{\"id\":\"phone-1\",\"display_phone_number\":\"+1\"}]}";

            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                    .thenReturn(ResponseEntity.ok(tokenJson))
                    .thenReturn(ResponseEntity.ok(businessesJson))
                    .thenReturn(ResponseEntity.ok(wabasJson))
                    .thenReturn(ResponseEntity.ok(phonesJson));

            when(configRepository.findByOrganizationId(100L)).thenReturn(Optional.of(existing));
            when(configRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(templateProvisioner.provisionAll(any()))
                    .thenReturn(new MetaTemplateProvisioner.ProvisionResult(0, 0, List.of()));

            MetaSignupService.SignupResult result = service.completeSignup("code", 100L);

            assertThat(result.success()).isTrue();
            assertThat(existing.getProvider()).isEqualTo(WhatsAppProviderType.META);
            assertThat(existing.getPhoneNumberId()).isEqualTo("phone-1");
            assertThat(existing.isEnabled()).isTrue();
        }
    }
}
