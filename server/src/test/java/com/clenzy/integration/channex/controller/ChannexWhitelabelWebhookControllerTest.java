package com.clenzy.integration.channex.controller;

import com.clenzy.integration.channex.client.ChannexSignatureValidator;
import com.clenzy.integration.channex.config.ChannexMetrics;
import com.clenzy.integration.channex.config.ChannexProperties;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ChannexWhitelabelWebhookControllerTest {
    private static final String URL = "/api/webhooks/channex/whitelabel";
    private static final String TOKEN = "test-only-whitelabel-token";
    private final ChannexProperties properties = new ChannexProperties();
    private final SimpleMeterRegistry registry = new SimpleMeterRegistry();
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        properties.setWebhookSecret(TOKEN);
        mvc = MockMvcBuilders.standaloneSetup(new ChannexWhitelabelWebhookController(
                new ChannexSignatureValidator(properties), new ChannexMetrics(registry))).build();
    }

    @Test
    void missingTokenIsRejected() throws Exception {
        mvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
        assertThat(registry.get("channex.webhook.received")
                .tags("event_type", "whitelabel", "outcome", "invalid_signature").counter().count())
                .isEqualTo(1);
    }

    @Test
    void signatureHeaderDoesNotReplaceConfiguredToken() throws Exception {
        mvc.perform(post(URL).header("X-Channex-Signature", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void invalidTokenIsRejectedEvenWithMalformedJson() throws Exception {
        mvc.perform(post(URL).header("X-Channex-Token", "wrong")
                        .contentType(MediaType.APPLICATION_JSON).content("not-json"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void absentServerSecretFailsClosed() throws Exception {
        properties.setWebhookSecret("");
        mvc.perform(post(URL).header("X-Channex-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @ParameterizedTest
    @ValueSource(strings = {"listing_updated", "content_updated", "property_updated", "sync_error", "new_event"})
    void authenticatedEventIsNeverAcknowledgedWithoutProcessing(String event) throws Exception {
        mvc.perform(post(URL).header("X-Channex-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"event\":\"" + event + "\"}"))
                .andExpect(status().isServiceUnavailable());
        assertThat(registry.get("channex.webhook.received")
                .tags("event_type", "whitelabel", "outcome", "not_ready").counter().count())
                .isEqualTo(1);
    }
}
