package com.clenzy.controller;

import com.clenzy.model.WhatsAppConfig;
import com.clenzy.repository.WhatsAppConfigRepository;
import com.clenzy.tenant.TenantContext;
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
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

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
class OpenWaSessionControllerTest {

    @Mock private WhatsAppConfigRepository configRepository;
    @Mock private TenantContext tenantContext;
    @Mock private RestTemplate restTemplate;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private OpenWaSessionController controller;

    @BeforeEach
    void setUp() {
        controller = new OpenWaSessionController(
                configRepository, tenantContext, objectMapper,
                "http://openwa:2785", "master-key-123");
        ReflectionTestUtils.setField(controller, "restTemplate", restTemplate);
        lenient().when(tenantContext.getRequiredOrganizationId()).thenReturn(100L);
    }

    @Nested
    @DisplayName("createSession")
    class CreateSession {

        @Test
        void whenSucceeds_thenReturnsSessionAndPersists() {
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                    .thenReturn(ResponseEntity.ok("{}"));
            when(configRepository.findByOrganizationId(100L)).thenReturn(Optional.empty());
            when(configRepository.save(any(WhatsAppConfig.class))).thenAnswer(inv -> inv.getArgument(0));

            ResponseEntity<Map<String, Object>> result = controller.createSession();

            assertThat(result.getStatusCode().value()).isEqualTo(200);
            assertThat(result.getBody()).containsKey("sessionId");
            assertThat(result.getBody().get("sessionId").toString()).startsWith("owa-org-100-");
            assertThat(result.getBody()).containsEntry("status", "qr_pending");
        }

        @Test
        void whenOpenWaUnreachable_thenReturns503() {
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                    .thenThrow(new RuntimeException("Connection refused"));

            ResponseEntity<Map<String, Object>> result = controller.createSession();

            assertThat(result.getStatusCode().value()).isEqualTo(503);
            assertThat(result.getBody()).containsKey("error");
        }

        @Test
        void whenMasterKeyMissing_thenThrows() {
            ReflectionTestUtils.setField(controller, "openwaMasterKey", "");

            assertThatThrownBy(() -> controller.createSession())
                    .isInstanceOf(IllegalStateException.class);
        }
    }

    @Nested
    @DisplayName("getQr")
    class GetQr {

        @Test
        void whenSessionExistsAndQrAvailable_thenReturnsQr() {
            WhatsAppConfig config = new WhatsAppConfig();
            config.setOpenwaSessionId("owa-1");
            when(configRepository.findByOrganizationId(100L)).thenReturn(Optional.of(config));

            String body = "{\"qr\":\"data:image/png;base64,XYZ\"}";
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                    .thenReturn(ResponseEntity.ok(body));

            ResponseEntity<Map<String, Object>> result = controller.getQr();

            assertThat(result.getStatusCode().value()).isEqualTo(200);
            assertThat(result.getBody()).containsEntry("qr", "data:image/png;base64,XYZ");
        }

        @Test
        void whenNoConfig_thenAccessDenied() {
            when(configRepository.findByOrganizationId(100L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> controller.getQr())
                    .isInstanceOf(AccessDeniedException.class);
        }

        @Test
        void whenNoSession_thenReturns404() {
            WhatsAppConfig config = new WhatsAppConfig();
            // openwaSessionId is null
            when(configRepository.findByOrganizationId(100L)).thenReturn(Optional.of(config));

            ResponseEntity<Map<String, Object>> result = controller.getQr();
            assertThat(result.getStatusCode().value()).isEqualTo(404);
        }

        @Test
        void whenQrBlank_thenReturns404() {
            WhatsAppConfig config = new WhatsAppConfig();
            config.setOpenwaSessionId("owa-1");
            when(configRepository.findByOrganizationId(100L)).thenReturn(Optional.of(config));

            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                    .thenReturn(ResponseEntity.ok("{}"));

            ResponseEntity<Map<String, Object>> result = controller.getQr();
            assertThat(result.getStatusCode().value()).isEqualTo(404);
        }

        @Test
        void whenOpenWaUnreachable_thenReturns503() {
            WhatsAppConfig config = new WhatsAppConfig();
            config.setOpenwaSessionId("owa-1");
            when(configRepository.findByOrganizationId(100L)).thenReturn(Optional.of(config));
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                    .thenThrow(new RuntimeException("Down"));

            ResponseEntity<Map<String, Object>> result = controller.getQr();
            assertThat(result.getStatusCode().value()).isEqualTo(503);
        }
    }

    @Nested
    @DisplayName("getStatus")
    class GetStatus {

        @Test
        void whenNoConfig_thenNotConfigured() {
            when(configRepository.findByOrganizationId(100L)).thenReturn(Optional.empty());

            ResponseEntity<Map<String, Object>> result = controller.getStatus();
            assertThat(result.getBody()).containsEntry("status", "not_configured");
        }

        @Test
        void whenConnected_thenReturnsConnected() {
            WhatsAppConfig config = new WhatsAppConfig();
            config.setOpenwaSessionId("owa-1");
            when(configRepository.findByOrganizationId(100L)).thenReturn(Optional.of(config));

            String body = "{\"status\":\"CONNECTED\",\"phoneNumber\":\"+33612345678\"}";
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                    .thenReturn(ResponseEntity.ok(body));

            ResponseEntity<Map<String, Object>> result = controller.getStatus();
            assertThat(result.getBody()).containsEntry("status", "connected")
                    .containsEntry("phoneNumber", "+33612345678");
        }

        @Test
        void whenQrStatus_thenReturnsQrPending() {
            WhatsAppConfig config = new WhatsAppConfig();
            config.setOpenwaSessionId("owa-1");
            when(configRepository.findByOrganizationId(100L)).thenReturn(Optional.of(config));
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                    .thenReturn(ResponseEntity.ok("{\"status\":\"QR\"}"));

            ResponseEntity<Map<String, Object>> result = controller.getStatus();
            assertThat(result.getBody()).containsEntry("status", "qr_pending");
        }

        @Test
        void whenFailedStatus_thenReturnsFailed() {
            WhatsAppConfig config = new WhatsAppConfig();
            config.setOpenwaSessionId("owa-1");
            when(configRepository.findByOrganizationId(100L)).thenReturn(Optional.of(config));
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                    .thenReturn(ResponseEntity.ok("{\"status\":\"FAILED\"}"));

            ResponseEntity<Map<String, Object>> result = controller.getStatus();
            assertThat(result.getBody()).containsEntry("status", "failed");
        }

        @Test
        void whenOpenWaUnreachable_thenReturnsDisconnected() {
            WhatsAppConfig config = new WhatsAppConfig();
            config.setOpenwaSessionId("owa-1");
            when(configRepository.findByOrganizationId(100L)).thenReturn(Optional.of(config));
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                    .thenThrow(new RuntimeException("Down"));

            ResponseEntity<Map<String, Object>> result = controller.getStatus();
            assertThat(result.getBody()).containsEntry("status", "disconnected");
        }
    }

    @Nested
    @DisplayName("deleteSession")
    class DeleteSession {

        @Test
        void whenNoConfig_thenNoContent() {
            when(configRepository.findByOrganizationId(100L)).thenReturn(Optional.empty());

            ResponseEntity<Void> result = controller.deleteSession();
            assertThat(result.getStatusCode().value()).isEqualTo(204);
        }

        @Test
        void whenConfigHasSession_thenDeletesAndResets() {
            WhatsAppConfig config = new WhatsAppConfig();
            config.setOpenwaSessionId("owa-1");
            config.setOpenwaApiKey("key-1");
            when(configRepository.findByOrganizationId(100L)).thenReturn(Optional.of(config));
            when(restTemplate.exchange(anyString(), eq(HttpMethod.DELETE), any(HttpEntity.class), eq(String.class)))
                    .thenReturn(ResponseEntity.noContent().build());

            ResponseEntity<Void> result = controller.deleteSession();

            assertThat(result.getStatusCode().value()).isEqualTo(204);
            assertThat(config.getOpenwaSessionId()).isNull();
            assertThat(config.getOpenwaApiKey()).isNull();
            verify(configRepository).save(config);
        }

        @Test
        void whenOpenWaUnreachable_thenStillResets() {
            WhatsAppConfig config = new WhatsAppConfig();
            config.setOpenwaSessionId("owa-1");
            when(configRepository.findByOrganizationId(100L)).thenReturn(Optional.of(config));
            when(restTemplate.exchange(anyString(), eq(HttpMethod.DELETE), any(HttpEntity.class), eq(String.class)))
                    .thenThrow(new RuntimeException("Down"));

            ResponseEntity<Void> result = controller.deleteSession();
            assertThat(result.getStatusCode().value()).isEqualTo(204);
            assertThat(config.getOpenwaSessionId()).isNull();
        }
    }
}
