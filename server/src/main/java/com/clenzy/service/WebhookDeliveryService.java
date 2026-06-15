package com.clenzy.service;

import com.clenzy.model.NotificationKey;
import com.clenzy.model.WebhookConfig;
import com.clenzy.model.WebhookConfig.WebhookStatus;
import com.clenzy.model.WebhookDelivery;
import com.clenzy.model.WebhookDelivery.DeliveryStatus;
import com.clenzy.model.WebhookEventType;
import com.clenzy.dto.WebhookDeliveryDto;
import com.clenzy.repository.WebhookConfigRepository;
import com.clenzy.repository.WebhookDeliveryRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;

/**
 * Livraison des webhooks sortants (CLZ Domaine 10) : enfile une livraison persistee par abonne
 * dans la transaction metier, puis effectue l'appel HTTP <b>hors transaction</b> (#2) avec
 * signature HMAC-SHA256, retry a backoff exponentiel et desactivation + notification admin apres
 * epuisement des tentatives.
 */
@Service
public class WebhookDeliveryService {

    private static final Logger log = LoggerFactory.getLogger(WebhookDeliveryService.class);
    private static final int MAX_ATTEMPTS = 5;
    private static final Duration BACKOFF_CAP = Duration.ofMinutes(60);
    private static final Duration PAUSED_RECHECK = Duration.ofMinutes(30);
    private static final int HTTP_TIMEOUT_S = 15;

    private final WebhookConfigRepository webhookRepository;
    private final WebhookDeliveryRepository deliveryRepository;
    private final ObjectMapper objectMapper;
    private final NotificationService notificationService;
    private final HttpClient httpClient;
    private final Clock clock;

    public WebhookDeliveryService(WebhookConfigRepository webhookRepository,
                                  WebhookDeliveryRepository deliveryRepository,
                                  ObjectMapper objectMapper,
                                  NotificationService notificationService,
                                  @Qualifier("webhookHttpClient") HttpClient httpClient,
                                  Clock clock) {
        this.webhookRepository = webhookRepository;
        this.deliveryRepository = deliveryRepository;
        this.objectMapper = objectMapper;
        this.notificationService = notificationService;
        this.httpClient = httpClient;
        this.clock = clock;
    }

    /**
     * Enfile une livraison PENDING par abonne actif souscrit a l'evenement. Les saves rejoignent
     * la transaction metier ambiante (atomique avec la mutation). Retourne les ids a tenter apres commit.
     */
    public List<Long> enqueue(WebhookEventType eventType, Long orgId, Object payload) {
        List<WebhookConfig> active = webhookRepository.findActiveByOrgId(orgId);
        if (active.isEmpty()) {
            return List.of();
        }
        String body = serialize(eventType.wireName(), payload);
        Instant now = clock.instant();
        List<Long> ids = new ArrayList<>();
        for (WebhookConfig w : active) {
            if (!isSubscribed(w, eventType.wireName())) {
                continue;
            }
            WebhookDelivery d = new WebhookDelivery();
            d.setOrganizationId(orgId);
            d.setWebhookId(w.getId());
            d.setEventType(eventType.wireName());
            d.setPayload(body);
            d.setStatus(DeliveryStatus.PENDING);
            d.setAttempts(0);
            d.setNextAttemptAt(now);
            d.setCreatedAt(now);
            ids.add(deliveryRepository.save(d).getId());
        }
        return ids;
    }

    /**
     * Tente la livraison d'une entree de file. L'appel HTTP est realise <b>hors transaction</b> ;
     * la mise a jour du statut se fait via des saves de repository (chacun transactionnel).
     */
    public void attempt(Long deliveryId) {
        WebhookDelivery d = deliveryRepository.findById(deliveryId).orElse(null);
        if (d == null || d.getStatus() == DeliveryStatus.DELIVERED || d.getStatus() == DeliveryStatus.FAILED) {
            return;
        }
        WebhookConfig w = webhookRepository.findByIdAndOrgId(d.getWebhookId(), d.getOrganizationId()).orElse(null);
        if (w == null) {
            d.setStatus(DeliveryStatus.FAILED);
            d.setLastError("abonne supprime");
            deliveryRepository.save(d);
            return;
        }
        if (w.getStatus() != WebhookStatus.ACTIVE) {
            // Abonne en pause/desactive : on repousse sans consommer de tentative.
            d.setNextAttemptAt(clock.instant().plus(PAUSED_RECHECK));
            d.setStatus(DeliveryStatus.RETRYING);
            deliveryRepository.save(d);
            return;
        }

        int attemptNo = d.getAttempts() + 1;
        Integer responseStatus = null;
        String error = null;
        boolean ok = false;
        try {
            ICalUrlValidator.validateAndResolve(w.getUrl()); // garde SSRF (defense en profondeur)
            String signature = computeHmac(d.getPayload(), w.getSecretHash());
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(w.getUrl()))
                .header("Content-Type", "application/json")
                .header("X-Clenzy-Signature", signature)
                .header("X-Clenzy-Event", d.getEventType())
                .header("X-Clenzy-Delivery", String.valueOf(d.getId()))
                .timeout(Duration.ofSeconds(HTTP_TIMEOUT_S))
                .POST(HttpRequest.BodyPublishers.ofString(d.getPayload(), StandardCharsets.UTF_8))
                .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            responseStatus = response.statusCode();
            ok = responseStatus >= 200 && responseStatus < 300;
            if (!ok) {
                error = "HTTP " + responseStatus;
            }
        } catch (Exception e) {
            error = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
        }
        recordOutcome(d, w, attemptNo, ok, responseStatus, error);
    }

    private void recordOutcome(WebhookDelivery d, WebhookConfig w, int attemptNo,
                               boolean ok, Integer responseStatus, String error) {
        Instant now = clock.instant();
        d.setAttempts(attemptNo);
        d.setResponseStatus(responseStatus);
        if (ok) {
            d.setStatus(DeliveryStatus.DELIVERED);
            d.setDeliveredAt(now);
            d.setLastError(null);
            w.setLastTriggeredAt(now);
            w.setFailureCount(0);
        } else {
            d.setLastError(truncate(error));
            if (attemptNo >= MAX_ATTEMPTS) {
                d.setStatus(DeliveryStatus.FAILED);
                disableAndNotify(w, attemptNo);
            } else {
                d.setStatus(DeliveryStatus.RETRYING);
                d.setNextAttemptAt(now.plus(backoff(attemptNo)));
            }
            int failures = (w.getFailureCount() != null ? w.getFailureCount() : 0) + 1;
            w.setFailureCount(failures);
            w.setLastFailureAt(now);
            w.setLastFailureReason(truncate(error));
            log.warn("Webhook delivery {} (abonne {}) en echec [{}] tentative {}/{}",
                d.getId(), w.getId(), error, attemptNo, MAX_ATTEMPTS);
        }
        deliveryRepository.save(d);
        webhookRepository.save(w);
    }

    private void disableAndNotify(WebhookConfig w, int attempts) {
        if (w.getStatus() == WebhookStatus.FAILED) {
            return; // deja desactive : pas de double notification
        }
        w.setStatus(WebhookStatus.FAILED);
        notificationService.notifyAdminsAndManagersByOrgId(
            w.getOrganizationId(),
            NotificationKey.WEBHOOK_DELIVERY_FAILED,
            "Webhook desactive",
            "Le webhook #" + w.getId() + " a echoue " + attempts + " fois consecutives et a ete desactive. "
                + "Verifiez l'URL puis reactivez-le.",
            "/settings?tab=integrations");
    }

    /**
     * Livraison de test a la demande pour un abonne precis (CLZ Domaine 10) : cree une entree de
     * file, tente immediatement, renvoie le resultat. Utile pour valider une URL/config.
     */
    public WebhookDeliveryDto deliverTest(Long webhookId, Long orgId) {
        WebhookConfig w = webhookRepository.findByIdAndOrgId(webhookId, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Webhook not found: " + webhookId));
        Instant now = clock.instant();
        WebhookDelivery d = new WebhookDelivery();
        d.setOrganizationId(orgId);
        d.setWebhookId(w.getId());
        d.setEventType("webhook.test");
        d.setPayload(serialize("webhook.test", Map.of(
            "message", "Test de livraison Clenzy", "webhookId", w.getId())));
        d.setStatus(DeliveryStatus.PENDING);
        d.setAttempts(0);
        d.setNextAttemptAt(now);
        d.setCreatedAt(now);
        Long id = deliveryRepository.save(d).getId();
        attempt(id);
        return deliveryRepository.findById(id).map(WebhookDeliveryDto::from).orElse(WebhookDeliveryDto.from(d));
    }

    /** Journal recent d'un abonne (org-scope), pour l'UI. */
    public List<WebhookDeliveryDto> recentDeliveries(Long webhookId, Long orgId, int limit) {
        webhookRepository.findByIdAndOrgId(webhookId, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Webhook not found: " + webhookId));
        return deliveryRepository.findByWebhookId(webhookId, orgId, PageRequest.of(0, Math.min(Math.max(limit, 1), 100)))
            .stream().map(WebhookDeliveryDto::from).toList();
    }

    private String serialize(String eventName, Object payload) {
        Map<String, Object> envelope = new HashMap<>();
        envelope.put("event", eventName);
        envelope.put("timestamp", clock.instant().toString());
        envelope.put("data", payload != null ? payload : Map.of());
        try {
            return objectMapper.writeValueAsString(envelope);
        } catch (JsonProcessingException e) {
            // Audit #7 : pas d'avalage — un payload non serialisable est une erreur de programmation.
            throw new IllegalStateException("Serialisation du payload webhook impossible", e);
        }
    }

    private boolean isSubscribed(WebhookConfig webhook, String eventType) {
        String events = webhook.getEvents();
        if (events == null) {
            return false;
        }
        return events.contains("*") || events.contains(eventType);
    }

    private Duration backoff(int attemptNo) {
        long minutes = 1L << attemptNo; // 2, 4, 8, 16...
        Duration d = Duration.ofMinutes(minutes);
        return d.compareTo(BACKOFF_CAP) > 0 ? BACKOFF_CAP : d;
    }

    private String truncate(String s) {
        if (s == null) {
            return null;
        }
        return s.length() <= 500 ? s : s.substring(0, 500);
    }

    String computeHmac(String data, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] hash = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            throw new IllegalStateException("HMAC computation failed", e);
        }
    }
}
