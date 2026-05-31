package com.clenzy.service;

import com.clenzy.dto.CreateWebhookRequest;
import com.clenzy.dto.WebhookConfigDto;
import com.clenzy.model.WebhookConfig;
import com.clenzy.model.WebhookConfig.WebhookStatus;
import com.clenzy.repository.WebhookConfigRepository;
import com.clenzy.service.WebhookDispatchService.WebhookCreationResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WebhookDispatchServiceTest {

    @Mock private WebhookConfigRepository webhookRepository;
    @Spy private ObjectMapper objectMapper = new ObjectMapper();
    @InjectMocks private WebhookDispatchService service;

    private static final Long ORG_ID = 1L;

    private WebhookConfig createWebhook(String events) {
        WebhookConfig w = new WebhookConfig();
        w.setId(1L);
        w.setOrganizationId(ORG_ID);
        w.setUrl("https://example.com/webhook");
        w.setSecretHash("whsec_testsecret123");
        w.setEvents(events);
        w.setStatus(WebhookStatus.ACTIVE);
        w.setFailureCount(0);
        return w;
    }

    @Test
    void createWebhook_success() {
        CreateWebhookRequest request = new CreateWebhookRequest(
            "https://example.com/hook", List.of("reservation.created", "reservation.updated"));
        when(webhookRepository.save(any())).thenAnswer(inv -> {
            WebhookConfig saved = inv.getArgument(0);
            saved.setId(1L);
            return saved;
        });

        WebhookCreationResult result = service.createWebhook(request, ORG_ID);

        assertNotNull(result);
        assertNotNull(result.secret());
        assertTrue(result.secret().startsWith("whsec_"));
        assertEquals("https://example.com/hook", result.webhook().url());
        assertEquals(2, result.webhook().events().size());
    }

    @Test
    void deleteWebhook_success() {
        WebhookConfig webhook = createWebhook("reservation.created");
        when(webhookRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(webhook));

        service.deleteWebhook(1L, ORG_ID);

        verify(webhookRepository).delete(webhook);
    }

    @Test
    void deleteWebhook_notFound_throws() {
        when(webhookRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> service.deleteWebhook(1L, ORG_ID));
    }

    @Test
    void pauseWebhook_success() {
        WebhookConfig webhook = createWebhook("*");
        when(webhookRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(webhook));
        when(webhookRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.pauseWebhook(1L, ORG_ID);

        assertEquals(WebhookStatus.PAUSED, webhook.getStatus());
    }

    @Test
    void resumeWebhook_resetsFailures() {
        WebhookConfig webhook = createWebhook("*");
        webhook.setStatus(WebhookStatus.PAUSED);
        webhook.setFailureCount(5);
        when(webhookRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(webhook));
        when(webhookRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.resumeWebhook(1L, ORG_ID);

        assertEquals(WebhookStatus.ACTIVE, webhook.getStatus());
        assertEquals(0, webhook.getFailureCount());
    }

    @Test
    void computeHmac_consistent() {
        String hmac1 = service.computeHmac("data", "secret");
        String hmac2 = service.computeHmac("data", "secret");
        assertEquals(hmac1, hmac2);
    }

    @Test
    void computeHmac_differentData() {
        String hmac1 = service.computeHmac("data1", "secret");
        String hmac2 = service.computeHmac("data2", "secret");
        assertNotEquals(hmac1, hmac2);
    }

    @Test
    void dispatchEvent_noActiveWebhooks() {
        when(webhookRepository.findActiveByOrgId(ORG_ID)).thenReturn(List.of());

        int count = service.dispatchEvent("reservation.created", Map.of("id", 1), ORG_ID);

        assertEquals(0, count);
    }

    @Test
    void dispatchEvent_webhookNotSubscribed() {
        WebhookConfig webhook = createWebhook("property.created,property.updated");
        when(webhookRepository.findActiveByOrgId(ORG_ID)).thenReturn(List.of(webhook));

        int count = service.dispatchEvent("reservation.created", Map.of("id", 1), ORG_ID);

        assertEquals(0, count);
    }

    @Test
    void getAllWebhooks_mapsToDtos() {
        WebhookConfig w1 = createWebhook("a,b");
        w1.setId(1L);
        WebhookConfig w2 = createWebhook("*");
        w2.setId(2L);
        when(webhookRepository.findAllByOrgId(ORG_ID)).thenReturn(List.of(w1, w2));

        List<WebhookConfigDto> all = service.getAllWebhooks(ORG_ID);

        assertEquals(2, all.size());
    }

    @Test
    void getAllWebhooks_emptyList() {
        when(webhookRepository.findAllByOrgId(ORG_ID)).thenReturn(List.of());

        assertTrue(service.getAllWebhooks(ORG_ID).isEmpty());
    }

    @Test
    void getById_success() {
        WebhookConfig webhook = createWebhook("a,b");
        when(webhookRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(webhook));

        WebhookConfigDto dto = service.getById(1L, ORG_ID);

        assertNotNull(dto);
        assertEquals("https://example.com/webhook", dto.url());
    }

    @Test
    void getById_notFound_throws() {
        when(webhookRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> service.getById(1L, ORG_ID));
    }

    @Test
    void pauseWebhook_notFound_throws() {
        when(webhookRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> service.pauseWebhook(1L, ORG_ID));
    }

    @Test
    void resumeWebhook_notFound_throws() {
        when(webhookRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> service.resumeWebhook(1L, ORG_ID));
    }

    @Test
    void dispatchEvent_subscribedButHttpFails_handlesFailure_andSaves() {
        // URL pointing to unreachable host triggers IOException -> handleFailure
        WebhookConfig webhook = createWebhook("reservation.created");
        webhook.setUrl("http://127.0.0.1:1/will-not-connect");
        when(webhookRepository.findActiveByOrgId(ORG_ID)).thenReturn(List.of(webhook));
        when(webhookRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        int count = service.dispatchEvent("reservation.created", Map.of("id", 1), ORG_ID);

        // 0 dispatched, but failure tracked
        assertEquals(0, count);
        assertNotNull(webhook.getFailureCount());
        assertTrue(webhook.getFailureCount() >= 1);
        assertNotNull(webhook.getLastFailureAt());
        verify(webhookRepository, atLeastOnce()).save(webhook);
    }

    @Test
    void dispatchEvent_wildcardSubscription_passesIsSubscribedCheck() {
        // wildcard "*" matches any event. Sending to unreachable URL still tries to dispatch.
        WebhookConfig webhook = createWebhook("*");
        webhook.setUrl("http://127.0.0.1:1/wild");
        when(webhookRepository.findActiveByOrgId(ORG_ID)).thenReturn(List.of(webhook));
        when(webhookRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.dispatchEvent("anything.happens", Map.of("x", 1), ORG_ID);

        // Failure path should still call save
        verify(webhookRepository, atLeastOnce()).save(any());
    }

    @Test
    void dispatchEvent_nullEventsField_notSubscribed() {
        WebhookConfig webhook = createWebhook(null);
        when(webhookRepository.findActiveByOrgId(ORG_ID)).thenReturn(List.of(webhook));

        int count = service.dispatchEvent("reservation.created", Map.of(), ORG_ID);

        assertEquals(0, count);
    }

    @Test
    void dispatchEvent_failureCountIncrementsFromNull() {
        WebhookConfig webhook = createWebhook("reservation.created");
        webhook.setUrl("http://127.0.0.1:1/unreachable");
        webhook.setFailureCount(null);
        when(webhookRepository.findActiveByOrgId(ORG_ID)).thenReturn(List.of(webhook));
        when(webhookRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.dispatchEvent("reservation.created", Map.of(), ORG_ID);

        // Null failure count starts at 1
        assertEquals(1, webhook.getFailureCount());
    }

    @Test
    void dispatchEvent_failureCountReachesMax_disablesWebhook() {
        WebhookConfig webhook = createWebhook("reservation.created");
        webhook.setUrl("http://127.0.0.1:1/will-fail");
        // 9 prior failures, this one will be the 10th -> status becomes FAILED
        webhook.setFailureCount(9);
        when(webhookRepository.findActiveByOrgId(ORG_ID)).thenReturn(List.of(webhook));
        when(webhookRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.dispatchEvent("reservation.created", Map.of(), ORG_ID);

        assertEquals(WebhookStatus.FAILED, webhook.getStatus());
        assertEquals(10, webhook.getFailureCount());
    }

    @Test
    void createWebhook_generatesUniqueSecretsAcrossCalls() {
        CreateWebhookRequest request = new CreateWebhookRequest(
            "https://example.com/hook", List.of("event"));
        when(webhookRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        WebhookCreationResult r1 = service.createWebhook(request, ORG_ID);
        WebhookCreationResult r2 = service.createWebhook(request, ORG_ID);

        assertNotEquals(r1.secret(), r2.secret());
        assertTrue(r1.secret().startsWith("whsec_"));
        assertTrue(r2.secret().startsWith("whsec_"));
    }

    @Test
    void computeHmac_differentSecretsProduceDifferentOutput() {
        String hmac1 = service.computeHmac("payload", "secret-A");
        String hmac2 = service.computeHmac("payload", "secret-B");
        assertNotEquals(hmac1, hmac2);
    }

    @Test
    void computeHmac_returnsHexEncodedDigest() {
        String hmac = service.computeHmac("abc", "key");
        // HmacSHA256 hex digest is 64 chars
        assertEquals(64, hmac.length());
        assertTrue(hmac.matches("[a-f0-9]+"));
    }
}
