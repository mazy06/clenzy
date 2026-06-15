package com.clenzy.controller;

import com.clenzy.dto.CreateWebhookRequest;
import com.clenzy.dto.WebhookConfigDto;
import com.clenzy.dto.WebhookDeliveryDto;
import com.clenzy.service.WebhookDeliveryService;
import com.clenzy.service.WebhookDispatchService;
import com.clenzy.service.WebhookDispatchService.WebhookCreationResult;
import com.clenzy.tenant.TenantContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Gestion des webhooks sortants d'une organisation (CLZ Domaine 10) : abonnements (CRUD),
 * livraison de test et journal d'observabilite. Controller mince : delegation aux services,
 * aucun acces repository (regle ArchUnit #4).
 */
@RestController
@RequestMapping("/api/integrations/webhooks")
@Tag(name = "Webhooks", description = "Webhooks sortants (integrations)")
@PreAuthorize("hasAnyRole('HOST','SUPER_ADMIN','SUPER_MANAGER')")
public class WebhookController {

    private final WebhookDispatchService webhookService;
    private final WebhookDeliveryService deliveryService;
    private final TenantContext tenantContext;

    public WebhookController(WebhookDispatchService webhookService,
                            WebhookDeliveryService deliveryService,
                            TenantContext tenantContext) {
        this.webhookService = webhookService;
        this.deliveryService = deliveryService;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    @Operation(summary = "Lister les webhooks sortants de l'organisation")
    public ResponseEntity<List<WebhookConfigDto>> list() {
        return ResponseEntity.ok(webhookService.getAllWebhooks(tenantContext.getRequiredOrganizationId()));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Detail d'un webhook")
    public ResponseEntity<WebhookConfigDto> get(@PathVariable Long id) {
        return ResponseEntity.ok(webhookService.getById(id, tenantContext.getRequiredOrganizationId()));
    }

    @PostMapping
    @Operation(summary = "Creer un webhook (le secret de signature n'est renvoye qu'a la creation)")
    public ResponseEntity<Map<String, Object>> create(@Valid @RequestBody CreateWebhookRequest request) {
        WebhookCreationResult result = webhookService.createWebhook(request, tenantContext.getRequiredOrganizationId());
        return ResponseEntity.ok(Map.of("webhook", result.webhook(), "secret", result.secret()));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Supprimer un webhook")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        webhookService.deleteWebhook(id, tenantContext.getRequiredOrganizationId());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/pause")
    @Operation(summary = "Suspendre un webhook")
    public ResponseEntity<Void> pause(@PathVariable Long id) {
        webhookService.pauseWebhook(id, tenantContext.getRequiredOrganizationId());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/resume")
    @Operation(summary = "Reactiver un webhook (remet le compteur d'echecs a zero)")
    public ResponseEntity<Void> resume(@PathVariable Long id) {
        webhookService.resumeWebhook(id, tenantContext.getRequiredOrganizationId());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/test")
    @Operation(summary = "Envoyer une livraison de test signee a ce webhook")
    public ResponseEntity<WebhookDeliveryDto> test(@PathVariable Long id) {
        return ResponseEntity.ok(deliveryService.deliverTest(id, tenantContext.getRequiredOrganizationId()));
    }

    @GetMapping("/{id}/deliveries")
    @Operation(summary = "Journal recent des livraisons d'un webhook")
    public ResponseEntity<List<WebhookDeliveryDto>> deliveries(@PathVariable Long id,
                                                              @RequestParam(defaultValue = "50") int limit) {
        return ResponseEntity.ok(deliveryService.recentDeliveries(id, tenantContext.getRequiredOrganizationId(), limit));
    }
}
