package com.clenzy.integration.zapier.controller;

import com.clenzy.integration.zapier.config.ZapierConfig;
import com.clenzy.integration.zapier.model.WebhookSubscription;
import com.clenzy.integration.zapier.repository.WebhookSubscriptionRepository;
import com.clenzy.service.TokenEncryptionService;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;
import java.util.Map;

/**
 * Controller pour la gestion des abonnements webhook (Zapier, n8n, etc.).
 * Tous les endpoints sont securises et scopes a l'organisation courante.
 */
@RestController
@RequestMapping("/api/webhooks")
@PreAuthorize("isAuthenticated()")
public class ZapierController {

    private static final Logger log = LoggerFactory.getLogger(ZapierController.class);
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final WebhookSubscriptionRepository subscriptionRepository;
    private final TokenEncryptionService tokenEncryptionService;
    private final ZapierConfig config;
    private final TenantContext tenantContext;

    public ZapierController(WebhookSubscriptionRepository subscriptionRepository,
                             TokenEncryptionService tokenEncryptionService,
                             ZapierConfig config,
                             TenantContext tenantContext) {
        this.subscriptionRepository = subscriptionRepository;
        this.tokenEncryptionService = tokenEncryptionService;
        this.config = config;
        this.tenantContext = tenantContext;
    }

    /**
     * Liste les abonnements webhook de l'organisation courante.
     *
     * @return liste des abonnements actifs
     */
    @GetMapping
    public ResponseEntity<List<WebhookSubscriptionResponse>> listSubscriptions() {
        Long orgId = tenantContext.getRequiredOrganizationId();

        List<WebhookSubscriptionResponse> subscriptions =
            subscriptionRepository.findByOrganizationIdAndActive(orgId, true).stream()
                .map(WebhookSubscriptionResponse::from)
                .toList();

        return ResponseEntity.ok(subscriptions);
    }

    /**
     * Cree un nouvel abonnement webhook.
     * Le secret est genere automatiquement et retourne une seule fois dans la reponse.
     *
     * @param request details de l'abonnement
     * @return abonnement cree avec le secret en clair
     */
    @PostMapping("/subscribe")
    public ResponseEntity<?> createSubscription(@RequestBody CreateSubscriptionRequest request) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        long currentCount = subscriptionRepository.countByOrganizationId(orgId);
        if (currentCount >= config.getMaxSubscriptionsPerOrg()) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .body(Map.of("error", "Nombre maximum d'abonnements atteint: " + config.getMaxSubscriptionsPerOrg()));
        }

        String secret = generateSecret();

        WebhookSubscription subscription = new WebhookSubscription();
        subscription.setOrganizationId(orgId);
        subscription.setEventType(request.eventType());
        subscription.setTargetUrl(request.targetUrl());
        subscription.setSecretEncrypted(tokenEncryptionService.encrypt(secret));
        subscription.setActive(true);

        WebhookSubscription saved = subscriptionRepository.save(subscription);

        log.info("Abonnement webhook cree — id: {}, org: {}, event: {}, url: {}",
            saved.getId(), orgId, request.eventType(), request.targetUrl());

        return ResponseEntity.status(HttpStatus.CREATED)
            .body(new CreateSubscriptionResponse(
                saved.getId(),
                saved.getEventType(),
                saved.getTargetUrl(),
                secret
            ));
    }

    /**
     * Desactive un abonnement webhook.
     *
     * @param id identifiant de l'abonnement
     * @return 204 No Content
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deactivateSubscription(@PathVariable Long id) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        WebhookSubscription subscription = subscriptionRepository.findById(id)
            .orElse(null);

        if (subscription == null || !subscription.getOrganizationId().equals(orgId)) {
            return ResponseEntity.notFound().build();
        }

        subscription.setActive(false);
        subscriptionRepository.save(subscription);

        log.info("Abonnement webhook desactive — id: {}, org: {}", id, orgId);
        return ResponseEntity.noContent().build();
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private String generateSecret() {
        byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);
        return "whsec_" + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    // ─── DTOs internes ────────────────────────────────────────────────────────

    public record CreateSubscriptionRequest(
        String eventType,
        String targetUrl
    ) {}

    public record CreateSubscriptionResponse(
        Long id,
        String eventType,
        String targetUrl,
        String secret
    ) {}

    public record WebhookSubscriptionResponse(
        Long id,
        String eventType,
        String targetUrl,
        boolean active
    ) {
        static WebhookSubscriptionResponse from(WebhookSubscription subscription) {
            return new WebhookSubscriptionResponse(
                subscription.getId(),
                subscription.getEventType(),
                subscription.getTargetUrl(),
                subscription.isActive()
            );
        }
    }
}
