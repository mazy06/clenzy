package com.clenzy.controller;

import com.clenzy.dto.ApiKeyDto;
import com.clenzy.dto.CreateApiKeyRequest;
import com.clenzy.dto.CreateWebhookRequest;
import com.clenzy.dto.WebhookConfigDto;
import com.clenzy.model.ApiKey.ApiKeyStatus;
import com.clenzy.model.WebhookConfig.WebhookStatus;
import com.clenzy.service.ApiKeyService;
import com.clenzy.service.ApiKeyService.ApiKeyCreationResult;
import com.clenzy.service.WebhookDispatchService;
import com.clenzy.service.WebhookDispatchService.WebhookCreationResult;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PublicApiControllerTest {

    @Mock private ApiKeyService apiKeyService;
    @Mock private WebhookDispatchService webhookService;
    @Mock private TenantContext tenantContext;

    private PublicApiController controller;

    @BeforeEach
    void setUp() {
        controller = new PublicApiController(apiKeyService, webhookService, tenantContext);
    }

    private ApiKeyDto apiKeyDto(Long id) {
        return new ApiKeyDto(id, "name", "key_", ApiKeyStatus.ACTIVE, "scopes", 100, null, null, Instant.now());
    }

    private WebhookConfigDto webhookDto(Long id) {
        return new WebhookConfigDto(id, "https://hook.test", List.of("reservation.created"),
                WebhookStatus.ACTIVE, 0, null, Instant.now());
    }

    @Test
    void listApiKeys_returnsList() {
        when(tenantContext.getOrganizationId()).thenReturn(1L);
        when(apiKeyService.getAllKeys(1L)).thenReturn(List.of(apiKeyDto(1L), apiKeyDto(2L)));

        List<ApiKeyDto> result = controller.listApiKeys();
        assertThat(result).hasSize(2);
    }

    @Test
    void getApiKey_byId() {
        when(tenantContext.getOrganizationId()).thenReturn(1L);
        when(apiKeyService.getById(5L, 1L)).thenReturn(apiKeyDto(5L));

        ApiKeyDto result = controller.getApiKey(5L);
        assertThat(result.id()).isEqualTo(5L);
    }

    @Test
    void createApiKey_returnsKeyAndRaw() {
        when(tenantContext.getOrganizationId()).thenReturn(1L);
        CreateApiKeyRequest req = new CreateApiKeyRequest("test", "read", 100, null);
        ApiKeyDto dto = apiKeyDto(10L);
        when(apiKeyService.createKey(eq(req), eq(1L), eq(null)))
                .thenReturn(new ApiKeyCreationResult(dto, "raw-secret"));

        Map<String, Object> result = controller.createApiKey(req);
        assertThat(result).containsKey("apiKey");
        assertThat(result).containsEntry("rawKey", "raw-secret");
        assertThat(result).containsKey("message");
    }

    @Test
    void revokeApiKey_returnsStatus() {
        when(tenantContext.getOrganizationId()).thenReturn(1L);

        Map<String, String> result = controller.revokeApiKey(5L);
        assertThat(result).containsEntry("status", "revoked");
        verify(apiKeyService).revokeKey(5L, 1L);
    }

    @Test
    void listWebhooks_returnsList() {
        when(tenantContext.getOrganizationId()).thenReturn(1L);
        when(webhookService.getAllWebhooks(1L)).thenReturn(List.of(webhookDto(1L), webhookDto(2L), webhookDto(3L)));

        List<WebhookConfigDto> result = controller.listWebhooks();
        assertThat(result).hasSize(3);
    }

    @Test
    void getWebhook_byId() {
        when(tenantContext.getOrganizationId()).thenReturn(1L);
        when(webhookService.getById(5L, 1L)).thenReturn(webhookDto(5L));

        WebhookConfigDto result = controller.getWebhook(5L);
        assertThat(result.id()).isEqualTo(5L);
    }

    @Test
    void createWebhook_returnsSecret() {
        when(tenantContext.getOrganizationId()).thenReturn(1L);
        CreateWebhookRequest req = new CreateWebhookRequest("https://hook.test", List.of("reservation.created"));
        WebhookConfigDto dto = webhookDto(10L);
        when(webhookService.createWebhook(eq(req), eq(1L)))
                .thenReturn(new WebhookCreationResult(dto, "whsec-xyz"));

        Map<String, Object> result = controller.createWebhook(req);
        assertThat(result).containsKey("webhook");
        assertThat(result).containsEntry("secret", "whsec-xyz");
        assertThat(result).containsKey("message");
    }

    @Test
    void deleteWebhook_returnsStatus() {
        when(tenantContext.getOrganizationId()).thenReturn(1L);

        Map<String, String> result = controller.deleteWebhook(5L);
        assertThat(result).containsEntry("status", "deleted");
        verify(webhookService).deleteWebhook(5L, 1L);
    }

    @Test
    void pauseWebhook_returnsStatus() {
        when(tenantContext.getOrganizationId()).thenReturn(1L);

        Map<String, String> result = controller.pauseWebhook(5L);
        assertThat(result).containsEntry("status", "paused");
        verify(webhookService).pauseWebhook(5L, 1L);
    }

    @Test
    void resumeWebhook_returnsStatus() {
        when(tenantContext.getOrganizationId()).thenReturn(1L);

        Map<String, String> result = controller.resumeWebhook(5L);
        assertThat(result).containsEntry("status", "active");
        verify(webhookService).resumeWebhook(5L, 1L);
    }

    @Test
    void listAvailableEvents_returnsAllEvents() {
        List<String> events = controller.listAvailableEvents();
        assertThat(events).contains("reservation.created", "property.deleted", "guest.checked_in",
                "payout.generated", "message.received", "rate.updated", "availability.updated");
    }
}
