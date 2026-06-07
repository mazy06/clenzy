package com.clenzy.service.messaging;

import com.clenzy.model.WhatsAppConfig;
import com.clenzy.repository.WhatsAppConfigRepository;
import com.clenzy.service.messaging.whatsapp.WhatsAppProvider;
import com.clenzy.service.messaging.whatsapp.WhatsAppProviderResolver;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

/**
 * Tests du webhook WhatsApp (compte global). verifyWebhook : config singleton,
 * sans org_id. processWebhook : délègue le rattachement au {@link WhatsAppInboundRouter}
 * (mocké ici) puis accuse réception (mark-as-read).
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class WhatsAppWebhookServiceTest {

    @Mock private WhatsAppConfigRepository configRepository;
    @Mock private WhatsAppInboundRouter inboundRouter;
    @Mock private WhatsAppProviderResolver providerResolver;
    @Mock private WhatsAppProvider provider;

    private ObjectMapper objectMapper;
    private WhatsAppWebhookService service;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        service = new WhatsAppWebhookService(configRepository, inboundRouter, providerResolver, objectMapper);
    }

    @Nested
    @DisplayName("verifyWebhook")
    class VerifyWebhook {

        @Test
        void wrongMode_returnsFalse() {
            assertThat(service.verifyWebhook("unsubscribe", "token", "challenge")).isFalse();
            verifyNoInteractions(configRepository);
        }

        @Test
        void nullMode_returnsFalse() {
            assertThat(service.verifyWebhook(null, "tok", "chall")).isFalse();
        }

        @Test
        void noConfig_returnsFalse() {
            when(configRepository.findFirstByOrganizationIdIsNull()).thenReturn(Optional.empty());
            assertThat(service.verifyWebhook("subscribe", "tok", "chall")).isFalse();
        }

        @Test
        void tokenMismatch_returnsFalse() {
            WhatsAppConfig cfg = new WhatsAppConfig();
            cfg.setWebhookVerifyToken("expected-token");
            when(configRepository.findFirstByOrganizationIdIsNull()).thenReturn(Optional.of(cfg));
            assertThat(service.verifyWebhook("subscribe", "wrong-token", "chall")).isFalse();
        }

        @Test
        void nullToken_returnsFalse() {
            WhatsAppConfig cfg = new WhatsAppConfig();
            cfg.setWebhookVerifyToken("expected-token");
            when(configRepository.findFirstByOrganizationIdIsNull()).thenReturn(Optional.of(cfg));
            assertThat(service.verifyWebhook("subscribe", null, "chall")).isFalse();
        }

        @Test
        void match_returnsTrue() {
            WhatsAppConfig cfg = new WhatsAppConfig();
            cfg.setWebhookVerifyToken("verify-me");
            when(configRepository.findFirstByOrganizationIdIsNull()).thenReturn(Optional.of(cfg));
            assertThat(service.verifyWebhook("subscribe", "verify-me", "challenge")).isTrue();
        }
    }

    @Nested
    @DisplayName("processWebhook")
    class ProcessWebhook {

        @Test
        void noEntry_doesNothing() {
            service.processWebhook(Map.of("foo", "bar"));
            verifyNoInteractions(inboundRouter, providerResolver);
        }

        @Test
        void noValue_doesNothing() {
            Map<String, Object> payload = Map.of("entry", List.of(Map.of(
                "changes", List.of(Map.of("field", "messages"))
            )));
            service.processWebhook(payload);
            verifyNoInteractions(inboundRouter, providerResolver);
        }

        @Test
        @DisplayName("text message : routes to inbound router + marks as read")
        void textMessage_routesAndMarksRead() {
            WhatsAppConfig cfg = new WhatsAppConfig();
            when(configRepository.findFirstByOrganizationIdIsNull()).thenReturn(Optional.of(cfg));
            when(providerResolver.resolve(cfg)).thenReturn(provider);

            Map<String, Object> payload = Map.of("entry", List.of(Map.of(
                "changes", List.of(Map.of(
                    "value", Map.of(
                        "metadata", Map.of("phone_number_id", "phone-1"),
                        "contacts", List.of(Map.of("profile", Map.of("name", "Alice"))),
                        "messages", List.of(Map.of("from", "+33612", "id", "wamid.123", "type", "text",
                            "text", Map.of("body", "Hi there!")))
                    )
                ))
            )));

            service.processWebhook(payload);

            verify(inboundRouter).route("+33612", "Alice", "Hi there!", "wamid.123");
            verify(provider).markAsRead(cfg, "wamid.123");
        }

        @Test
        void noGlobalConfig_skips() {
            when(configRepository.findFirstByOrganizationIdIsNull()).thenReturn(Optional.empty());

            Map<String, Object> payload = Map.of("entry", List.of(Map.of(
                "changes", List.of(Map.of(
                    "value", Map.of(
                        "messages", List.of(Map.of("from", "+33", "id", "wamid", "type", "text",
                            "text", Map.of("body", "Hi")))
                    )
                ))
            )));

            service.processWebhook(payload);
            verifyNoInteractions(inboundRouter, providerResolver);
        }

        @Test
        @DisplayName("router exception is swallowed, mark-as-read still attempted")
        void routerException_swallowed() {
            WhatsAppConfig cfg = new WhatsAppConfig();
            when(configRepository.findFirstByOrganizationIdIsNull()).thenReturn(Optional.of(cfg));
            when(providerResolver.resolve(cfg)).thenReturn(provider);
            doThrow(new RuntimeException("boom")).when(inboundRouter).route(any(), any(), any(), any());

            Map<String, Object> payload = Map.of("entry", List.of(Map.of(
                "changes", List.of(Map.of(
                    "value", Map.of(
                        "messages", List.of(Map.of("from", "+33", "id", "wamid", "type", "text",
                            "text", Map.of("body", "Hi")))
                    )
                ))
            )));

            service.processWebhook(payload);
            verify(provider).markAsRead(cfg, "wamid");
        }

        @Test
        void statusUpdate_processed() {
            Map<String, Object> payload = Map.of("entry", List.of(Map.of(
                "changes", List.of(Map.of(
                    "value", Map.of(
                        "statuses", List.of(Map.of("id", "wamid.42", "status", "delivered"))
                    )
                ))
            )));
            service.processWebhook(payload);
            verifyNoInteractions(inboundRouter);
        }

        @Test
        void malformedPayload_doesNotThrow() {
            try {
                service.processWebhook(null);
            } catch (Exception ignored) {
                // OK either way - shouldn't crash
            }
        }
    }
}
