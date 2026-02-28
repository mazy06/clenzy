package com.clenzy.service;

import com.clenzy.model.WebhookConfig;
import com.clenzy.model.WebhookConfig.WebhookStatus;
import com.clenzy.dto.CreateWebhookRequest;
import com.clenzy.dto.WebhookConfigDto;
import com.clenzy.repository.WebhookConfigRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

@Service
@Transactional(readOnly = true)
public class WebhookDispatchService {

    private static final Logger log = LoggerFactory.getLogger(WebhookDispatchService.class);
    private static final int MAX_FAILURES = 10;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final WebhookConfigRepository webhookRepository;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public WebhookDispatchService(WebhookConfigRepository webhookRepository,
                                   ObjectMapper objectMapper) {
        this.webhookRepository = webhookRepository;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();
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

    /**
     * Dispatch un evenement webhook a tous les abonnes actifs pour l'org.
     */
    @Transactional
    public int dispatchEvent(String eventType, Object payload, Long orgId) {
        List<WebhookConfig> activeWebhooks = webhookRepository.findActiveByOrgId(orgId);
        int dispatched = 0;

        for (WebhookConfig webhook : activeWebhooks) {
            if (!isSubscribedToEvent(webhook, eventType)) {
                continue;
            }

            try {
                String body = objectMapper.writeValueAsString(Map.of(
                    "event", eventType,
                    "timestamp", Instant.now().toString(),
                    "data", payload
                ));

                String signature = computeHmac(body, webhook.getSecretHash());

                HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(webhook.getUrl()))
                    .header("Content-Type", "application/json")
                    .header("X-Clenzy-Signature", signature)
                    .header("X-Clenzy-Event", eventType)
                    .timeout(Duration.ofSeconds(15))
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();

                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

                if (response.statusCode() >= 200 && response.statusCode() < 300) {
                    webhook.setLastTriggeredAt(Instant.now());
                    webhook.setFailureCount(0);
                    dispatched++;
                } else {
                    handleFailure(webhook, "HTTP " + response.statusCode());
                }

                webhookRepository.save(webhook);

            } catch (Exception e) {
                handleFailure(webhook, e.getMessage());
                webhookRepository.save(webhook);
                log.warn("Failed to dispatch webhook {} to {}: {}", webhook.getId(), webhook.getUrl(), e.getMessage());
            }
        }

        return dispatched;
    }

    private boolean isSubscribedToEvent(WebhookConfig webhook, String eventType) {
        if (webhook.getEvents() == null) return false;
        String events = webhook.getEvents();
        return events.contains("*") || events.contains(eventType);
    }

    private void handleFailure(WebhookConfig webhook, String reason) {
        int failures = webhook.getFailureCount() != null ? webhook.getFailureCount() + 1 : 1;
        webhook.setFailureCount(failures);
        webhook.setLastFailureAt(Instant.now());
        webhook.setLastFailureReason(reason);
        if (failures >= MAX_FAILURES) {
            webhook.setStatus(WebhookStatus.FAILED);
            log.warn("Webhook {} disabled after {} failures", webhook.getId(), failures);
        }
    }

    String computeHmac(String data, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] hash = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            throw new RuntimeException("HMAC computation failed", e);
        }
    }

    private String generateSecret() {
        byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);
        return "whsec_" + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public record WebhookCreationResult(WebhookConfigDto webhook, String secret) {}
}
