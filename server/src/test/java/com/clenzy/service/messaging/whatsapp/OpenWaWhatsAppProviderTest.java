package com.clenzy.service.messaging.whatsapp;

import com.clenzy.model.WhatsAppConfig;
import com.clenzy.model.WhatsAppProviderType;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class OpenWaWhatsAppProviderTest {

    private OpenWaWhatsAppProvider newProvider() {
        return new OpenWaWhatsAppProvider(new ObjectMapper(), "http://openwa:2785");
    }

    private OpenWaWhatsAppProvider providerWithMockedRest(RestTemplate restTemplate) {
        OpenWaWhatsAppProvider provider = new OpenWaWhatsAppProvider(new ObjectMapper(), "http://openwa:2785");
        ReflectionTestUtils.setField(provider, "restTemplate", restTemplate);
        return provider;
    }

    private WhatsAppConfig validConfig() {
        WhatsAppConfig c = new WhatsAppConfig();
        c.setOpenwaSessionId("session-x");
        c.setOpenwaApiKey("api-key");
        return c;
    }

    @Test
    void getProviderType_returnsOpenwa() {
        assertThat(newProvider().getProviderType()).isEqualTo(WhatsAppProviderType.OPENWA);
    }

    @Test
    void sendTemplateMessage_throwsUnsupportedOperation() {
        // OpenWA ne supporte pas les templates Meta-approuves : la fonction
        // doit throw UnsupportedOperationException pour que le code appelant
        // (BriefingDelivery) catch et fallback sur sendTextMessage.
        WhatsAppConfig config = new WhatsAppConfig();
        config.setOpenwaSessionId("owa-test");
        config.setOpenwaApiKey("owa_key");

        assertThatThrownBy(() -> newProvider().sendTemplateMessage(
                config, "+33612345678", "engagement_update", "fr"))
            .isInstanceOf(UnsupportedOperationException.class)
            .hasMessageContaining("templates");
    }

    @Test
    void sendTextMessage_missingSessionId_throwsIllegalState() {
        WhatsAppConfig config = new WhatsAppConfig();
        config.setOpenwaApiKey("owa_key");
        // openwaSessionId reste null

        assertThatThrownBy(() -> newProvider().sendTextMessage(config, "+33612345678", "Hello"))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("session");
    }

    @Test
    void sendTextMessage_missingApiKey_throwsIllegalState() {
        WhatsAppConfig config = new WhatsAppConfig();
        config.setOpenwaSessionId("owa-test");
        // openwaApiKey reste null

        assertThatThrownBy(() -> newProvider().sendTextMessage(config, "+33612345678", "Hello"))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("API key");
    }

    @Test
    void markAsRead_neverThrows_evenWhenConfigInvalid() {
        // Best-effort : un read receipt KO ne doit pas casser le flow appelant.
        // Pas de session/key configuree => l'appel HTTP echouera mais markAsRead
        // doit catch silencieusement.
        WhatsAppConfig config = new WhatsAppConfig();
        // Pas d'exception attendue
        newProvider().markAsRead(config, "msg-x");
    }

    // ─── HTTP behavior with mocked RestTemplate ────────────────────────────

    @Test
    void sendTextMessage_2xxWithMessageId_returnsId() {
        RestTemplate rt = mock(RestTemplate.class);
        String body = "{\"messageId\":\"owm-42\"}";
        when(rt.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                .thenReturn(new ResponseEntity<>(body, HttpStatus.OK));

        OpenWaWhatsAppProvider provider = providerWithMockedRest(rt);

        String result = provider.sendTextMessage(validConfig(), "+33612345678", "Hello");

        assertThat(result).isEqualTo("owm-42");
    }

    @Test
    void sendTextMessage_2xxWithIdFallback_returnsId() {
        RestTemplate rt = mock(RestTemplate.class);
        String body = "{\"id\":\"alt-id-7\"}";
        when(rt.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                .thenReturn(new ResponseEntity<>(body, HttpStatus.OK));

        String result = providerWithMockedRest(rt).sendTextMessage(validConfig(), "+33612345678", "Hello");

        assertThat(result).isEqualTo("alt-id-7");
    }

    @Test
    void sendTextMessage_2xxWithBothFields_prefersMessageId() {
        RestTemplate rt = mock(RestTemplate.class);
        String body = "{\"messageId\":\"primary\",\"id\":\"fallback\"}";
        when(rt.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                .thenReturn(new ResponseEntity<>(body, HttpStatus.OK));

        String result = providerWithMockedRest(rt).sendTextMessage(validConfig(), "+33", "Hi");

        assertThat(result).isEqualTo("primary");
    }

    @Test
    void sendTextMessage_non2xx_throwsRuntime() {
        RestTemplate rt = mock(RestTemplate.class);
        when(rt.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                .thenReturn(new ResponseEntity<>("Server Error", HttpStatus.INTERNAL_SERVER_ERROR));

        assertThatThrownBy(() -> providerWithMockedRest(rt).sendTextMessage(validConfig(), "+33", "x"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Erreur envoi OpenWA");
    }

    @Test
    void sendTextMessage_invalidJson_throwsRuntime() {
        RestTemplate rt = mock(RestTemplate.class);
        when(rt.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                .thenReturn(new ResponseEntity<>("not-json", HttpStatus.OK));

        assertThatThrownBy(() -> providerWithMockedRest(rt).sendTextMessage(validConfig(), "+33", "x"))
                .isInstanceOf(RuntimeException.class);
    }

    @Test
    void sendTextMessage_2xxButNoId_throwsRuntime() {
        RestTemplate rt = mock(RestTemplate.class);
        when(rt.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                .thenReturn(new ResponseEntity<>("{\"other\":\"x\"}", HttpStatus.OK));

        assertThatThrownBy(() -> providerWithMockedRest(rt).sendTextMessage(validConfig(), "+33", "x"))
                .isInstanceOf(RuntimeException.class);
    }

    @Test
    void sendTextMessage_buildsUrlWithSessionId() {
        RestTemplate rt = mock(RestTemplate.class);
        when(rt.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                .thenReturn(new ResponseEntity<>("{\"messageId\":\"x\"}", HttpStatus.OK));

        providerWithMockedRest(rt).sendTextMessage(validConfig(), "+33", "Hi");

        ArgumentCaptor<String> urlCap = ArgumentCaptor.forClass(String.class);
        verify(rt).exchange(urlCap.capture(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class));
        assertThat(urlCap.getValue()).contains("/api/sessions/session-x/messages/send-text");
    }

    @Test
    void sendTextMessage_includesApiKeyHeader() {
        RestTemplate rt = mock(RestTemplate.class);
        @SuppressWarnings({"unchecked"})
        ArgumentCaptor<HttpEntity<Map<String, String>>> entityCap = ArgumentCaptor.forClass(HttpEntity.class);
        when(rt.exchange(anyString(), eq(HttpMethod.POST), entityCap.capture(), eq(String.class)))
                .thenReturn(new ResponseEntity<>("{\"messageId\":\"x\"}", HttpStatus.OK));

        providerWithMockedRest(rt).sendTextMessage(validConfig(), "+33", "Hi");

        HttpEntity<Map<String, String>> sent = entityCap.getValue();
        assertThat(sent.getHeaders().getFirst("X-API-Key")).isEqualTo("api-key");
    }

    @Test
    void sendTextMessage_phoneSanitized_toChatId() {
        RestTemplate rt = mock(RestTemplate.class);
        @SuppressWarnings({"unchecked"})
        ArgumentCaptor<HttpEntity<Map<String, String>>> entityCap = ArgumentCaptor.forClass(HttpEntity.class);
        when(rt.exchange(anyString(), eq(HttpMethod.POST), entityCap.capture(), eq(String.class)))
                .thenReturn(new ResponseEntity<>("{\"messageId\":\"x\"}", HttpStatus.OK));

        providerWithMockedRest(rt).sendTextMessage(validConfig(), "+33 (6) 12-34-56-78", "Hi");

        Map<String, String> body = entityCap.getValue().getBody();
        assertThat(body).containsEntry("chatId", "33612345678@c.us");
    }

    @Test
    void sendTextMessage_nullText_sendsEmpty() {
        RestTemplate rt = mock(RestTemplate.class);
        @SuppressWarnings({"unchecked"})
        ArgumentCaptor<HttpEntity<Map<String, String>>> entityCap = ArgumentCaptor.forClass(HttpEntity.class);
        when(rt.exchange(anyString(), eq(HttpMethod.POST), entityCap.capture(), eq(String.class)))
                .thenReturn(new ResponseEntity<>("{\"messageId\":\"x\"}", HttpStatus.OK));

        providerWithMockedRest(rt).sendTextMessage(validConfig(), "+33", null);

        assertThat(entityCap.getValue().getBody()).containsEntry("text", "");
    }

    @Test
    void sendTextMessage_blankSessionId_throwsIllegalState() {
        WhatsAppConfig config = new WhatsAppConfig();
        config.setOpenwaSessionId("  ");
        config.setOpenwaApiKey("key");

        assertThatThrownBy(() -> newProvider().sendTextMessage(config, "+33", "Hi"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("session");
    }

    @Test
    void sendTextMessage_blankApiKey_throwsIllegalState() {
        WhatsAppConfig config = new WhatsAppConfig();
        config.setOpenwaSessionId("s");
        config.setOpenwaApiKey("   ");

        assertThatThrownBy(() -> newProvider().sendTextMessage(config, "+33", "Hi"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("API key");
    }

    @Test
    void markAsRead_validConfig_callsRestTemplate() {
        RestTemplate rt = mock(RestTemplate.class);
        when(rt.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                .thenReturn(new ResponseEntity<>("ok", HttpStatus.OK));

        providerWithMockedRest(rt).markAsRead(validConfig(), "msg-x");

        ArgumentCaptor<String> urlCap = ArgumentCaptor.forClass(String.class);
        verify(rt).exchange(urlCap.capture(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class));
        assertThat(urlCap.getValue()).contains("/api/sessions/session-x/messages/msg-x/read");
    }

    @Test
    void markAsRead_restThrows_swallowsSilently() {
        RestTemplate rt = mock(RestTemplate.class);
        when(rt.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                .thenThrow(new RuntimeException("server down"));

        // Should not throw
        providerWithMockedRest(rt).markAsRead(validConfig(), "msg-x");
    }

    @Test
    void getProviderType_alwaysReturnsOpenWa() {
        assertThat(newProvider().getProviderType()).isEqualTo(WhatsAppProviderType.OPENWA);
    }
}
