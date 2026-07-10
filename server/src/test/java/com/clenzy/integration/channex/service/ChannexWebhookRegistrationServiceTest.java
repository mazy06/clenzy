package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.config.ChannexProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * B1 — auto-registration idempotente du webhook global (registerWebhook
 * existait mais n'etait JAMAIS appele : etape manuelle oubliable).
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("ChannexWebhookRegistrationService")
class ChannexWebhookRegistrationServiceTest {

    private static final String CALLBACK = "https://app.clenzy.fr/api/webhooks/channex";

    @Mock private ChannexClient channexClient;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private ChannexProperties props;
    private ChannexWebhookRegistrationService service;

    @BeforeEach
    void setUp() {
        props = new ChannexProperties();
        props.setApiKey("test-key");
        props.setWebhookSecret("shared-secret");
        props.setWebhookCallbackUrl(CALLBACK);
        service = new ChannexWebhookRegistrationService(channexClient, props);
    }

    private com.fasterxml.jackson.databind.JsonNode webhookNode(String id, String url, boolean active) {
        try {
            return objectMapper.readTree("""
                {"id":"%s","attributes":{"callback_url":"%s","is_active":%s}}
                """.formatted(id, url, active));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    @Test
    @DisplayName("config incomplete (pas de callback URL) -> not_configured, aucun appel")
    void notConfiguredSkips() {
        props.setWebhookCallbackUrl("");

        var result = service.ensureGlobalWebhook();

        assertThat(result.status()).isEqualTo("not_configured");
        verify(channexClient, never()).listWebhooks();
    }

    @Test
    @DisplayName("aucun webhook existant -> creation (event mask + secret transmis)")
    void createsWhenAbsent() {
        when(channexClient.listWebhooks()).thenReturn(List.of());
        when(channexClient.registerGlobalWebhook(CALLBACK, "*", "shared-secret"))
            .thenReturn("wh-123");

        var result = service.ensureGlobalWebhook();

        assertThat(result.status()).isEqualTo("created");
        assertThat(result.webhookId()).isEqualTo("wh-123");
    }

    @Test
    @DisplayName("webhook deja present sur la meme URL -> already_registered, pas de doublon")
    void idempotentWhenPresent() {
        when(channexClient.listWebhooks())
            .thenReturn(List.of(webhookNode("wh-1", CALLBACK, true)));

        var result = service.ensureGlobalWebhook();

        assertThat(result.status()).isEqualTo("already_registered");
        assertThat(result.webhookId()).isEqualTo("wh-1");
        verify(channexClient, never()).registerGlobalWebhook(anyString(), anyString(), any());
    }

    @Test
    @DisplayName("webhook present mais is_active=false (defaut Channex piege) -> signale, pas de doublon")
    void flagsInactiveWebhook() {
        when(channexClient.listWebhooks())
            .thenReturn(List.of(webhookNode("wh-1", CALLBACK, false)));

        var result = service.ensureGlobalWebhook();

        assertThat(result.status()).isEqualTo("exists_inactive");
        verify(channexClient, never()).registerGlobalWebhook(anyString(), anyString(), any());
    }

    @Test
    @DisplayName("webhook existant sur une AUTRE URL -> creation quand meme")
    void createsWhenOtherUrlOnly() {
        when(channexClient.listWebhooks())
            .thenReturn(List.of(webhookNode("wh-old", "https://old.example.com/hook", true)));
        when(channexClient.registerGlobalWebhook(CALLBACK, "*", "shared-secret"))
            .thenReturn("wh-new");

        var result = service.ensureGlobalWebhook();

        assertThat(result.status()).isEqualTo("created");
        assertThat(result.webhookId()).isEqualTo("wh-new");
    }
}
