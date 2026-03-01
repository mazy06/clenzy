package com.clenzy.controller;

import com.clenzy.dto.*;
import com.clenzy.service.ApiKeyService;
import com.clenzy.service.ApiKeyService.ApiKeyCreationResult;
import com.clenzy.service.WebhookDispatchService;
import com.clenzy.service.WebhookDispatchService.WebhookCreationResult;
import com.clenzy.tenant.TenantContext;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/developer")
public class PublicApiController {

    private final ApiKeyService apiKeyService;
    private final WebhookDispatchService webhookService;
    private final TenantContext tenantContext;

    public PublicApiController(ApiKeyService apiKeyService,
                                WebhookDispatchService webhookService,
                                TenantContext tenantContext) {
        this.apiKeyService = apiKeyService;
        this.webhookService = webhookService;
        this.tenantContext = tenantContext;
    }

    // ── API Keys ────────────────────────────────────────────────────────────

    @GetMapping("/api-keys")
    public List<ApiKeyDto> listApiKeys() {
        return apiKeyService.getAllKeys(tenantContext.getOrganizationId());
    }

    @GetMapping("/api-keys/{id}")
    public ApiKeyDto getApiKey(@PathVariable Long id) {
        return apiKeyService.getById(id, tenantContext.getOrganizationId());
    }

    @PostMapping("/api-keys")
    public Map<String, Object> createApiKey(@Valid @RequestBody CreateApiKeyRequest request) {
        ApiKeyCreationResult result = apiKeyService.createKey(
            request, tenantContext.getOrganizationId(), null);
        return Map.of(
            "apiKey", result.apiKey(),
            "rawKey", result.rawKey(),
            "message", "Store this key securely. It will not be shown again."
        );
    }

    @DeleteMapping("/api-keys/{id}")
    public Map<String, String> revokeApiKey(@PathVariable Long id) {
        apiKeyService.revokeKey(id, tenantContext.getOrganizationId());
        return Map.of("status", "revoked");
    }

    // ── Webhooks ────────────────────────────────────────────────────────────

    @GetMapping("/webhooks")
    public List<WebhookConfigDto> listWebhooks() {
        return webhookService.getAllWebhooks(tenantContext.getOrganizationId());
    }

    @GetMapping("/webhooks/{id}")
    public WebhookConfigDto getWebhook(@PathVariable Long id) {
        return webhookService.getById(id, tenantContext.getOrganizationId());
    }

    @PostMapping("/webhooks")
    public Map<String, Object> createWebhook(@Valid @RequestBody CreateWebhookRequest request) {
        WebhookCreationResult result = webhookService.createWebhook(
            request, tenantContext.getOrganizationId());
        return Map.of(
            "webhook", result.webhook(),
            "secret", result.secret(),
            "message", "Store this secret securely. It will not be shown again."
        );
    }

    @DeleteMapping("/webhooks/{id}")
    public Map<String, String> deleteWebhook(@PathVariable Long id) {
        webhookService.deleteWebhook(id, tenantContext.getOrganizationId());
        return Map.of("status", "deleted");
    }

    @PutMapping("/webhooks/{id}/pause")
    public Map<String, String> pauseWebhook(@PathVariable Long id) {
        webhookService.pauseWebhook(id, tenantContext.getOrganizationId());
        return Map.of("status", "paused");
    }

    @PutMapping("/webhooks/{id}/resume")
    public Map<String, String> resumeWebhook(@PathVariable Long id) {
        webhookService.resumeWebhook(id, tenantContext.getOrganizationId());
        return Map.of("status", "active");
    }

    // ── Available Events ────────────────────────────────────────────────────

    @GetMapping("/webhook-events")
    public List<String> listAvailableEvents() {
        return List.of(
            "reservation.created", "reservation.updated", "reservation.cancelled",
            "property.created", "property.updated", "property.deleted",
            "guest.checked_in", "guest.checked_out",
            "review.received", "review.responded",
            "payout.generated", "payout.paid",
            "message.received", "message.sent",
            "rate.updated", "availability.updated"
        );
    }
}
