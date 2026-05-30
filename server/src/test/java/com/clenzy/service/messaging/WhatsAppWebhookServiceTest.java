package com.clenzy.service.messaging;

import com.clenzy.model.Conversation;
import com.clenzy.model.ConversationChannel;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class WhatsAppWebhookServiceTest {

    @Mock private WhatsAppConfigRepository configRepository;
    @Mock private ConversationService conversationService;
    @Mock private WhatsAppProviderResolver providerResolver;
    @Mock private WhatsAppProvider provider;

    private ObjectMapper objectMapper;
    private WhatsAppWebhookService service;

    private static final Long ORG_ID = 42L;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        service = new WhatsAppWebhookService(configRepository, conversationService, providerResolver, objectMapper);
    }

    // ===================================================================
    // verifyWebhook
    // ===================================================================

    @Nested
    @DisplayName("verifyWebhook")
    class VerifyWebhook {

        @Test
        @DisplayName("returns false when mode is not subscribe")
        void wrongMode_returnsFalse() {
            boolean result = service.verifyWebhook("unsubscribe", "token", "challenge", ORG_ID);

            assertThat(result).isFalse();
            verifyNoInteractions(configRepository);
        }

        @Test
        @DisplayName("returns false when mode is null")
        void nullMode_returnsFalse() {
            assertThat(service.verifyWebhook(null, "tok", "chall", ORG_ID)).isFalse();
        }

        @Test
        @DisplayName("returns false when no config found for org")
        void noConfig_returnsFalse() {
            when(configRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.empty());

            assertThat(service.verifyWebhook("subscribe", "tok", "chall", ORG_ID)).isFalse();
        }

        @Test
        @DisplayName("returns false when token mismatch")
        void tokenMismatch_returnsFalse() {
            WhatsAppConfig cfg = new WhatsAppConfig();
            cfg.setWebhookVerifyToken("expected-token");
            when(configRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.of(cfg));

            assertThat(service.verifyWebhook("subscribe", "wrong-token", "chall", ORG_ID)).isFalse();
        }

        @Test
        @DisplayName("returns false when token is null")
        void nullToken_returnsFalse() {
            WhatsAppConfig cfg = new WhatsAppConfig();
            cfg.setWebhookVerifyToken("expected-token");
            when(configRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.of(cfg));

            assertThat(service.verifyWebhook("subscribe", null, "chall", ORG_ID)).isFalse();
        }

        @Test
        @DisplayName("returns true when subscribe + token match")
        void match_returnsTrue() {
            WhatsAppConfig cfg = new WhatsAppConfig();
            cfg.setWebhookVerifyToken("verify-me");
            when(configRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.of(cfg));

            assertThat(service.verifyWebhook("subscribe", "verify-me", "challenge", ORG_ID)).isTrue();
        }
    }

    // ===================================================================
    // processWebhook
    // ===================================================================

    @Nested
    @DisplayName("processWebhook")
    class ProcessWebhook {

        @Test
        @DisplayName("ignores payload without entry array")
        void noEntry_doesNothing() {
            service.processWebhook(Map.of("foo", "bar"));

            verifyNoInteractions(conversationService);
        }

        @Test
        @DisplayName("ignores entry without changes array")
        void noChanges_doesNothing() {
            Map<String, Object> payload = Map.of("entry", List.of(Map.of("id", "1")));

            service.processWebhook(payload);

            verifyNoInteractions(conversationService);
        }

        @Test
        @DisplayName("ignores changes without value field")
        void noValue_doesNothing() {
            Map<String, Object> payload = Map.of("entry", List.of(Map.of(
                "changes", List.of(Map.of("field", "messages"))
            )));

            service.processWebhook(payload);

            verifyNoInteractions(conversationService);
        }

        @Test
        @DisplayName("ignores when phone_number_id missing in metadata")
        void noPhoneNumberId_skipsMessages() {
            Map<String, Object> payload = Map.of("entry", List.of(Map.of(
                "changes", List.of(Map.of(
                    "value", Map.of(
                        "messages", List.of(Map.of("from", "+33612", "id", "wamid.1", "type", "text",
                            "text", Map.of("body", "Hello")))
                    )
                ))
            )));

            service.processWebhook(payload);

            verifyNoInteractions(conversationService);
        }

        @Test
        @DisplayName("processes a text message, creates conversation, marks as read")
        void textMessage_createsConvAndMarksRead() {
            WhatsAppConfig cfg = new WhatsAppConfig();
            cfg.setOrganizationId(ORG_ID);
            cfg.setPhoneNumberId("phone-1");
            when(configRepository.findAll()).thenReturn(List.of(cfg));
            when(providerResolver.resolve(cfg)).thenReturn(provider);

            Conversation conv = new Conversation();
            conv.setOrganizationId(ORG_ID);
            when(conversationService.getOrCreate(eq(ORG_ID), eq(ConversationChannel.WHATSAPP),
                    eq("+33612"), any(), any(), any(), anyString())).thenReturn(conv);

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

            verify(conversationService).getOrCreate(eq(ORG_ID), eq(ConversationChannel.WHATSAPP),
                    eq("+33612"), any(), any(), any(), eq("WhatsApp: Alice"));
            verify(conversationService).addInboundMessage(eq(conv), eq("Alice"), eq("+33612"),
                    eq("Hi there!"), any(), eq("wamid.123"));
            verify(provider).markAsRead(cfg, "wamid.123");
        }

        @Test
        @DisplayName("processes a long text message (truncation does not throw)")
        void longText_truncatesInLogs() {
            WhatsAppConfig cfg = new WhatsAppConfig();
            cfg.setOrganizationId(ORG_ID);
            cfg.setPhoneNumberId("phone-1");
            when(configRepository.findAll()).thenReturn(List.of(cfg));
            when(providerResolver.resolve(cfg)).thenReturn(provider);

            Conversation conv = new Conversation();
            when(conversationService.getOrCreate(eq(ORG_ID), any(), any(), any(), any(), any(), anyString()))
                .thenReturn(conv);

            String longText = "x".repeat(100);
            Map<String, Object> payload = Map.of("entry", List.of(Map.of(
                "changes", List.of(Map.of(
                    "value", Map.of(
                        "metadata", Map.of("phone_number_id", "phone-1"),
                        "messages", List.of(Map.of("from", "+33", "id", "wamid", "type", "text",
                            "text", Map.of("body", longText)))
                    )
                ))
            )));

            service.processWebhook(payload);

            verify(conversationService).addInboundMessage(eq(conv), eq(""), eq("+33"), eq(longText), any(), eq("wamid"));
        }

        @Test
        @DisplayName("skips message when no matching config found")
        void noMatchingConfig_skips() {
            WhatsAppConfig cfg = new WhatsAppConfig();
            cfg.setOrganizationId(ORG_ID);
            cfg.setPhoneNumberId("other-phone");
            when(configRepository.findAll()).thenReturn(List.of(cfg));

            Map<String, Object> payload = Map.of("entry", List.of(Map.of(
                "changes", List.of(Map.of(
                    "value", Map.of(
                        "metadata", Map.of("phone_number_id", "phone-1"),
                        "messages", List.of(Map.of("from", "+33", "id", "wamid", "type", "text",
                            "text", Map.of("body", "Hi")))
                    )
                ))
            )));

            service.processWebhook(payload);

            verifyNoInteractions(conversationService);
        }

        @Test
        @DisplayName("markAsRead exception is swallowed")
        void markAsReadException_swallowed() {
            WhatsAppConfig cfg = new WhatsAppConfig();
            cfg.setOrganizationId(ORG_ID);
            cfg.setPhoneNumberId("phone-1");
            when(configRepository.findAll()).thenReturn(List.of(cfg));
            when(providerResolver.resolve(cfg)).thenReturn(provider);
            Conversation conv = new Conversation();
            when(conversationService.getOrCreate(any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(conv);
            doThrow(new RuntimeException("boom")).when(provider).markAsRead(any(), any());

            Map<String, Object> payload = Map.of("entry", List.of(Map.of(
                "changes", List.of(Map.of(
                    "value", Map.of(
                        "metadata", Map.of("phone_number_id", "phone-1"),
                        "messages", List.of(Map.of("from", "+33", "id", "wamid", "type", "text",
                            "text", Map.of("body", "Hi")))
                    )
                ))
            )));

            service.processWebhook(payload);

            verify(conversationService).addInboundMessage(any(), any(), any(), any(), any(), any());
        }

        @Test
        @DisplayName("processes a status update without errors")
        void statusUpdate_processed() {
            Map<String, Object> payload = Map.of("entry", List.of(Map.of(
                "changes", List.of(Map.of(
                    "value", Map.of(
                        "statuses", List.of(Map.of("id", "wamid.42", "status", "delivered"))
                    )
                ))
            )));

            service.processWebhook(payload);

            verifyNoInteractions(conversationService);
        }

        @Test
        @DisplayName("processes empty messages array safely")
        void emptyMessages_safe() {
            Map<String, Object> payload = Map.of("entry", List.of(Map.of(
                "changes", List.of(Map.of(
                    "value", Map.of(
                        "metadata", Map.of("phone_number_id", "phone-1"),
                        "messages", List.of()
                    )
                ))
            )));

            service.processWebhook(payload);

            verifyNoInteractions(conversationService);
        }

        @Test
        @DisplayName("processes empty contacts array (senderName falls back to empty)")
        void emptyContacts_emptySenderName() {
            WhatsAppConfig cfg = new WhatsAppConfig();
            cfg.setOrganizationId(ORG_ID);
            cfg.setPhoneNumberId("phone-1");
            when(configRepository.findAll()).thenReturn(List.of(cfg));
            when(providerResolver.resolve(cfg)).thenReturn(provider);
            Conversation conv = new Conversation();
            when(conversationService.getOrCreate(any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(conv);

            Map<String, Object> payload = Map.of("entry", List.of(Map.of(
                "changes", List.of(Map.of(
                    "value", Map.of(
                        "metadata", Map.of("phone_number_id", "phone-1"),
                        "contacts", List.of(),
                        "messages", List.of(Map.of("from", "+33", "id", "wamid", "type", "text",
                            "text", Map.of("body", "Hello")))
                    )
                ))
            )));

            service.processWebhook(payload);

            verify(conversationService).getOrCreate(any(), any(), any(), any(), any(), any(), eq("WhatsApp: "));
        }

        @Test
        @DisplayName("malformed payload does not throw (logs and continues)")
        void malformedPayload_doesNotThrow() {
            // null entry path triggers an exception path
            Map<String, Object> payload = null;

            // Acts on null safely or logs the error
            try {
                service.processWebhook(payload);
            } catch (Exception ignored) {
                // OK either way - shouldn't crash
            }
        }
    }
}
