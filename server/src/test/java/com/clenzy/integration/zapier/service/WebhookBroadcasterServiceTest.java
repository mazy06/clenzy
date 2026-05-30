package com.clenzy.integration.zapier.service;

import com.clenzy.integration.zapier.config.ZapierConfig;
import com.clenzy.integration.zapier.model.WebhookSubscription;
import com.clenzy.integration.zapier.repository.WebhookSubscriptionRepository;
import com.clenzy.service.TokenEncryptionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WebhookBroadcasterServiceTest {

    @Mock private WebhookSubscriptionRepository subscriptionRepository;
    @Mock private TokenEncryptionService tokenEncryptionService;
    @Mock private ZapierConfig config;

    private WebhookBroadcasterService service;

    @BeforeEach
    void setUp() {
        ObjectMapper om = new ObjectMapper();
        service = new WebhookBroadcasterService(subscriptionRepository, tokenEncryptionService, om, config);
    }

    private static WebhookSubscription sub(Long id, String eventType, String url, boolean active) {
        WebhookSubscription s = new WebhookSubscription();
        s.setId(id);
        s.setOrganizationId(7L);
        s.setEventType(eventType);
        s.setTargetUrl(url);
        s.setSecretEncrypted("ENC:" + id);
        s.setActive(active);
        return s;
    }

    @Test
    void broadcastEvent_disabled_returnsZero() {
        when(config.isEnabled()).thenReturn(false);

        int sent = service.broadcastEvent("reservation.created", Map.of("k", "v"), 7L);

        assertThat(sent).isZero();
    }

    @Test
    void broadcastEvent_noSubscriptions_returnsZero() {
        when(config.isEnabled()).thenReturn(true);
        when(subscriptionRepository.findByOrganizationIdAndActive(7L, true))
                .thenReturn(List.of());

        int sent = service.broadcastEvent("reservation.created", Map.of(), 7L);

        assertThat(sent).isZero();
    }

    @Test
    void broadcastEvent_filtersSubscriptionsByEventType() {
        when(config.isEnabled()).thenReturn(true);
        when(subscriptionRepository.findByOrganizationIdAndActive(7L, true))
                .thenReturn(List.of(
                        sub(1L, "reservation.created", "https://nope.invalid.local/sub1", true),
                        sub(2L, "other.event",         "https://nope.invalid.local/sub2", true)
                ));
        lenient().when(tokenEncryptionService.decrypt("ENC:1")).thenReturn("secret1");
        lenient().when(tokenEncryptionService.decrypt("ENC:2")).thenReturn("secret2");

        // Both target URLs are unreachable — sendWebhook should swallow + return false.
        int sent = service.broadcastEvent("reservation.created", Map.of("a", "b"), 7L);

        // No successful sends (network all fails), but no crash. Sub 2 is filtered out by eventType.
        assertThat(sent).isZero();
    }

    @Test
    void generateHmacSignature_computesExpectedHex() throws Exception {
        String payload = "{\"x\":1}";
        String secret = "my-secret";

        String sig = service.generateHmacSignature(payload, secret);

        // Compute expected HMAC for parity.
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        String expected = HexFormat.of().formatHex(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
        assertThat(sig).isEqualTo(expected);
    }

    @Test
    void generateHmacSignature_nullSecret_throwsRuntimeException() {
        try {
            service.generateHmacSignature("payload", null);
            assertThat(false).as("Should have thrown").isTrue();
        } catch (RuntimeException e) {
            assertThat(e.getMessage()).contains("HMAC");
        }
    }
}
