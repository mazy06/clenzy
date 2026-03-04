package com.clenzy.integration.zapier.service;

import com.clenzy.integration.zapier.config.ZapierConfig;
import com.clenzy.integration.zapier.dto.WebhookEventPayload;
import com.clenzy.integration.zapier.model.WebhookSubscription;
import com.clenzy.integration.zapier.repository.WebhookSubscriptionRepository;
import com.clenzy.service.TokenEncryptionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;

/**
 * Service de diffusion des evenements webhook.
 * Envoie les evenements a tous les abonnes actifs avec signature HMAC.
 */
@Service
public class WebhookBroadcasterService {

    private static final Logger log = LoggerFactory.getLogger(WebhookBroadcasterService.class);

    private final WebhookSubscriptionRepository subscriptionRepository;
    private final TokenEncryptionService tokenEncryptionService;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;
    private final ZapierConfig config;

    public WebhookBroadcasterService(WebhookSubscriptionRepository subscriptionRepository,
                                      TokenEncryptionService tokenEncryptionService,
                                      ObjectMapper objectMapper,
                                      ZapierConfig config) {
        this.subscriptionRepository = subscriptionRepository;
        this.tokenEncryptionService = tokenEncryptionService;
        this.objectMapper = objectMapper;
        this.config = config;
        this.restTemplate = new RestTemplate();
    }

    /**
     * Diffuse un evenement a tous les abonnes actifs pour le type d'evenement et l'organisation.
     *
     * @param eventType type d'evenement
     * @param data      donnees de l'evenement
     * @param orgId     identifiant de l'organisation
     * @return nombre d'abonnes notifies avec succes
     */
    public int broadcastEvent(String eventType, Map<String, Object> data, Long orgId) {
        if (!config.isEnabled()) {
            log.debug("Webhooks desactives — evenement {} ignore", eventType);
            return 0;
        }

        List<WebhookSubscription> subscriptions =
            subscriptionRepository.findByOrganizationIdAndActive(orgId, true);

        if (subscriptions.isEmpty()) {
            log.debug("Aucun abonne webhook actif pour org {} et evenement {}", orgId, eventType);
            return 0;
        }

        WebhookEventPayload payload = new WebhookEventPayload(
            eventType, Instant.now(), orgId, data
        );

        int successCount = 0;

        for (WebhookSubscription subscription : subscriptions) {
            if (!subscription.getEventType().equals(eventType)) {
                continue;
            }

            if (sendWebhook(subscription, payload)) {
                successCount++;
            }
        }

        log.info("Webhook broadcast — evenement: {}, org: {}, envoyes: {}/{}",
            eventType, orgId, successCount, subscriptions.size());

        return successCount;
    }

    private boolean sendWebhook(WebhookSubscription subscription, WebhookEventPayload payload) {
        try {
            String jsonPayload = objectMapper.writeValueAsString(payload);
            String secret = tokenEncryptionService.decrypt(subscription.getSecretEncrypted());
            String signature = generateHmacSignature(jsonPayload, secret);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("X-Clenzy-Signature", signature);
            headers.set("X-Clenzy-Event", payload.eventType());

            restTemplate.postForEntity(
                subscription.getTargetUrl(),
                new HttpEntity<>(jsonPayload, headers),
                Void.class
            );

            log.debug("Webhook envoye — subscription: {}, url: {}",
                subscription.getId(), subscription.getTargetUrl());
            return true;

        } catch (Exception e) {
            log.warn("Echec envoi webhook — subscription: {}, url: {}, erreur: {}",
                subscription.getId(), subscription.getTargetUrl(), e.getMessage());
            return false;
        }
    }

    /**
     * Genere une signature HMAC-SHA256 pour le payload.
     *
     * @param payload le contenu JSON a signer
     * @param secret  le secret partage avec l'abonne
     * @return signature hexadecimale
     */
    String generateHmacSignature(String payload, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] hash = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            throw new RuntimeException("Erreur generation HMAC", e);
        }
    }
}
