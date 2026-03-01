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
}
