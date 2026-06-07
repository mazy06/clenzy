package com.clenzy.controller;

import com.clenzy.model.WhatsAppConfig;
import com.clenzy.model.WhatsAppProviderType;
import com.clenzy.repository.WhatsAppConfigRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * Tests du controller OpenWA (compte global, contrat API réel).
 * La master key vient de la BDD (WhatsAppConfig.openwaApiKey), plus du .env.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class OpenWaSessionControllerTest {

    @Mock private WhatsAppConfigRepository configRepository;
    @Mock private RestTemplate restTemplate;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private OpenWaSessionController controller;

    @BeforeEach
    void setUp() {
        controller = new OpenWaSessionController(configRepository, objectMapper,
            "http://openwa:2785", "http://host.docker.internal:8084/api/webhooks/whatsapp/openwa");
        ReflectionTestUtils.setField(controller, "restTemplate", restTemplate);
    }

    private WhatsAppConfig globalConfig() {
        WhatsAppConfig c = new WhatsAppConfig();
        c.setOrganizationId(null);
        return c;
    }

    /** Mock REST qui répond selon l'URL/méthode (create / start / qr / status). */
    private void stubOpenWa() {
        when(restTemplate.exchange(anyString(), any(HttpMethod.class), any(HttpEntity.class), eq(String.class)))
            .thenAnswer(inv -> {
                String url = inv.getArgument(0);
                HttpMethod method = inv.getArgument(1);
                if (url.endsWith("/api/sessions") && method == HttpMethod.POST) {
                    return ResponseEntity.ok("{\"id\":\"sess-1\",\"status\":\"created\"}");
                }
                if (url.contains("/start")) return ResponseEntity.ok("{}");
                if (url.endsWith("/webhooks") && method == HttpMethod.GET) return ResponseEntity.ok("[]");
                if (url.endsWith("/webhooks") && method == HttpMethod.POST) return ResponseEntity.ok("{\"id\":\"wh-1\"}");
                if (url.endsWith("/qr")) return ResponseEntity.ok("{\"qrCode\":\"data:image/png;base64,XYZ\",\"status\":\"qr_ready\"}");
                if (url.endsWith("/sess-1")) return ResponseEntity.ok("{\"status\":\"ready\",\"phone\":\"33612345678\"}");
                return ResponseEntity.ok("{}");
            });
    }

    @Test
    void createSession_noMasterKey_returns400() {
        when(configRepository.findFirstByOrganizationIdIsNull()).thenReturn(Optional.of(globalConfig()));

        ResponseEntity<Map<String, Object>> result = controller.createSession();

        assertThat(result.getStatusCode().value()).isEqualTo(400);
        assertThat(result.getBody()).containsKey("error");
    }

    @Test
    void createSession_withMasterKey_createsStartsAndSaves() {
        WhatsAppConfig cfg = globalConfig();
        cfg.setOpenwaApiKey("dev-admin-key");
        when(configRepository.findFirstByOrganizationIdIsNull()).thenReturn(Optional.of(cfg));
        when(configRepository.save(any(WhatsAppConfig.class))).thenAnswer(inv -> inv.getArgument(0));
        stubOpenWa();

        ResponseEntity<Map<String, Object>> result = controller.createSession();

        assertThat(result.getStatusCode().value()).isEqualTo(200);
        assertThat(result.getBody()).containsEntry("sessionId", "sess-1");
        assertThat(result.getBody()).containsEntry("status", "qr_pending");
        assertThat(cfg.getOpenwaSessionId()).isEqualTo("sess-1");
        assertThat(cfg.getProvider()).isEqualTo(WhatsAppProviderType.OPENWA);
        assertThat(cfg.getOpenwaWebhookSecret()).isNotBlank(); // genere par ensureWebhook
    }

    @Test
    void getQr_returnsQrCode() {
        WhatsAppConfig cfg = globalConfig();
        cfg.setOpenwaApiKey("dev-admin-key");
        cfg.setOpenwaSessionId("sess-1");
        when(configRepository.findFirstByOrganizationIdIsNull()).thenReturn(Optional.of(cfg));
        stubOpenWa();

        ResponseEntity<Map<String, Object>> result = controller.getQr();

        assertThat(result.getStatusCode().value()).isEqualTo(200);
        assertThat(result.getBody()).containsEntry("qr", "data:image/png;base64,XYZ");
    }

    @Test
    void getStatus_ready_mapsToConnected() {
        WhatsAppConfig cfg = globalConfig();
        cfg.setOpenwaApiKey("dev-admin-key");
        cfg.setOpenwaSessionId("sess-1");
        when(configRepository.findFirstByOrganizationIdIsNull()).thenReturn(Optional.of(cfg));
        stubOpenWa();

        ResponseEntity<Map<String, Object>> result = controller.getStatus();

        assertThat(result.getBody()).containsEntry("status", "connected")
            .containsEntry("phoneNumber", "33612345678");
    }

    @Test
    void getStatus_noSession_notConfigured() {
        when(configRepository.findFirstByOrganizationIdIsNull()).thenReturn(Optional.of(globalConfig()));

        ResponseEntity<Map<String, Object>> result = controller.getStatus();

        assertThat(result.getBody()).containsEntry("status", "not_configured");
    }

    @Test
    void deleteSession_resetsSessionIdKeepsMasterKey() {
        WhatsAppConfig cfg = globalConfig();
        cfg.setOpenwaApiKey("dev-admin-key");
        cfg.setOpenwaSessionId("sess-1");
        when(configRepository.findFirstByOrganizationIdIsNull()).thenReturn(Optional.of(cfg));
        when(configRepository.save(any(WhatsAppConfig.class))).thenAnswer(inv -> inv.getArgument(0));
        stubOpenWa();

        ResponseEntity<Void> result = controller.deleteSession();

        assertThat(result.getStatusCode().value()).isEqualTo(204);
        assertThat(cfg.getOpenwaSessionId()).isNull();
        assertThat(cfg.getOpenwaApiKey()).isEqualTo("dev-admin-key"); // master key conservée
    }
}
