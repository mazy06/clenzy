package com.clenzy.service.messaging.whatsapp;

import com.clenzy.model.WhatsAppConfig;
import com.clenzy.model.WhatsAppProviderType;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OpenWaWhatsAppProviderTest {

    private OpenWaWhatsAppProvider newProvider() {
        return new OpenWaWhatsAppProvider(new ObjectMapper(), "http://openwa:2785");
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
}
