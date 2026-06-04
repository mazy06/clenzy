package com.clenzy.service.messaging.whatsapp;

import com.clenzy.model.WhatsAppConfig;
import com.clenzy.model.WhatsAppProviderType;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MetaWhatsAppProviderTest {

    @Mock private RestTemplate restTemplate;

    private MetaWhatsAppProvider provider;

    @BeforeEach
    void setUp() {
        provider = new MetaWhatsAppProvider(new ObjectMapper());
        ReflectionTestUtils.setField(provider, "restTemplate", restTemplate);
    }

    private WhatsAppConfig newConfig() {
        WhatsAppConfig c = new WhatsAppConfig();
        c.setPhoneNumberId("ph-1");
        c.setApiToken("tok-xyz");
        c.setOrganizationId(1L);
        return c;
    }

    // ===================================================================
    // getProviderType
    // ===================================================================

    @Test
    @DisplayName("getProviderType returns META")
    void getProviderType_returnsMeta() {
        assertThat(provider.getProviderType()).isEqualTo(WhatsAppProviderType.META);
    }

    // ===================================================================
    // sendTextMessage
    // ===================================================================

    @Nested
    @DisplayName("sendTextMessage")
    class SendTextMessage {

        @Test
        @DisplayName("returns message id on 2xx with messages array")
        void success_returnsMessageId() {
            String body = "{\"messages\":[{\"id\":\"wamid.42\"}]}";
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                .thenReturn(new ResponseEntity<>(body, HttpStatus.OK));

            String result = provider.sendTextMessage(newConfig(), "+33612", "Hello");

            assertThat(result).isEqualTo("wamid.42");
        }

        @Test
        @DisplayName("URL contains phoneNumberId in graph api path")
        void buildsCorrectUrl() {
            String body = "{\"messages\":[{\"id\":\"x\"}]}";
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                .thenReturn(new ResponseEntity<>(body, HttpStatus.OK));

            provider.sendTextMessage(newConfig(), "+33", "Hi");

            ArgumentCaptor<String> urlCaptor = ArgumentCaptor.forClass(String.class);
            verify(restTemplate).exchange(urlCaptor.capture(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class));
            assertThat(urlCaptor.getValue()).contains("ph-1/messages");
            assertThat(urlCaptor.getValue()).contains("graph.facebook.com/v18.0");
        }

        @Test
        @DisplayName("throws RuntimeException on non-2xx response")
        void non2xx_throws() {
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                .thenReturn(new ResponseEntity<>("", HttpStatus.BAD_REQUEST));

            assertThatThrownBy(() -> provider.sendTextMessage(newConfig(), "+33", "Hi"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Erreur envoi Meta WhatsApp");
        }

        @Test
        @DisplayName("throws when response body is null on 2xx")
        void nullBody_throws() {
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                .thenReturn(new ResponseEntity<>(null, HttpStatus.OK));

            assertThatThrownBy(() -> provider.sendTextMessage(newConfig(), "+33", "Hi"))
                .isInstanceOf(RuntimeException.class);
        }

        @Test
        @DisplayName("throws when messages array is empty")
        void emptyMessages_throws() {
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                .thenReturn(new ResponseEntity<>("{\"messages\":[]}", HttpStatus.OK));

            assertThatThrownBy(() -> provider.sendTextMessage(newConfig(), "+33", "Hi"))
                .isInstanceOf(RuntimeException.class);
        }

        @Test
        @DisplayName("throws when response is invalid JSON")
        void invalidJson_throws() {
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                .thenReturn(new ResponseEntity<>("not-json", HttpStatus.OK));

            assertThatThrownBy(() -> provider.sendTextMessage(newConfig(), "+33", "Hi"))
                .isInstanceOf(RuntimeException.class);
        }

        @Test
        @DisplayName("sanitizes phone number in payload")
        void phoneSanitized() {
            String body = "{\"messages\":[{\"id\":\"x\"}]}";
            ArgumentCaptor<HttpEntity<String>> captor = captor();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), captor.capture(), eq(String.class)))
                .thenReturn(new ResponseEntity<>(body, HttpStatus.OK));

            provider.sendTextMessage(newConfig(), "+33 (6) 12-34 56", "x");

            assertThat(captor.getValue().getBody()).contains("\"to\":\"+33612 3456\"".replaceAll(" ", ""));
        }

        @Test
        @DisplayName("escapes JSON characters in text body")
        void escapesJsonCharacters() {
            String body = "{\"messages\":[{\"id\":\"x\"}]}";
            ArgumentCaptor<HttpEntity<String>> captor = captor();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), captor.capture(), eq(String.class)))
                .thenReturn(new ResponseEntity<>(body, HttpStatus.OK));

            provider.sendTextMessage(newConfig(), "+33", "Hello \"world\"\nNew\\line");

            String sent = captor.getValue().getBody();
            assertThat(sent).contains("\\\"world\\\"");
            assertThat(sent).contains("\\n");
            assertThat(sent).contains("\\\\line");
        }

        @Test
        @DisplayName("handles null text safely (escaped to empty)")
        void nullText_emptyBody() {
            String body = "{\"messages\":[{\"id\":\"x\"}]}";
            ArgumentCaptor<HttpEntity<String>> captor = captor();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), captor.capture(), eq(String.class)))
                .thenReturn(new ResponseEntity<>(body, HttpStatus.OK));

            provider.sendTextMessage(newConfig(), "+33", null);

            assertThat(captor.getValue().getBody()).contains("\"body\":\"\"");
        }

        @Test
        @DisplayName("handles null phone safely (sanitized to empty)")
        void nullPhone_emptyTo() {
            String body = "{\"messages\":[{\"id\":\"x\"}]}";
            ArgumentCaptor<HttpEntity<String>> captor = captor();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), captor.capture(), eq(String.class)))
                .thenReturn(new ResponseEntity<>(body, HttpStatus.OK));

            provider.sendTextMessage(newConfig(), null, "Hi");

            assertThat(captor.getValue().getBody()).contains("\"to\":\"\"");
        }
    }

    // ===================================================================
    // sendTemplateMessage
    // ===================================================================

    @Nested
    @DisplayName("sendTemplateMessage")
    class SendTemplateMessage {

        @Test
        @DisplayName("returns message id on success")
        void success_returnsId() {
            String body = "{\"messages\":[{\"id\":\"wamid.tpl\"}]}";
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                .thenReturn(new ResponseEntity<>(body, HttpStatus.OK));

            String result = provider.sendTemplateMessage(newConfig(), "+33", "tpl_name", "fr_FR");

            assertThat(result).isEqualTo("wamid.tpl");
        }

        @Test
        @DisplayName("builds payload with template name and language")
        void payloadContainsTemplate() {
            String body = "{\"messages\":[{\"id\":\"x\"}]}";
            ArgumentCaptor<HttpEntity<String>> captor = captor();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), captor.capture(), eq(String.class)))
                .thenReturn(new ResponseEntity<>(body, HttpStatus.OK));

            provider.sendTemplateMessage(newConfig(), "+33", "booking_confirmation", "en_US");

            String sent = captor.getValue().getBody();
            assertThat(sent).contains("\"name\":\"booking_confirmation\"");
            assertThat(sent).contains("\"code\":\"en_US\"");
            assertThat(sent).contains("\"type\":\"template\"");
        }

        @Test
        @DisplayName("builds body component parameters when variables provided")
        void payloadContainsParameters() {
            String body = "{\"messages\":[{\"id\":\"x\"}]}";
            ArgumentCaptor<HttpEntity<String>> captor = captor();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), captor.capture(), eq(String.class)))
                .thenReturn(new ResponseEntity<>(body, HttpStatus.OK));

            provider.sendTemplateMessage(newConfig(), "+33", "clenzy_noise_alert_v1", "fr_FR",
                java.util.List.of("Marie", "75", "70", "Studio Paris"));

            String sent = captor.getValue().getBody();
            assertThat(sent).contains("\"name\":\"clenzy_noise_alert_v1\"");
            assertThat(sent).contains("\"components\"");
            assertThat(sent).contains("\"type\":\"body\"");
            assertThat(sent).contains("\"text\":\"Marie\"");
            assertThat(sent).contains("\"text\":\"Studio Paris\"");
        }

        @Test
        @DisplayName("throws on non-2xx response")
        void non2xx_throws() {
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                .thenReturn(new ResponseEntity<>("", HttpStatus.INTERNAL_SERVER_ERROR));

            assertThatThrownBy(() -> provider.sendTemplateMessage(newConfig(), "+33", "tpl", "fr_FR"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Erreur envoi template");
        }

        @Test
        @DisplayName("throws when parsing fails")
        void invalidJson_throws() {
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                .thenReturn(new ResponseEntity<>("not-json", HttpStatus.OK));

            assertThatThrownBy(() -> provider.sendTemplateMessage(newConfig(), "+33", "tpl", "fr_FR"))
                .isInstanceOf(RuntimeException.class);
        }
    }

    // ===================================================================
    // markAsRead
    // ===================================================================

    @Nested
    @DisplayName("markAsRead")
    class MarkAsRead {

        @Test
        @DisplayName("posts read status to Meta")
        void postsReadStatus() {
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                .thenReturn(new ResponseEntity<>("{}", HttpStatus.OK));

            provider.markAsRead(newConfig(), "wamid.42");

            ArgumentCaptor<HttpEntity<String>> captor = captor();
            verify(restTemplate).exchange(anyString(), eq(HttpMethod.POST), captor.capture(), eq(String.class));
            String body = captor.getValue().getBody();
            assertThat(body).contains("\"status\":\"read\"");
            assertThat(body).contains("\"message_id\":\"wamid.42\"");
        }

        @Test
        @DisplayName("swallows exception (best-effort)")
        void exception_swallowed() {
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                .thenThrow(new RestClientException("boom"));

            // should not throw
            provider.markAsRead(newConfig(), "wamid.42");
        }
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private static <T> ArgumentCaptor<T> captor() {
        return (ArgumentCaptor<T>) ArgumentCaptor.forClass(HttpEntity.class);
    }
}
