package com.clenzy.service;

import com.clenzy.dto.WebhookDeliveryDto;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.WebhookConfig;
import com.clenzy.model.WebhookConfig.WebhookStatus;
import com.clenzy.model.WebhookDelivery;
import com.clenzy.model.WebhookDelivery.DeliveryStatus;
import com.clenzy.model.WebhookEventType;
import com.clenzy.repository.WebhookConfigRepository;
import com.clenzy.repository.WebhookDeliveryRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.net.http.HttpClient;
import java.net.http.HttpResponse;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Livraison des webhooks sortants (CLZ Domaine 10) : enfilage, succes, retry/backoff,
 * desactivation + notification apres epuisement, signature HMAC.
 */
@ExtendWith(MockitoExtension.class)
class WebhookDeliveryServiceTest {

    @Mock private WebhookConfigRepository webhookRepository;
    @Mock private WebhookDeliveryRepository deliveryRepository;
    @Mock private NotificationService notificationService;
    @Mock private HttpClient httpClient;

    private WebhookDeliveryService service;

    private static final Long ORG_ID = 1L;
    private static final Instant NOW = Instant.parse("2026-06-14T12:00:00Z");

    @BeforeEach
    void setUp() {
        service = new WebhookDeliveryService(
            webhookRepository, deliveryRepository, new ObjectMapper(),
            notificationService, httpClient, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private WebhookConfig webhook(String events) {
        WebhookConfig w = new WebhookConfig();
        w.setId(1L);
        w.setOrganizationId(ORG_ID);
        w.setUrl("https://example.com/hook");
        w.setSecretHash("whsec_test");
        w.setEvents(events);
        w.setStatus(WebhookStatus.ACTIVE);
        w.setFailureCount(0);
        return w;
    }

    private WebhookDelivery pendingDelivery() {
        WebhookDelivery d = new WebhookDelivery();
        d.setId(10L);
        d.setOrganizationId(ORG_ID);
        d.setWebhookId(1L);
        d.setEventType("reservation.created");
        d.setPayload("{\"event\":\"reservation.created\"}");
        d.setStatus(DeliveryStatus.PENDING);
        d.setAttempts(0);
        return d;
    }

    @SuppressWarnings("unchecked")
    private void stubHttpStatus(int status) throws Exception {
        HttpResponse<String> response = org.mockito.Mockito.mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(status);
        when(httpClient.send(any(), any())).thenAnswer(inv -> response);
    }

    // ── enqueue ──────────────────────────────────────────────────────────────

    @Test
    void enqueue_createsDeliveryOnlyForSubscribedActiveWebhooks() {
        WebhookConfig subscribed = webhook("reservation.created,reservation.cancelled");
        subscribed.setId(1L);
        WebhookConfig other = webhook("payment.confirmed");
        other.setId(2L);
        when(webhookRepository.findActiveByOrgId(ORG_ID)).thenReturn(List.of(subscribed, other));
        when(deliveryRepository.save(any())).thenAnswer(inv -> {
            WebhookDelivery d = inv.getArgument(0);
            d.setId(99L);
            return d;
        });

        List<Long> ids = service.enqueue(WebhookEventType.RESERVATION_CREATED, ORG_ID, java.util.Map.of("id", 5));

        assertThat(ids).hasSize(1);
        verify(deliveryRepository, org.mockito.Mockito.times(1)).save(any());
    }

    @Test
    void enqueue_noActiveWebhooks_returnsEmpty() {
        when(webhookRepository.findActiveByOrgId(ORG_ID)).thenReturn(List.of());

        assertThat(service.enqueue(WebhookEventType.RESERVATION_CREATED, ORG_ID, null)).isEmpty();
    }

    @Test
    void enqueue_wildcardSubscriptionMatches() {
        WebhookConfig wild = webhook("*");
        when(webhookRepository.findActiveByOrgId(ORG_ID)).thenReturn(List.of(wild));
        when(deliveryRepository.save(any())).thenAnswer(inv -> { ((WebhookDelivery) inv.getArgument(0)).setId(1L); return inv.getArgument(0); });

        assertThat(service.enqueue(WebhookEventType.PAYMENT_CONFIRMED, ORG_ID, null)).hasSize(1);
    }

    // ── attempt ──────────────────────────────────────────────────────────────

    @Test
    void attempt_success_marksDelivered() throws Exception {
        WebhookDelivery d = pendingDelivery();
        when(deliveryRepository.findById(10L)).thenReturn(Optional.of(d));
        WebhookConfig w = webhook("reservation.created");
        w.setFailureCount(3);
        when(webhookRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(w));
        when(deliveryRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(webhookRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        stubHttpStatus(200);

        service.attempt(10L);

        assertThat(d.getStatus()).isEqualTo(DeliveryStatus.DELIVERED);
        assertThat(d.getDeliveredAt()).isEqualTo(NOW);
        assertThat(d.getAttempts()).isEqualTo(1);
        assertThat(w.getFailureCount()).isZero();
        assertThat(w.getLastTriggeredAt()).isEqualTo(NOW);
    }

    @Test
    void attempt_failure_marksRetryingWithBackoff() throws Exception {
        WebhookDelivery d = pendingDelivery();
        when(deliveryRepository.findById(10L)).thenReturn(Optional.of(d));
        WebhookConfig w = webhook("reservation.created");
        when(webhookRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(w));
        when(deliveryRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(webhookRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        stubHttpStatus(500);

        service.attempt(10L);

        assertThat(d.getStatus()).isEqualTo(DeliveryStatus.RETRYING);
        assertThat(d.getAttempts()).isEqualTo(1);
        assertThat(d.getNextAttemptAt()).isAfter(NOW); // backoff applique
        assertThat(d.getResponseStatus()).isEqualTo(500);
        assertThat(w.getFailureCount()).isEqualTo(1);
        verify(notificationService, never()).notifyAdminsAndManagersByOrgId(any(), any(), any(), any(), any());
    }

    @Test
    void attempt_failureReachesMax_marksFailed_disablesWebhook_andNotifies() throws Exception {
        WebhookDelivery d = pendingDelivery();
        d.setAttempts(4); // la 5e tentative est terminale (MAX_ATTEMPTS = 5)
        when(deliveryRepository.findById(10L)).thenReturn(Optional.of(d));
        WebhookConfig w = webhook("reservation.created");
        when(webhookRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(w));
        when(deliveryRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(webhookRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        stubHttpStatus(503);

        service.attempt(10L);

        assertThat(d.getStatus()).isEqualTo(DeliveryStatus.FAILED);
        assertThat(d.getAttempts()).isEqualTo(5);
        assertThat(w.getStatus()).isEqualTo(WebhookStatus.FAILED);
        verify(notificationService).notifyAdminsAndManagersByOrgId(
            eq(ORG_ID), eq(NotificationKey.WEBHOOK_DELIVERY_FAILED), any(), any(), any());
    }

    @Test
    void attempt_webhookDeleted_marksFailed() {
        WebhookDelivery d = pendingDelivery();
        when(deliveryRepository.findById(10L)).thenReturn(Optional.of(d));
        when(webhookRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.empty());
        when(deliveryRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.attempt(10L);

        assertThat(d.getStatus()).isEqualTo(DeliveryStatus.FAILED);
    }

    @Test
    void attempt_alreadyDelivered_isNoop() {
        WebhookDelivery d = pendingDelivery();
        d.setStatus(DeliveryStatus.DELIVERED);
        when(deliveryRepository.findById(10L)).thenReturn(Optional.of(d));

        service.attempt(10L);

        verify(webhookRepository, never()).findByIdAndOrgId(any(), any());
    }

    @Test
    void deliverTest_createsDeliveryAndAttempts() throws Exception {
        WebhookConfig w = webhook("*");
        when(webhookRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(w));
        WebhookDelivery[] holder = new WebhookDelivery[1];
        when(deliveryRepository.save(any())).thenAnswer(inv -> {
            WebhookDelivery d = inv.getArgument(0);
            if (d.getId() == null) d.setId(77L);
            holder[0] = d;
            return d;
        });
        when(deliveryRepository.findById(77L)).thenAnswer(inv -> Optional.ofNullable(holder[0]));
        when(webhookRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        stubHttpStatus(200);

        WebhookDeliveryDto dto = service.deliverTest(1L, ORG_ID);

        assertThat(dto).isNotNull();
        assertThat(dto.status()).isEqualTo(DeliveryStatus.DELIVERED);
        verify(httpClient).send(any(), any());
    }

    @Test
    void computeHmac_isDeterministicHexDigest() {
        String h1 = service.computeHmac("payload", "secret");
        String h2 = service.computeHmac("payload", "secret");
        assertThat(h1).isEqualTo(h2).hasSize(64).matches("[a-f0-9]+");
        assertThat(service.computeHmac("payload", "other")).isNotEqualTo(h1);
    }
}
