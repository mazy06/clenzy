package com.clenzy.service;

import com.clenzy.model.WebhookConfig;
import com.clenzy.model.WebhookConfig.WebhookStatus;
import com.clenzy.dto.CreateWebhookRequest;
import com.clenzy.dto.WebhookConfigDto;
import com.clenzy.repository.WebhookConfigRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;

/**
 * Gestion (CRUD) des abonnements webhook sortants d'une organisation (CLZ Domaine 10).
 * La livraison effective (HTTP signe, retry, backoff) est portee par
 * {@link WebhookDeliveryService} — hors transaction (#2).
 */
@Service
@Transactional(readOnly = true)
public class WebhookDispatchService {

    private static final Logger log = LoggerFactory.getLogger(WebhookDispatchService.class);
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final WebhookConfigRepository webhookRepository;

    public WebhookDispatchService(WebhookConfigRepository webhookRepository) {
        this.webhookRepository = webhookRepository;
    }

    public List<WebhookConfigDto> getAllWebhooks(Long orgId) {
        return webhookRepository.findAllByOrgId(orgId).stream()
            .map(WebhookConfigDto::from)
            .toList();
    }

    public WebhookConfigDto getById(Long id, Long orgId) {
        return webhookRepository.findByIdAndOrgId(id, orgId)
            .map(WebhookConfigDto::from)
            .orElseThrow(() -> new IllegalArgumentException("Webhook not found: " + id));
    }

    @Transactional
    public WebhookCreationResult createWebhook(CreateWebhookRequest request, Long orgId) {
        // Garde SSRF : refuser une URL interne / non-HTTPS avant de la stocker.
        ICalUrlValidator.validateAndResolve(request.url());

        String secret = generateSecret();

        WebhookConfig config = new WebhookConfig();
        config.setOrganizationId(orgId);
        config.setUrl(request.url());
        config.setSecretHash(secret);
        config.setEvents(String.join(",", request.events()));
        config.setStatus(WebhookStatus.ACTIVE);

        WebhookConfig saved = webhookRepository.save(config);
        log.info("Created webhook for org {} -> {} events: {}", orgId, request.url(), request.events());

        return new WebhookCreationResult(WebhookConfigDto.from(saved), secret);
    }

    @Transactional
    public void deleteWebhook(Long id, Long orgId) {
        WebhookConfig config = webhookRepository.findByIdAndOrgId(id, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Webhook not found: " + id));
        webhookRepository.delete(config);
        log.info("Deleted webhook {} for org {}", id, orgId);
    }

    @Transactional
    public void pauseWebhook(Long id, Long orgId) {
        WebhookConfig config = webhookRepository.findByIdAndOrgId(id, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Webhook not found: " + id));
        config.setStatus(WebhookStatus.PAUSED);
        webhookRepository.save(config);
    }

    @Transactional
    public void resumeWebhook(Long id, Long orgId) {
        WebhookConfig config = webhookRepository.findByIdAndOrgId(id, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Webhook not found: " + id));
        config.setStatus(WebhookStatus.ACTIVE);
        config.setFailureCount(0);
        webhookRepository.save(config);
    }

    private String generateSecret() {
        byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);
        return "whsec_" + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public record WebhookCreationResult(WebhookConfigDto webhook, String secret) {}
}
